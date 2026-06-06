import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { searchContacts, listContacts, setContactSubscribed } from "../lib/contacts";

const router = Router();
router.use(requireAuth);

// GET /api/contacts?q=&page=
router.get("/", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = 50;
    const offset = (page - 1) * limit;

    if (q) {
      const results = await searchContacts(q);
      return res.json({ success: true, data: { items: results, total: results.length } });
    }

    const { items, total } = await listContacts(offset, limit);
    res.json({ success: true, data: { items, total } });
  } catch (err) {
    console.error("[contacts]", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// PATCH /api/contacts/:email/subscribe
router.patch("/:email/subscribe", async (req, res) => {
  try {
    const { subscribed } = req.body as { subscribed: boolean };
    await setContactSubscribed(req.params.email, !!subscribed);
    res.json({ success: true });
  } catch (err) {
    console.error("[contacts patch]", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
