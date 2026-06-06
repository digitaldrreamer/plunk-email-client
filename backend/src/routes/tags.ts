import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { tags } from "../db/schema";

const router = Router();

router.get("/", async (_req, res) => {
  const all = await db.select().from(tags);
  res.json(all);
});

router.post("/", async (req, res) => {
  const { name, color } = req.body as { name?: string; color?: string };
  if (!name || !color) {
    return res.status(400).json({ error: "name and color are required" });
  }
  const tag = { id: name.toLowerCase().replace(/\s+/g, "-"), name, color };
  try {
    await db.insert(tags).values(tag);
  } catch {
    return res.status(409).json({ error: "Tag already exists" });
  }
  return res.status(201).json(tag);
});

router.delete("/:id", async (req, res) => {
  const [exists] = await db.select({ id: tags.id }).from(tags)
    .where(eq(tags.id, req.params.id)).limit(1);
  if (!exists) return res.status(404).json({ error: "Tag not found" });
  await db.delete(tags).where(eq(tags.id, req.params.id));
  return res.status(204).send();
});

export default router;
