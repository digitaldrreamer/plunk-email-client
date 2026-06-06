import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { fixEmailSpelling, composeFromThread } from "../lib/mistral";

const router = Router();
router.use(requireAuth);

// ── POST /api/ai/fix-spelling ─────────────────────────────────────────────────
//
// Body: { html: string }
// Returns: { corrected, changeCount, changes }

router.post("/fix-spelling", async (req, res) => {
  const { html } = req.body as { html?: string };
  if (!html?.trim()) {
    return res.status(400).json({ success: false, error: "html is required" });
  }

  if (!process.env.MISTRAL_API_KEY) {
    return res.status(503).json({ success: false, error: "AI not configured" });
  }

  try {
    const result = await fixEmailSpelling(html);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("[ai/fix-spelling]", err);
    res.status(500).json({ success: false, error: "Failed to process" });
  }
});

// ── POST /api/ai/compose ──────────────────────────────────────────────────────
//
// Body:
//   subject:     string          — thread subject
//   messages:    { from, date, body }[]  — thread messages (plain text bodies)
//   instruction: string          — what to write / how to reply
//
// Returns: { subject, body }

router.post("/compose", async (req, res) => {
  const { subject, messages, instruction } = req.body as {
    subject?: string;
    messages?: { from: string; date: string; body: string }[];
    instruction?: string;
  };

  if (!instruction?.trim()) {
    return res.status(400).json({ success: false, error: "instruction is required" });
  }
  if (!process.env.MISTRAL_API_KEY) {
    return res.status(503).json({ success: false, error: "AI not configured" });
  }

  try {
    const result = await composeFromThread(
      { subject: subject ?? "", messages: messages ?? [] },
      instruction,
      req.user!.email.split("@")[0],
      req.user!.email
    );
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("[ai/compose]", err);
    res.status(500).json({ success: false, error: "Failed to generate" });
  }
});

export default router;
