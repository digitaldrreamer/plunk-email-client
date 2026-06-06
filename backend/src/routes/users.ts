import { Router } from "express";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { hashPassword, generateId, generateOneTimePassword, generateResetToken } from "../lib/auth";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { sendEmail } from "../lib/plunk";
import { seedWelcomeEmail } from "../lib/welcome-email";
import { normaliseTeamEmail, isValidEmail } from "../lib/email-address";

const router = Router();
router.use(requireAuth, requireAdmin);

const SAFE_COLS = {
  id: users.id,
  name: users.name,
  email: users.email,
  recoveryEmail: users.recoveryEmail,
  role: users.role,
  disabled: users.disabled,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  mustChangePassword: users.mustChangePassword,
  twoFactorEnabled: users.twoFactorEnabled,
};

// GET /api/users
router.get("/", async (_req, res) => {
  const all = await db.select(SAFE_COLS).from(users);
  res.json({ success: true, data: all });
});

// POST /api/users — invite user (no password field; sends invite to recovery email)
router.post("/", async (req, res) => {
  const { name, email, recoveryEmail, role } = req.body as {
    name?: string; email?: string; recoveryEmail?: string; role?: string;
  };

  if (!name?.trim() || !email?.trim()) {
    return res.status(400).json({ success: false, error: "name and email required" });
  }
  if (!recoveryEmail?.trim()) {
    return res.status(400).json({ success: false, error: "recoveryEmail is required to send the invite" });
  }
  if (!isValidEmail(recoveryEmail.trim())) {
    return res.status(400).json({ success: false, error: "recoveryEmail is not a valid email address" });
  }

  // Sanitise: strip invalid characters, enforce @team.reclear.io domain
  let teamEmail: string;
  try {
    teamEmail = normaliseTeamEmail(email);
  } catch (err) {
    return res.status(400).json({ success: false, error: (err as Error).message });
  }

  const oneTimePassword = generateOneTimePassword();
  const now = new Date().toISOString();
  const adminName = req.user!.email;

  const user = {
    id: generateId(),
    name: name.trim(),
    email: teamEmail,
    passwordHash: hashPassword(oneTimePassword),
    recoveryEmail: recoveryEmail.trim(),
    role: role === "admin" ? "admin" : "user",
    disabled: false,
    lastLoginAt: null as string | null,
    createdAt: now,
    updatedAt: now,
    mustChangePassword: true,
    twoFactorSecret: null as string | null,
    twoFactorEnabled: false,
    resetToken: null as string | null,
    resetTokenExpiresAt: null as string | null,
    twoFactorBackupCodes: null as string | null,
  };

  try {
    await db.insert(users).values(user);
  } catch {
    return res.status(409).json({ success: false, error: "Email already exists" });
  }

  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

  // DB-only: inserts a welcome message directly into the new user's inbox.
  // No email is sent here — this is NOT a duplicate of the invite below.
  await seedWelcomeEmail({ name: user.name, email: user.email })
    .catch((err) => console.warn("[welcome] seed failed:", (err as Error).message));

  // Real email: sends the invite + one-time credentials to the user's
  // external recovery address (NOT their team.reclear.io inbox).
  await sendEmail({
    to: recoveryEmail.trim(),
    subject: `You've been invited to Reclear`,
    body: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
  <h2 style="margin-bottom:4px;">You're in.</h2>
  <p style="color:#6b7280;margin-top:0;">Invited by <strong>${adminName}</strong> as <strong>${user.role}</strong>.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
  <p>Your login details:</p>
  <table style="border-collapse:collapse;width:100%;">
    <tr><td style="padding:6px 0;color:#6b7280;width:120px;">Email</td><td style="font-weight:600;">${user.email}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">Temp password</td><td><code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:14px;">${oneTimePassword}</code></td></tr>
  </table>
  <p style="color:#6b7280;font-size:13px;margin-top:4px;">You'll be asked to set a new password on your first login.</p>
  <a href="${frontendUrl}" style="display:inline-block;margin-top:16px;background:#111827;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;">Sign in to Reclear →</a>
</div>`.trim(),
  }).catch((err) => console.warn("[invite] email failed:", (err as Error).message));

  const { passwordHash: _h, ...safe } = user;
  res.status(201).json({ success: true, data: safe });
});

// PATCH /api/users/:id — update name, recoveryEmail, role, disabled
router.patch("/:id", async (req, res) => {
  const { name, recoveryEmail, role, disabled } = req.body as {
    name?: string; recoveryEmail?: string; role?: string; disabled?: boolean;
  };

  if (recoveryEmail !== undefined && recoveryEmail.trim() && !isValidEmail(recoveryEmail.trim())) {
    return res.status(400).json({ success: false, error: "recoveryEmail is not a valid email address" });
  }

  if (role === "user") {
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
    const [target] = await db.select({ role: users.role }).from(users)
      .where(eq(users.id, req.params.id)).limit(1);
    if (target?.role === "admin" && admins.length <= 1) {
      return res.status(400).json({ success: false, error: "Cannot demote the last admin" });
    }
  }

  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (name?.trim()) patch.name = name.trim();
  if (recoveryEmail !== undefined) patch.recoveryEmail = recoveryEmail || null;
  if (role === "admin" || role === "user") patch.role = role;
  if (typeof disabled === "boolean") patch.disabled = disabled;

  const [updated] = await db.update(users).set(patch)
    .where(eq(users.id, req.params.id)).returning({ id: users.id });
  if (!updated) return res.status(404).json({ success: false, error: "User not found" });
  res.json({ success: true });
});

// POST /api/users/:id/send-reset — sends a password reset link to recovery email
router.post("/:id/send-reset", async (req, res) => {
  const [user] = await db.select().from(users).where(eq(users.id, req.params.id)).limit(1);
  if (!user) return res.status(404).json({ success: false, error: "User not found" });
  if (!user.recoveryEmail) {
    return res.status(400).json({ success: false, error: "User has no recovery email set" });
  }

  const { raw, hashed } = generateResetToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await db.update(users).set({
    resetToken: hashed,
    resetTokenExpiresAt: expiresAt,
    updatedAt: new Date().toISOString(),
  }).where(eq(users.id, user.id));

  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
  const resetLink = `${frontendUrl}/reset-password?token=${raw}`;
  const adminName = req.user!.email;

  await sendEmail({
    to: user.recoveryEmail,
    subject: `Your Reclear password has been reset`,
    body: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
  <h2 style="margin-bottom:4px;">Password reset</h2>
  <p style="color:#6b7280;margin-top:0;">An admin (<strong>${adminName}</strong>) has requested a password reset for your Reclear account.</p>
  <a href="${resetLink}" style="display:inline-block;margin-top:16px;background:#111827;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;">Set new password →</a>
  <p style="color:#9ca3af;font-size:12px;margin-top:20px;">This link expires in 24 hours. If you didn't expect this, contact your administrator.</p>
</div>`.trim(),
  }).catch((err) => console.warn("[reset] email failed:", (err as Error).message));

  res.json({ success: true });
});

// DELETE /api/users/:id
router.delete("/:id", async (req, res) => {
  const [target] = await db.select({ role: users.role }).from(users)
    .where(eq(users.id, req.params.id)).limit(1);
  if (!target) return res.status(404).json({ success: false, error: "User not found" });

  if (target.role === "admin") {
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
    if (admins.length <= 1) {
      return res.status(400).json({ success: false, error: "Cannot delete the last admin" });
    }
  }

  await db.delete(users).where(eq(users.id, req.params.id));
  res.status(204).send();
});

export default router;
