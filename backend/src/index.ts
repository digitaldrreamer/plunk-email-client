import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { tags } from "./db/schema";
import emailsRouter from "./routes/emails";
import tagsRouter from "./routes/tags";
import webhooksRouter from "./routes/webhooks";
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import aiRouter from "./routes/ai";
import contactsRouter from "./routes/contacts";
import { requestLogger } from "./lib/logger";

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  "https://mail.reclear.io",
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (health checks, server-to-server calls)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: "512kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/emails", emailsRouter);
app.use("/api/tags", tagsRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/ai", aiRouter);
app.use("/api/contacts", contactsRouter);

// ── Seed on first boot ────────────────────────────────────────────────────────

async function seedTags() {
  const existing = await db.select({ id: tags.id }).from(tags);
  if (existing.length > 0) return;
  await db.insert(tags).values([
    { id: "work", name: "Work", color: "blue" },
    { id: "personal", name: "Personal", color: "green" },
    { id: "finance", name: "Finance", color: "orange" },
    { id: "important", name: "Important", color: "red" },
    { id: "travel", name: "Travel", color: "cyan" },
    { id: "product", name: "Product", color: "purple" },
    { id: "design", name: "Design", color: "pink" },
    { id: "legal", name: "Legal", color: "yellow" },
  ]);
  console.log("✅  Seeded default tags");
}

app.listen(PORT, async () => {
  console.log(`reclear-email backend running on http://localhost:${PORT}`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS signature text`);
  await seedTags();

  if (!process.env.PLUNK_SECRET_KEY) console.warn("⚠  PLUNK_SECRET_KEY not set — email sending will fail");
  if (!process.env.PLUNK_INBOUND_SECRET) console.warn("⚠  PLUNK_INBOUND_SECRET not set — inbound webhook auth disabled");
  if (!process.env.JWT_SECRET) console.warn("⚠  JWT_SECRET not set — auth will not work");
  if (!process.env.MISTRAL_API_KEY) console.warn("⚠  MISTRAL_API_KEY not set — AI features disabled");
  if (!process.env.GOOGLE_SAFE_BROWSING_API_KEY) console.warn("⚠  GOOGLE_SAFE_BROWSING_API_KEY not set — URL safety checks disabled");
  if (!process.env.PLUNK_WEBHOOK_SECRET) console.warn("⚠  PLUNK_WEBHOOK_SECRET not set — outbound event webhook auth disabled");
});
