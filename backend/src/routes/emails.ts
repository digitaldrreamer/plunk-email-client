import { Router } from "express";
import multer from "multer";
import { sendEmail } from "../lib/plunk";
import { scanBuffer } from "../lib/scanner";
import { checkUrlSafety } from "../lib/safe-browsing";
import { upsertContact } from "../lib/contacts";
import {
  listEmails,
  getEmail,
  updateEmail,
  deleteEmail,
  addEmail,
  type StoredEmail,
} from "../lib/store";


const router = Router();

// Multer: accept up to 10 files, 10 MB total (mirrors Plunk limits)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 10, fileSize: 10 * 1024 * 1024 },
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

      const { subject, body: htmlBody, from, reply, override } = body as {
        subject?: string;
        body?: string;
        from?: string;
        reply?: string;
        override?: string;
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

      const result = await sendEmail({
        to,
        subject,
        body: htmlBody,
        ...(from && { from }),
        ...(reply && { reply }),
        ...(attachments.length && { attachments }),
      });

      if (!result.success) {
        return res.status(502).json({ success: false, error: result.error });
      }

      // Log the sent email in the store
      const plunkEmailId = result.data?.emails[0]?.email;
      const emailId = `sent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const sentEmail: StoredEmail = {
        id: emailId,
        messageId: emailId,
        threadId: `t-sent-${Date.now()}`,
        from: { name: "Me", email: process.env.PLUNK_FROM_EMAIL ?? "me@reclear.io" },
        to: to.map((addr) => ({ name: addr, email: addr })),
        subject,
        body: htmlBody,
        preview: htmlBody.replace(/<[^>]+>/g, "").slice(0, 120),
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

      // Upsert each recipient as a contact (async, don't block response)
      setImmediate(() => {
        for (const addr of to) {
          upsertContact(addr.toLowerCase().trim()).catch(() => null);
        }
      });

      res.json({ success: true, data: result.data });
    } catch (err) {
      console.error("[send]", err);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);

// ── Mark read/unread ──────────────────────────────────────────────────────────

router.patch("/:id/read", async (req, res) => {
  const { read } = req.body as { read?: boolean };
  const updated = await updateEmail(req.params.id, { read: read ?? true });
  if (!updated) return res.status(404).json({ success: false, error: "Not found" });
  res.json({ success: true, data: updated });
});

// ── Star ──────────────────────────────────────────────────────────────────────

router.patch("/:id/star", async (req, res) => {
  const email = await getEmail(req.params.id);
  if (!email) return res.status(404).json({ success: false, error: "Not found" });
  const updated = await updateEmail(req.params.id, { starred: !email.starred });
  res.json({ success: true, data: updated });
});

// ── Move ──────────────────────────────────────────────────────────────────────

router.patch("/:id/move", async (req, res) => {
  const { folder } = req.body as { folder?: string };
  if (!folder) return res.status(400).json({ success: false, error: "folder required" });
  const updated = await updateEmail(req.params.id, { folder });
  if (!updated) return res.status(404).json({ success: false, error: "Not found" });
  res.json({ success: true, data: updated });
});

// ── Tags ──────────────────────────────────────────────────────────────────────

router.patch("/:id/tags", async (req, res) => {
  const { tagIds } = req.body as { tagIds?: string[] };
  if (!Array.isArray(tagIds)) return res.status(400).json({ success: false, error: "tagIds must be array" });
  const updated = await updateEmail(req.params.id, { tagIds });
  if (!updated) return res.status(404).json({ success: false, error: "Not found" });
  res.json({ success: true, data: updated });
});

// ── Delete ────────────────────────────────────────────────────────────────────

router.delete("/:id", async (req, res) => {
  const ok = await deleteEmail(req.params.id);
  if (!ok) return res.status(404).json({ success: false, error: "Not found" });
  res.status(204).send();
});

export default router;
