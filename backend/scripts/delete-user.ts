#!/usr/bin/env tsx
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { users } from "../src/db/schema";

async function main() {
  const email = process.argv[2];
  if (!email) { console.error("Usage: delete-user.ts <email>"); process.exit(1); }
  const [deleted] = await db.delete(users).where(eq(users.email, email)).returning({ id: users.id, email: users.email });
  console.log(deleted ? `Deleted: ${deleted.email} (${deleted.id})` : `Not found: ${email}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
