#!/usr/bin/env tsx
/**
 * Create an admin user.
 *
 * Usage (interactive):
 *   npx tsx scripts/create-admin.ts
 *
 * Usage (non-interactive / CI):
 *   npx tsx scripts/create-admin.ts --name "Alice" --email alice@example.com --password secret123
 */

import "dotenv/config";
import { createInterface } from "readline";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { users } from "../src/db/schema";
import { hashPassword, generateId } from "../src/lib/auth";

// ── Helpers ──────────────────────────────────────────────────────────────────

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

function prompt(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

function promptPassword(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    // Hide input when stdin is a TTY
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    let input = "";
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const onData = (ch: string) => {
      if (ch === "\n" || ch === "\r" || ch === "") {
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        process.stdout.write("\n");
        if (ch === "") process.exit(1);
        resolve(input);
      } else if (ch === "") {
        input = input.slice(0, -1);
      } else {
        input += ch;
      }
    };
    process.stdin.on("data", onData);
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let name = arg("--name");
  let email = arg("--email");
  let password = arg("--password");
  let role = (arg("--role") ?? "admin") as "admin" | "user";

  const interactive = !name || !email || !password;

  if (interactive) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log("\n  reclear — create admin\n");

    if (!name) name = (await prompt(rl, "  Name:     ")).trim();
    if (!email) email = (await prompt(rl, "  Email:    ")).trim().toLowerCase();
    rl.close();
    if (!password) password = await promptPassword("  Password: ");
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  if (!name || !email || !password) {
    console.error("  ✗  name, email, and password are all required");
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("  ✗  invalid email address");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("  ✗  password must be at least 8 characters");
    process.exit(1);
  }
  if (role !== "admin" && role !== "user") {
    console.error('  ✗  --role must be "admin" or "user"');
    process.exit(1);
  }

  // ── Check for duplicate ───────────────────────────────────────────────────
  const [existing] = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, email)).limit(1);

  if (existing) {
    console.error(`  ✗  a user with email "${email}" already exists`);
    process.exit(1);
  }

  // ── Insert ────────────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const [created] = await db.insert(users).values({
    id: generateId(),
    name,
    email,
    passwordHash: hashPassword(password),
    recoveryEmail: null,
    role,
    disabled: false,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  }).returning({ id: users.id, name: users.name, email: users.email, role: users.role });

  console.log(`\n  ✓  Created ${created.role}: ${created.name} <${created.email}> (id: ${created.id})\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("  ✗ ", err.message ?? err);
  process.exit(1);
});
