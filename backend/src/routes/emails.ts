import { Router } from "express";
import multer from "multer";
import { sendEmail } from "../lib/plunk";
import { scanBuffer } from "../lib/scanner";
import { checkUrlSafety } from "../lib/safe-browsing";
import { htmlToText } from "../lib/html-to-text";
import { upsertContact } from "../lib/contacts";
import {
  listEmails,
  getEmail,
  updateEmail,
  deleteEmail,
  addEmail,
  type StoredEmail,
} from "../lib/store";
import { requireAuth } from "../middleware/auth";
import { addSseClient, removeSseClient, sseEmit } from "../lib/sse";
import { logger, describeError } from "../lib/logger";

const router = Router();
router.use(requireAuth);

// ── SSE stream ────────────────────────────────────────────────────────────────

router.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  addSseClient(res);

  // Heartbeat every 25 s to prevent proxy/load-balancer timeouts
  const heartbeat = setInterval(() => {
    try {
      res.write(":\n\n");
      (res as unknown as { flush?: () => void }).flush?.();
    } catch {
      clearInterval(heartbeat);
      removeSseClient(res);
    }
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeSseClient(res);
  });
});

// Multer: accept up to 10 files, 10 MB total (mirrors Plunk limits)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 10, fileSize: 10 * 1024 * 1024 },
});

// ── Save draft ───────────────────────────────────────────────────────────────

router.post("/draft", async (req, res) => {
  const { to, subject, body } = req.body as {
    to?: string[];
    subject?: string;
    body?: string;
  };

  const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const draft: StoredEmail = {
    id,
    messageId: id,
    threadId: `t-${id}`,
    from: { name: req.user!.name || req.user!.email.split("@")[0], email: req.user!.email },
    to: (to ?? []).map((addr) => ({ name: addr, email: addr })),
    subject: subject?.trim() || "(no subject)",
    body: body ?? "",
    preview: htmlToText(body ?? "").slice(0, 120),
    date: new Date().toISOString(),
    folder: "drafts",
    category: "primary",
    read: true,
    starred: false,
    tagIds: [],
    hasAttachments: false,
    threatUrls: [],
    deliveryStatus: "pending",
    openCount: 0,
    clickCount: 0,
  };

  await addEmail(draft);
  res.status(201).json({ success: true, data: draft });
});

// ── Update draft ─────────────────────────────────────────────────────────────

router.patch("/draft/:id", async (req, res) => {
  const { id } = req.params;
  const { to, subject, body } = req.body as { to?: string[]; subject?: string; body?: string };

  const updated = await updateEmail(id, {
    to: (to ?? []).map((addr) => ({ name: addr, email: addr })),
    subject: subject?.trim() || "(no subject)",
    body: body ?? "",
    preview: htmlToText(body ?? "").slice(0, 120),
    date: new Date().toISOString(),
  });

  if (!updated) return res.status(404).json({ success: false, error: "Draft not found" });
  res.json({ success: true, data: updated });
});

// ── List ─────────────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  const { folder, category, tag, unread, starred } = req.query;
  const results = await listEmails({
    folder: folder as string | undefined,
    category: category as string | undefined,
    tagId: tag as string | undefined,
    unread: unread === "true" ? true : undefined,
    starred: starred === "true" ? true : undefined,
    userEmail: req.user!.email,
  });
  res.json({ success: true, data: results });
});

// ── Get single ───────────────────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  const email = await getEmail(req.params.id);
  if (!email) return res.status(404).json({ success: false, error: "Not found" });
  res.json({ success: true, data: email });
});

// ── Send (with optional attachments) ─────────────────────────────────────────
//
// Accepts multipart/form-data with:
//   to[]         — one or more recipient addresses
//   subject      — string
//   body         — HTML string
//   from         — optional sender address
//   reply        — optional reply-to address
//   files        — up to 10 attached files
//
// Or application/json (no attachments):
//   { to, subject, body, from?, reply? }

router.post(
  "/send",
  upload.array("files", 10),
  async (req, res) => {
    try {
      // Support both JSON and multipart
      const isJson = req.is("application/json");
      const body = isJson ? req.body : req.body;

      const to: string[] = Array.isArray(body.to)
        ? body.to
        : typeof body.to === "string"
        ? [body.to]
        : [];

      const { subject, body: htmlBody, from, reply, override, threadId } = body as {
        subject?: string;
        body?: string;
        from?: string;
        reply?: string;
        override?: string;
        threadId?: string;
      };

      if (!to.length || !subject || !htmlBody) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: to, subject, body",
        });
      }

      // ── URL safety check — block unless user overrides ────────────────────
      if (override !== "true" && process.env.GOOGLE_SAFE_BROWSING_API_KEY) {
        const threats = await checkUrlSafety(htmlBody);
        if (threats.length > 0) {
          console.warn(`[send] blocked outgoing email with dangerous URLs: ${threats.map((t) => t.url).join(", ")}`);
          return res.status(400).json({
            success: false,
            threatBlocked: true,
            error: "This email contains URLs flagged as dangerous by Google Safe Browsing",
            threats,
          });
        }
      }

      // Scan and convert uploaded files to Plunk attachment format (base64)
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];

      for (const f of files) {
        const scan = await scanBuffer(f.buffer, f.originalname);
        if (!scan.isClean) {
          const summary = scan.threats
            .map((t) => `${t.type} (${t.severity}): ${t.description}`)
            .join("; ");
          console.warn(`[send] blocked infected file "${f.originalname}": ${summary}`);
          return res.status(400).json({
            success: false,
            error: `File "${f.originalname}" failed security scan`,
            threats: scan.threats,
          });
        }
      }

      const attachments = files.map((f) => ({
        filename: f.originalname,
        content: f.buffer.toString("base64"),
        mimeType: f.mimetype,
      }));

      const senderEmail = req.user!.email;
      const senderName = req.user!.name || senderEmail.split("@")[0];

      // Use the sender's own address if it's on the Plunk-verified domain; otherwise
      // fall back to the shared notification address (external logins, etc.)
      const plunkFrom = process.env.PLUNK_FROM_EMAIL ?? "noreply@team.reclear.io";
      const verifiedDomain = plunkFrom.split("@")[1];
      const fromEmail = (verifiedDomain && senderEmail.endsWith(`@${verifiedDomain}`))
        ? senderEmail
        : plunkFrom;

      const result = await sendEmail({
        to,
        subject,
        body: htmlBody,
        from: from ?? { name: senderName, email: fromEmail },
        reply: reply ?? senderEmail,
        ...(attachments.length && { attachments }),
      });

      if (!result.success) {
        logger.error("Email send failed", { action: "email_send", userEmail: senderEmail, to, subject, error: result.error });
        return res.status(502).json({ success: false, error: result.error });
      }

      const plunkEmailId = result.data?.emails[0]?.email;
      const emailId = `sent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const sentEmail: StoredEmail = {
        id: emailId,
        messageId: emailId,
        threadId: threadId ?? `t-sent-${Date.now()}`,
        from: { name: senderName, email: senderEmail },
        to: to.map((addr) => ({ name: addr, email: addr })),
        subject,
        body: htmlBody,
        preview: htmlToText(htmlBody).slice(0, 120),
        date: new Date().toISOString(),
        folder: "sent",
        category: "primary",
        read: true,
        starred: false,
        tagIds: [],
        hasAttachments: attachments.length > 0,
        threatUrls: [],
        plunkEmailId,
        deliveryStatus: "pending",
        openCount: 0,
        clickCount: 0,
      };
      await addEmail(sentEmail);
      sseEmit("new-email", sentEmail);

      logger.info("Email sent", { action: "email_send", userId: req.user!.sub, userEmail: senderEmail, to, subject, plunkEmailId, emailId });

      // Upsert each recipient as a contact (async, don't block response)
      setImmediate(() => {
        for (const addr of to) {
          upsertContact(addr.toLowerCase().trim()).catch(() => null);
        }
      });

      res.json({ success: true, data: result.data });
    } catch (err) {
      logger.error("Email send error", { action: "email_send", userEmail: req.user?.email, ...describeError(err) });
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);

// ── Mark read/unread ──────────────────────────────────────────────────────────

router.patch("/:id/read", async (req, res) => {
  const { read } = req.body as { read?: boolean };
  const updated = await updateEmail(req.params.id, { read: read ?? true });
  if (!updated) return res.status(404).json({ success: false, error: "Not found" });
  sseEmit("email-updated", { id: updated.id, read: updated.read });
  res.json({ success: true, data: updated });
});

// ── Star ──────────────────────────────────────────────────────────────────────

router.patch("/:id/star", async (req, res) => {
  const email = await getEmail(req.params.id);
  if (!email) return res.status(404).json({ success: false, error: "Not found" });
  const updated = await updateEmail(req.params.id, { starred: !email.starred });
  if (updated) sseEmit("email-updated", { id: updated.id, starred: updated.starred });
  res.json({ success: true, data: updated });
});

// ── Move ──────────────────────────────────────────────────────────────────────

router.patch("/:id/move", async (req, res) => {
  const { folder, category } = req.body as { folder?: string; category?: string };
  if (!folder && !category) return res.status(400).json({ success: false, error: "folder or category required" });
  const patch: Record<string, string> = {};
  if (folder) patch.folder = folder;
  if (category) patch.category = category;
  const updated = await updateEmail(req.params.id, patch);
  if (!updated) return res.status(404).json({ success: false, error: "Not found" });
  sseEmit("email-updated", { id: updated.id, folder: updated.folder, category: updated.category });
  res.json({ success: true, data: updated });
});

// ── Tags ──────────────────────────────────────────────────────────────────────

router.patch("/:id/tags", async (req, res) => {
  const { tagIds } = req.body as { tagIds?: string[] };
  if (!Array.isArray(tagIds)) return res.status(400).json({ success: false, error: "tagIds must be array" });
  const updated = await updateEmail(req.params.id, { tagIds });
  if (!updated) return res.status(404).json({ success: false, error: "Not found" });
  sseEmit("email-updated", { id: updated.id, tagIds: updated.tagIds });
  res.json({ success: true, data: updated });
});

// ── Delete ────────────────────────────────────────────────────────────────────

router.delete("/:id", async (req, res) => {
  const ok = await deleteEmail(req.params.id);
  if (!ok) return res.status(404).json({ success: false, error: "Not found" });
  sseEmit("email-deleted", { id: req.params.id });
  res.status(204).send();
});

export default router;
