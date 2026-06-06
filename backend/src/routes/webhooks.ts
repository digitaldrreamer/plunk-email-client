import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { tags } from "../db/schema";
import { addEmail, updateEmailByPlunkId, getEmailByPlunkId, type StoredEmail } from "../lib/store";
import { sseEmit } from "../lib/sse";
import { isHardFail, postmarkSpamScore, isSpam, type Verdict } from "../lib/spam";
import { categorizeEmail } from "../lib/mistral";
import { checkUrlSafety } from "../lib/safe-browsing";
import { upsertContact, markContactBounced, markContactComplained } from "../lib/contacts";
import { sendEmail } from "../lib/plunk";

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
      console.log(`[inbound] dropped spam: ${event.messageId}`);
      return res.status(200).json({ status: "dropped: spam verdict" });
    }
    if (isHardFail(event.virusVerdict as Verdict)) {
      console.log(`[inbound] dropped virus: ${event.messageId}`);
      return res.status(200).json({ status: "dropped: virus verdict" });
    }

    const rawForSpam = `From: ${event.fromHeader ?? event.from}\nSubject: ${event.subject}\n\n${event.body ?? ""}`;
    const score = await postmarkSpamScore(rawForSpam);
    if (isSpam(score)) {
      console.log(`[inbound] dropped spam score ${score}: ${event.messageId}`);
      return res.status(200).json({ status: "dropped: spam score", score });
    }

    const senderName = parseSenderName(event.fromHeader ?? event.from);
    const bodyText = (event.body ?? "").replace(/<[^>]+>/g, "").trim();

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
          const [exists] = await db.select({ id: tags.id }).from(tags).where(eq(tags.id, id)).limit(1);
          if (!exists) await db.insert(tags).values({ id, name: nt.name, color: nt.color });
          if (!tagIds.includes(id)) tagIds.push(id);
        }
      } catch (err) {
        console.warn("[inbound] categorization failed:", (err as Error).message);
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

    await addEmail(email);
    sseEmit("new-email", email);
    console.log(`[inbound] stored ${emailId} from ${event.from} (${category})`);

    // Ack immediately — heavy work runs after
    res.status(200).json({ status: "ok", id: emailId });

    setImmediate(async () => {
      try {
        await upsertContact(event.from.toLowerCase(), senderName);
      } catch (err) {
        console.warn("[inbound] contact upsert failed:", (err as Error).message);
      }
      try {
        const threats = await checkUrlSafety(email.body);
        if (threats.length > 0) {
          const threatUrlList = threats.map((t) => t.url);
          await updateEmailByPlunkId(emailId, { category: "dangerous", threatUrls: threatUrlList });
          sseEmit("email-updated", { id: emailId, category: "dangerous", threatUrls: threatUrlList });
          console.log(`[inbound] dangerous URLs in ${emailId}: ${threatUrlList.join(", ")}`);
        }
      } catch (err) {
        console.warn("[inbound] URL safety check failed:", (err as Error).message);
      }
    });
  } catch (err) {
    console.error("[inbound]", err);
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
      console.log(`[event] sent → ${contactEmail} emailId=${emailId}`);
      if (emailId) await updateEmailByPlunkId(emailId, { deliveryStatus: "sent" });
      return;
    }

    // ── email.delivery ─────────────────────────────────────────────────────
    if ("deliveredAt" in event) {
      console.log(`[event] delivered → ${contactEmail} emailId=${emailId}`);
      if (emailId) {
        await updateEmailByPlunkId(emailId, {
          deliveryStatus: "delivered",
          deliveredAt: String(event.deliveredAt),
        });
      }
      return;
    }

    // ── email.open ─────────────────────────────────────────────────────────
    if ("openedAt" in event) {
      const opens = typeof event.opens === "number" ? event.opens : 1;
      const isFirst = event.isFirstOpen === true;
      console.log(`[event] open #${opens} → ${contactEmail} emailId=${emailId}`);
      if (emailId) {
        await updateEmailByPlunkId(emailId, {
          deliveryStatus: "opened",
          openCount: opens,
          ...(isFirst && { firstOpenedAt: String(event.openedAt) }),
        });
      }
      return;
    }

    // ── email.click ────────────────────────────────────────────────────────
    if ("clickedAt" in event) {
      const clicks = typeof event.clicks === "number" ? event.clicks : 1;
      const isFirst = event.isFirstClick === true;
      console.log(`[event] click #${clicks} → ${contactEmail} link=${event.link ?? ""}`);
      if (emailId) {
        await updateEmailByPlunkId(emailId, {
          deliveryStatus: "clicked",
          clickCount: clicks,
          ...(isFirst && { firstClickedAt: String(event.clickedAt) }),
        });
      }
      return;
    }

    // ── email.bounce ───────────────────────────────────────────────────────
    if ("bounceType" in event) {
      const isPermanent = event.bounceType === "Permanent";
      console.log(`[event] bounce (${isPermanent ? "hard" : "soft"}) → ${contactEmail}`);

      if (isPermanent) {
        if (emailId) {
          await updateEmailByPlunkId(emailId, {
            deliveryStatus: "bounced",
            bouncedAt: String(event.bouncedAt ?? new Date().toISOString()),
          });
        }
        if (contactEmail) {
          await markContactBounced(contactEmail).catch(() => null);
        }

        // Notify system that the email bounced
        const subject = event.subject ? String(event.subject) : "(unknown subject)";
        await sendBounceNotification(contactEmail, subject).catch((err) =>
          console.warn("[event] bounce notification failed:", (err as Error).message)
        );
      }
      // Soft bounces: just log — no status change, contact stays subscribed
      return;
    }

    // ── email.complaint ────────────────────────────────────────────────────
    if ("complainedAt" in event) {
      console.log(`[event] complaint → ${contactEmail}`);
      if (emailId) {
        await updateEmailByPlunkId(emailId, { deliveryStatus: "complained" });
      }
      if (contactEmail) {
        await markContactComplained(contactEmail).catch(() => null);
      }
      return;
    }

    console.log("[event] unrecognised payload:", JSON.stringify(event).slice(0, 200));
  } catch (err) {
    console.error("[events]", err);
  }
}

router.post("/events", eventsHandler);
router.post("/outbound", eventsHandler); // alias for backwards compat

// ── Helpers ───────────────────────────────────────────────────────────────────

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
