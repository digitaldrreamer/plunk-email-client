import { Router } from "express";
import type { Tag } from "../types";

const router = Router();

const tags: Tag[] = [
  { id: "work", name: "Work", color: "blue" },
  { id: "personal", name: "Personal", color: "green" },
  { id: "finance", name: "Finance", color: "orange" },
  { id: "important", name: "Important", color: "red" },
  { id: "travel", name: "Travel", color: "cyan" },
  { id: "product", name: "Product", color: "purple" },
  { id: "design", name: "Design", color: "pink" },
  { id: "legal", name: "Legal", color: "yellow" },
];

router.get("/", (_req, res) => {
  res.json(tags);
});

router.post("/", (req, res) => {
  const { name, color } = req.body;
  if (!name || !color) {
    return res.status(400).json({ error: "name and color are required" });
  }
  const tag: Tag = {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    color,
  };
  tags.push(tag);
  return res.status(201).json(tag);
});

router.delete("/:id", (req, res) => {
  const index = tags.findIndex((t) => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Tag not found" });
  tags.splice(index, 1);
  return res.status(204).send();
});

export default router;
