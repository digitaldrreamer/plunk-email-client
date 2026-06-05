import { Router } from "express";
import type { Email, Folder } from "../types";

const router = Router();

// GET /emails?folder=inbox&category=primary&tag=work&unread=true&starred=true
router.get("/", (req, res) => {
  const { folder, category, tag, unread, starred } = req.query;
  // In a real app, query the database here
  res.json({
    message: "List emails",
    filters: { folder, category, tag, unread, starred },
  });
});

router.get("/:id", (req, res) => {
  res.json({ message: "Get email", id: req.params.id });
});

router.post("/", (req, res) => {
  const email: Partial<Email> = req.body;
  res.status(201).json({ message: "Email created", email });
});

router.patch("/:id/read", (req, res) => {
  res.json({ message: "Marked as read", id: req.params.id });
});

router.patch("/:id/star", (req, res) => {
  res.json({ message: "Star toggled", id: req.params.id });
});

router.patch("/:id/move", (req, res) => {
  const { folder } = req.body as { folder: Folder };
  res.json({ message: "Email moved", id: req.params.id, folder });
});

router.patch("/:id/tags", (req, res) => {
  const { tagIds } = req.body as { tagIds: string[] };
  res.json({ message: "Tags updated", id: req.params.id, tagIds });
});

router.delete("/:id", (req, res) => {
  res.status(204).send();
});

export default router;
