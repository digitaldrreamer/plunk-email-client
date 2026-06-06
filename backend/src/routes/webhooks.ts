import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { tags } from "../db/schema";
import { logger, describeError } from "../lib/logger";
import { addEmail, updateEmail, updateEmailByPlunkId, getEmailByPlunkId, STATUS_RANK, type StoredEmail } from "../lib/store";
import { sseEmit } from "../lib/sse";
import { isHardFail, postmarkSpamScore, isSpam, type Verdict } from "../lib/spam";
import { categorizeEmail } from "../lib/mistral";
import { checkUrlSafety } from "../lib/safe-browsing";
import { upsertContact, markContactBounced, markContactComplained } from "../lib/contacts";
import { sendEmail } from "../lib/plunk";
import { htmlToText } from "../lib/html-to-text";

const router = Router();

function validateBearer(authHeader: string | undefined, secret: string): boolean {
  if (!secret) return true;
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length).trim();
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    return false;
  }
}

// ── Inbound email (email.received) ────────────────────────────────────────────
//
// Plunk workflow trigger: email.received → Webhook → this URL
// Header: Authorization: Bearer {PLUNK_INBOUND_SECRET}

router.post("/inbound", async (req, res) => {
  const secret = process.env.PLUNK_INBOUND_SECRET ?? "";
  if (!validateBearer(req.headers.authorization, secret)) {
    return res.status(200).json({ status: "unauthorized" });
  }

  try {
    const payload = req.body as PlunkInboundPayload;
    const event = payload.event;

    if (!event?.messageId || !event.from || !event.subject) {
      return res.status(200).json({ status: "dropped: missing fields" });
    }

    if (isHardFail(event.spamVerdict as Verdict)) {
      logger.warn("Inbound: dropped spam verdict", { action: "inbound_drop", reason: "spam_verdict", messageId: event.messageId });
      return res.status(200).json({ status: "dropped: spam verdict" });
    }
    if (isHardFail(event.virusVerdict as Verdict)) {
      logger.warn("Inbound: dropped virus verdict", { action: "inbound_drop", reason: "virus_verdict", messageId: event.messageId });
      return res.status(200).json({ status: "dropped: virus verdict" });
    }

    const rawForSpam = `From: ${event.fromHeader ?? event.from}\nSubject: ${event.subject}\n\n${event.body ?? ""}`;
    const score = await postmarkSpamScore(rawForSpam);
    if (isSpam(score)) {
      logger.warn("Inbound: dropped by spam score", { action: "inbound_drop", reason: "spam_score", score, messageId: event.messageId });
      return res.status(200).json({ status: "dropped: spam score", score });
    }

    const senderName = parseSenderName(event.fromHeader ?? event.from);
    const bodyText = htmlToText(event.body ?? "");

    let category: StoredEmail["category"] = "primary";
    let folder: StoredEmail["folder"] = "inbox";
    let tagIds: string[] = [];

    if (process.env.MISTRAL_API_KEY) {
      try {
        const existingTags = await db.select({ id: tags.id, name: tags.name }).from(tags);
        const ai = await categorizeEmail(event.subject, bodyText, existingTags);

        category = ai.category as StoredEmail["category"];
        if (ai.folder === "spam") folder = "spam";

        tagIds = ai.matchedTagIds.filter((id) => existingTags.some((t) => t.id === id));

        for (const nt of ai.newTags) {
          const id = nt.name.toLowerCase().replace(/\s+/g, "-");
          await db.insert(tags).values({ id, name: nt.name, color: nt.color }).onConflictDoNothing({ target: tags.id });
          if (!tagIds.includes(id)) tagIds.push(id);
        }
      } catch (err) {
        logger.warn("Inbound: AI categorization failed", { action: "inbound_categorize", error: (err as Error).message });
      }
    }

    const emailId = `recv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const email: StoredEmail = {
      id: emailId,
      messageId: event.messageId,
      threadId: `t-recv-${event.messageId}`,
      from: { name: senderName, email: event.from.toLowerCase() },
      to: (event.recipients ?? [event.to]).map((addr: string) => ({ name: addr, email: addr })),
      subject: event.subject,
      body: event.body ?? "",
      preview: bodyText.slice(0, 120),
      date: event.timestamp ?? new Date().toISOString(),
      folder,
      category,
      read: false,
      starred: false,
      tagIds,
      hasAttachments: false,
      spamScore: score,
      threatUrls: [],
      deliveryStatus: "pending",
      openCount: 0,
      clickCount: 0,
    };

    const inserted = await addEmail(email);
    if (!inserted) {
      logger.info("Inbound: duplicate, skipping", { action: "inbound_duplicate", messageId: event.messageId });
      return res.status(200).json({ status: "ok", duplicate: true });
    }

    sseEmit("new-email", email);
    logger.info("Inbound: email stored", { action: "inbound_stored", emailId, from: event.from, subject: event.subject, category, folder });

    // Ack immediately — heavy work runs after
    res.status(200).json({ status: "ok", id: emailId });

    setImmediate(async () => {
      try {
        await upsertContact(event.from.toLowerCase(), senderName);
      } catch (err) {
        logger.warn("Inbound: contact upsert failed", { action: "inbound_contact", error: (err as Error).message });
      }
      try {
        const threats = await checkUrlSafety(email.body);
        if (threats.length > 0) {
          const threatUrlList = threats.map((t) => t.url);
          await updateEmail(emailId, { category: "dangerous", threatUrls: threatUrlList });
          sseEmit("email-updated", { id: emailId, category: "dangerous", threatUrls: threatUrlList });
          logger.warn("Inbound: dangerous URLs detected", { action: "inbound_threat", emailId, urls: threatUrlList });
        }
      } catch (err) {
        logger.warn("Inbound: URL safety check failed", { action: "inbound_threat", error: (err as Error).message });
      }
    });
  } catch (err) {
    logger.error("Inbound: unhandled error", { action: "inbound_error", ...describeError(err) });
    res.status(200).json({ status: "error" });
  }
});

// ── Outbound event webhook (email.sent/delivery/open/click/bounce/complaint) ──
//
// Create one Plunk workflow per event type, each pointing at this URL.
// Header: Authorization: Bearer {PLUNK_WEBHOOK_SECRET}
//
// Event type is detected from which fields are present in the `event` payload
// (Plunk uses field presence, not a type discriminator in the default payload).

async function eventsHandler(req: Request, res: Response): Promise<void> {
  const secret = process.env.PLUNK_WEBHOOK_SECRET ?? "";
  if (!validateBearer(req.headers.authorization, secret)) {
    res.status(200).json({ status: "unauthorized" });
    return;
  }

  // Ack immediately — Plunk has a 10 s timeout and no automatic retries
  res.status(200).json({ status: "ok" });

  try {
    const payload = req.body as PlunkEventPayload;
    const event = payload.event ?? {};
    const contactEmail = payload.contact?.email ?? "";
    const contactName = String(
      (payload.contact as Record<string, unknown>)?.data &&
      typeof (payload.contact as Record<string, unknown>).data === "object"
        ? ((payload.contact as Record<string, unknown>).data as Record<string, unknown>)?.name ?? ""
        : ""
    );
    const emailId = String(event.emailId ?? "");

    // Upsert contact for every event
    if (contactEmail) {
      await upsertContact(contactEmail, contactName).catch(() => null);
    }

    // ── email.sent ─────────────────────────────────────────────────────────
    if ("sentAt" in event) {
      logger.info("Event: email sent", { action: "event_sent", contactEmail, emailId });
      if (emailId) {
        const existing = await getEmailByPlunkId(emailId);
        if (existing && canAdvance(existing.deliveryStatus, "sent")) {
          const updated = await updateEmailByPlunkId(emailId, { deliveryStatus: "sent" });
          if (updated) sseEmit("email-updated", { id: updated.id, deliveryStatus: "sent" });
        }
      }
      return;
    }

    // ── email.delivery ─────────────────────────────────────────────────────
    if ("deliveredAt" in event) {
      logger.info("Event: email delivered", { action: "event_delivered", contactEmail, emailId });
      if (emailId) {
        const existing = await getEmailByPlunkId(emailId);
        if (existing && canAdvance(existing.deliveryStatus, "delivered")) {
          const patch = { deliveryStatus: "delivered", deliveredAt: String(event.deliveredAt) };
          const updated = await updateEmailByPlunkId(emailId, patch);
          if (updated) sseEmit("email-updated", { id: updated.id, ...patch });
        }
      }
      return;
    }

    // ── email.open ─────────────────────────────────────────────────────────
    if ("openedAt" in event) {
      const opens = typeof event.opens === "number" ? event.opens : 1;
      const isFirst = event.isFirstOpen === true;
      logger.info("Event: email opened", { action: "event_open", contactEmail, emailId, opens, isFirst: event.isFirstOpen });
      if (emailId) {
        const existing = await getEmailByPlunkId(emailId);
        if (existing) {
          const patch = {
            ...(canAdvance(existing.deliveryStatus, "opened") && { deliveryStatus: "opened" }),
            openCount: Math.max(opens, existing.openCount),
            ...(isFirst && !existing.firstOpenedAt && { firstOpenedAt: String(event.openedAt) }),
          };
          const updated = await updateEmailByPlunkId(emailId, patch);
          if (updated) sseEmit("email-updated", { id: updated.id, ...patch });
        }
      }
      return;
    }

    // ── email.click ────────────────────────────────────────────────────────
    if ("clickedAt" in event) {
      const clicks = typeof event.clicks === "number" ? event.clicks : 1;
      const isFirst = event.isFirstClick === true;
      logger.info("Event: link clicked", { action: "event_click", contactEmail, emailId, clicks, link: event.link });
      if (emailId) {
        const existing = await getEmailByPlunkId(emailId);
        if (existing) {
          const patch = {
            ...(canAdvance(existing.deliveryStatus, "clicked") && { deliveryStatus: "clicked" }),
            clickCount: Math.max(clicks, existing.clickCount),
            ...(isFirst && !existing.firstClickedAt && { firstClickedAt: String(event.clickedAt) }),
          };
          const updated = await updateEmailByPlunkId(emailId, patch);
          if (updated) sseEmit("email-updated", { id: updated.id, ...patch });
        }
      }
      return;
    }

    // ── email.bounce ───────────────────────────────────────────────────────
    if ("bounceType" in event) {
      const isPermanent = event.bounceType === "Permanent";
      logger.warn("Event: email bounced", { action: "event_bounce", contactEmail, emailId, permanent: isPermanent });

      if (isPermanent) {
        if (emailId) {
          const existing = await getEmailByPlunkId(emailId);
          const alreadyBounced = existing?.deliveryStatus === "bounced";
          const patch = {
            deliveryStatus: "bounced",
            bouncedAt: String(event.bouncedAt ?? new Date().toISOString()),
          };
          const updated = await updateEmailByPlunkId(emailId, patch);
          if (updated) sseEmit("email-updated", { id: updated.id, ...patch });

          if (!alreadyBounced) {
            if (contactEmail) {
              await markContactBounced(contactEmail).catch(() => null);
            }
            const subject = event.subject ? String(event.subject) : "(unknown subject)";
            await sendBounceNotification(contactEmail, subject).catch((err) =>
              logger.warn("Event: bounce notification failed", { action: "event_bounce_notify", error: (err as Error).message })
            );
          }
        } else if (contactEmail) {
          await markContactBounced(contactEmail).catch(() => null);
        }
      }
      // Soft bounces: just log — no status change, contact stays subscribed
      return;
    }

    // ── email.complaint ────────────────────────────────────────────────────
    if ("complainedAt" in event) {
      logger.warn("Event: spam complaint", { action: "event_complaint", contactEmail, emailId });
      if (emailId) {
        const updated = await updateEmailByPlunkId(emailId, { deliveryStatus: "complained" });
        if (updated) sseEmit("email-updated", { id: updated.id, deliveryStatus: "complained" });
      }
      if (contactEmail) {
        await markContactComplained(contactEmail).catch(() => null);
      }
      return;
    }

    logger.warn("Event: unrecognised payload", { action: "event_unknown", payload: JSON.stringify(event).slice(0, 200) });
  } catch (err) {
    logger.error("Event: unhandled error", { action: "event_error", ...describeError(err) });
  }
}

router.post("/events", eventsHandler);
router.post("/outbound", eventsHandler); // alias for backwards compat

// ── Helpers ───────────────────────────────────────────────────────────────────

function canAdvance(current: string, next: string): boolean {
  return (STATUS_RANK[next] ?? 0) > (STATUS_RANK[current] ?? 0);
}

function parseSenderName(header: string): string {
  const match = header.match(/^([^<]+)<[^>]+>/);
  if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  return header.trim();
}

async function sendBounceNotification(recipientEmail: string, originalSubject: string): Promise<void> {
  const to = process.env.PLUNK_FROM_EMAIL;
  if (!to) return;

  await sendEmail({
    to,
    subject: `Delivery failure: "${originalSubject}"`,
    body: `
<p>Your email <strong>"${originalSubject}"</strong> could not be delivered.</p>
<p>The address <strong>${recipientEmail}</strong> does not exist or has been permanently deactivated.</p>
<p>No further delivery attempts will be made.</p>
<hr>
<p style="color:#888;font-size:12px;">This is an automated delivery failure notification from Reclear.</p>
    `.trim(),
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlunkInboundPayload {
  contact?: { email: string };
  workflow?: { id: string; name: string };
  execution?: { id: string };
  event?: {
    messageId: string;
    from: string;
    fromHeader?: string;
    to: string;
    recipients?: string[];
    subject: string;
    timestamp?: string;
    body?: string;
    hasContent?: boolean;
    spamVerdict?: string;
    virusVerdict?: string;
    spfVerdict?: string;
    dkimVerdict?: string;
    dmarcVerdict?: string;
  };
}

interface PlunkEventPayload {
  contact?: {
    email: string;
    subscribed?: boolean;
    data?: Record<string, unknown>;
  };
  workflow?: { id: string; name: string };
  execution?: { id: string; startedAt?: string };
  event?: Record<string, unknown>;
}

export default router;
