import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { searchContacts } from "../lib/contacts";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json({ success: true, data: [] });
    const results = await searchContacts(q);
    res.json({ success: true, data: results });
  } catch (err) {
    console.error("[contacts]", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
