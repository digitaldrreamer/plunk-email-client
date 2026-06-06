#!/usr/bin/env tsx
/**
 * Create an admin user and send an invite email to their recovery address.
 *
 * Usage (non-interactive / CI):
 *   npx tsx scripts/create-admin.ts \
 *     --name "Alice" \
 *     --email alice@reclear.io \
 *     --recovery-email alice@gmail.com \
 *     [--role admin|user]
 *
 * Usage (interactive):
 *   npx tsx scripts/create-admin.ts
 */

import "dotenv/config";
import { createInterface } from "readline";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { users } from "../src/db/schema";
import {
  hashPassword,
  generateId,
  generateOneTimePassword,
} from "../src/lib/auth";
import { sendEmail } from "../src/lib/plunk";

// ── Helpers ──────────────────────────────────────────────────────────────────

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

function prompt(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let name          = arg("--name");
  let email         = arg("--email");
  let recoveryEmail = arg("--recovery-email");
  const role        = (arg("--role") ?? "admin") as "admin" | "user";

  if (!name || !email || !recoveryEmail) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log("\n  reclear — create admin\n");
    if (!name)          name          = (await prompt(rl, "  Name:           ")).trim();
    if (!email)         email         = (await prompt(rl, "  Email:          ")).trim().toLowerCase();
    if (!recoveryEmail) recoveryEmail = (await prompt(rl, "  Recovery email: ")).trim().toLowerCase();
    rl.close();
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!name || !email || !recoveryEmail) {
    console.error("  ✗  name, email, and recovery-email are all required");
    process.exit(1);
  }
  if (!emailRe.test(email)) {
    console.error("  ✗  invalid email address");
    process.exit(1);
  }
  if (!emailRe.test(recoveryEmail)) {
    console.error("  ✗  invalid recovery email address");
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
  const oneTimePassword = generateOneTimePassword();
  const now = new Date().toISOString();

  const [created] = await db.insert(users).values({
    id: generateId(),
    name,
    email,
    passwordHash: hashPassword(oneTimePassword),
    recoveryEmail,
    role,
    disabled: false,
    mustChangePassword: true,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  }).returning({ id: users.id, name: users.name, email: users.email, role: users.role });

  // ── Send invite email ─────────────────────────────────────────────────────
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

  const sent = await sendEmail({
    to: recoveryEmail,
    subject: `You've been invited to Reclear`,
    body: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
  <h2 style="margin-bottom:4px;">You're in.</h2>
  <p style="color:#6b7280;margin-top:0;">You have been added to Reclear as <strong>${role}</strong>.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
  <p>Your login details:</p>
  <table style="border-collapse:collapse;width:100%;">
    <tr><td style="padding:6px 0;color:#6b7280;width:120px;">Email</td><td style="font-weight:600;">${email}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">Temp password</td><td><code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:14px;">${oneTimePassword}</code></td></tr>
  </table>
  <p style="color:#6b7280;font-size:13px;margin-top:4px;">You'll be asked to set a new password on your first login.</p>
  <a href="${frontendUrl}" style="display:inline-block;margin-top:16px;background:#111827;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;">Sign in to Reclear →</a>
</div>`.trim(),
  }).then(() => true).catch((err) => {
    console.warn("  ⚠  invite email failed:", (err as Error).message);
    return false;
  });

  console.log(`\n  ✓  Created ${created.role}: ${created.name} <${created.email}> (id: ${created.id})`);
  console.log(sent
    ? `  ✓  Invite email sent to ${recoveryEmail}`
    : `  ⚠  Created but invite email failed — send manually via the admin panel`
  );
  console.log();
  process.exit(0);
}

main().catch((err) => {
  console.error("  ✗ ", err.message ?? err);
  process.exit(1);
});
