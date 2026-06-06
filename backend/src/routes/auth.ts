import { Router, Response } from "express";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import {
  hashPassword,
  verifyPassword,
  signToken,
  generateId,
  signTwoFactorTemp,
  verifyTwoFactorTemp,
} from "../lib/auth";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../lib/rate-limit";
import { generateTotpSecret, totpQrCodeUrl, verifyTotp } from "../lib/totp";

// 10 attempts per 15 minutes per IP for login and 2FA
const loginLimiter = rateLimit(10, 15 * 60_000);
// 5 attempts per 15 minutes per IP for password reset
const resetLimiter = rateLimit(5, 15 * 60_000);

const router = Router();

const COOKIE_NAME = "token";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

function generateBackupCodes(): { plain: string[]; hashed: string[] } {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const plain = Array.from({ length: 8 }, () => {
    const half = (n: number) =>
      Array.from(crypto.randomBytes(n)).map((b) => chars[b % chars.length]).join("");
    return `${half(4)}-${half(4)}`;
  });
  const hashed = plain.map((c) => crypto.createHash("sha256").update(c).digest("hex"));
  return { plain, hashed };
}

// ── Login ─────────────────────────────────────────────────────────────────────

router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ success: false, error: "email and password required" });
  }

  const [user] = await db.select().from(users)
    .where(eq(users.email, email.toLowerCase().trim())).limit(1);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ success: false, error: "Invalid credentials" });
  }
  if (user.disabled) {
    return res.status(403).json({ success: false, error: "Account disabled" });
  }

  await db.update(users).set({ lastLoginAt: new Date().toISOString() }).where(eq(users.id, user.id));

  // 2FA required — return a short-lived temp token (not the session cookie yet)
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    const tempToken = signTwoFactorTemp(user.id);
    return res.json({ success: true, requiresTwoFactor: true, tempToken });
  }

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role as "admin" | "user",
    ...(user.mustChangePassword && { mustChangePassword: true }),
  });

  setAuthCookie(res, token);

  res.json({
    success: true,
    mustChangePassword: user.mustChangePassword,
    data: {
      user: {
        id: user.id, name: user.name, email: user.email,
        role: user.role, recoveryEmail: user.recoveryEmail,
      },
    },
  });
});

// ── Complete 2FA login ────────────────────────────────────────────────────────

router.post("/2fa/verify", loginLimiter, async (req, res) => {
  const { tempToken, code } = req.body as { tempToken?: string; code?: string };
  if (!tempToken || !code) {
    return res.status(400).json({ success: false, error: "tempToken and code required" });
  }

  let userId: string;
  try {
    userId = verifyTwoFactorTemp(tempToken);
  } catch {
    return res.status(401).json({ success: false, error: "Invalid or expired session. Please log in again." });
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.twoFactorSecret) {
    return res.status(401).json({ success: false, error: "2FA not configured" });
  }

  const totpOk = verifyTotp(code, user.twoFactorSecret);
  if (!totpOk) {
    const storedHashes: string[] = JSON.parse(user.twoFactorBackupCodes ?? "[]");
    const codeHash = crypto.createHash("sha256").update(code.toUpperCase().replace(/\s/g, "")).digest("hex");
    const idx = storedHashes.indexOf(codeHash);
    if (idx === -1) {
      return res.status(401).json({ success: false, error: "Incorrect code. Try again." });
    }
    storedHashes.splice(idx, 1);
    await db.update(users).set({ twoFactorBackupCodes: JSON.stringify(storedHashes) }).where(eq(users.id, userId));
  }

  const token = signToken({
    sub: user.id, email: user.email, role: user.role as "admin" | "user",
    ...(user.mustChangePassword && { mustChangePassword: true }),
  });

  setAuthCookie(res, token);

  res.json({
    success: true,
    mustChangePassword: user.mustChangePassword,
    data: {
      user: { id: user.id, name: user.name, email: user.email, role: user.role, recoveryEmail: user.recoveryEmail },
    },
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────

router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ success: true });
});

// ── Force change password (first login) ──────────────────────────────────────

router.post("/force-change-password", requireAuth, async (req, res) => {
  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
  }

  const [user] = await db.select({ mustChangePassword: users.mustChangePassword })
    .from(users).where(eq(users.id, req.user!.sub)).limit(1);

  if (!user?.mustChangePassword) {
    return res.status(400).json({ success: false, error: "No forced change required" });
  }

  await db.update(users).set({
    passwordHash: hashPassword(newPassword),
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  }).where(eq(users.id, req.user!.sub));

  const [fresh] = await db.select().from(users).where(eq(users.id, req.user!.sub)).limit(1);
  const token = signToken({ sub: fresh.id, email: fresh.email, role: fresh.role as "admin" | "user" });

  setAuthCookie(res, token);

  res.json({
    success: true,
    data: {
      user: { id: fresh.id, name: fresh.name, email: fresh.email, role: fresh.role, recoveryEmail: fresh.recoveryEmail },
    },
  });
});

// ── Reset password via token (from email link) ────────────────────────────────

router.post("/reset-password", resetLimiter, async (req, res) => {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };
  if (!token || !newPassword) {
    return res.status(400).json({ success: false, error: "token and newPassword required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
  }

  const hashed = crypto.createHash("sha256").update(token).digest("hex");
  const now = new Date().toISOString();

  const [user] = await db.select().from(users)
    .where(eq(users.resetToken, hashed)).limit(1);

  if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < now) {
    return res.status(400).json({ success: false, error: "Reset link is invalid or has expired." });
  }

  await db.update(users).set({
    passwordHash: hashPassword(newPassword),
    mustChangePassword: false,
    resetToken: null,
    resetTokenExpiresAt: null,
    updatedAt: now,
  }).where(eq(users.id, user.id));

  res.json({ success: true });
});

// ── Me ────────────────────────────────────────────────────────────────────────

router.get("/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(users).where(eq(users.id, req.user!.sub)).limit(1);
  if (!user) return res.status(404).json({ success: false, error: "User not found" });
  res.json({
    success: true,
    data: {
      id: user.id, name: user.name, email: user.email, role: user.role,
      recoveryEmail: user.recoveryEmail, lastLoginAt: user.lastLoginAt,
      twoFactorEnabled: user.twoFactorEnabled,
    },
  });
});

router.patch("/me", requireAuth, async (req, res) => {
  const { name, recoveryEmail } = req.body as { name?: string; recoveryEmail?: string };
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (name?.trim()) patch.name = name.trim();
  if (recoveryEmail !== undefined) patch.recoveryEmail = recoveryEmail || null;
  await db.update(users).set(patch).where(eq(users.id, req.user!.sub));
  res.json({ success: true });
});

router.patch("/me/password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: "currentPassword and newPassword required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
  }

  const [user] = await db.select().from(users).where(eq(users.id, req.user!.sub)).limit(1);
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return res.status(401).json({ success: false, error: "Current password incorrect" });
  }

  await db.update(users).set({
    passwordHash: hashPassword(newPassword),
    updatedAt: new Date().toISOString(),
  }).where(eq(users.id, user.id));

  res.json({ success: true });
});

// ── 2FA setup ─────────────────────────────────────────────────────────────────

router.post("/2fa/setup", requireAuth, async (req, res) => {
  const [user] = await db.select({ email: users.email, twoFactorEnabled: users.twoFactorEnabled })
    .from(users).where(eq(users.id, req.user!.sub)).limit(1);

  if (!user) return res.status(404).json({ success: false, error: "User not found" });
  if (user.twoFactorEnabled) {
    return res.status(400).json({ success: false, error: "2FA is already enabled" });
  }

  const secret = generateTotpSecret();
  const qrCode = await totpQrCodeUrl(user.email, secret);

  await db.update(users).set({ twoFactorSecret: secret }).where(eq(users.id, req.user!.sub));

  res.json({ success: true, data: { secret, qrCode } });
});

router.post("/2fa/enable", requireAuth, async (req, res) => {
  const { code } = req.body as { code?: string };
  if (!code) return res.status(400).json({ success: false, error: "code required" });

  const [user] = await db.select({ twoFactorSecret: users.twoFactorSecret, twoFactorEnabled: users.twoFactorEnabled })
    .from(users).where(eq(users.id, req.user!.sub)).limit(1);

  if (!user?.twoFactorSecret) {
    return res.status(400).json({ success: false, error: "Run /2fa/setup first" });
  }
  if (user.twoFactorEnabled) {
    return res.status(400).json({ success: false, error: "2FA already enabled" });
  }
  if (!verifyTotp(code, user.twoFactorSecret)) {
    return res.status(400).json({ success: false, error: "Incorrect code. Check your authenticator and try again." });
  }

  const { plain, hashed } = generateBackupCodes();
  await db.update(users).set({
    twoFactorEnabled: true,
    twoFactorBackupCodes: JSON.stringify(hashed),
  }).where(eq(users.id, req.user!.sub));

  res.json({ success: true, data: { backupCodes: plain } });
});

router.post("/2fa/disable", requireAuth, async (req, res) => {
  const { password } = req.body as { password?: string };
  if (!password) return res.status(400).json({ success: false, error: "password required" });

  const [user] = await db.select().from(users).where(eq(users.id, req.user!.sub)).limit(1);
  if (!user) return res.status(404).json({ success: false, error: "User not found" });
  if (!verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ success: false, error: "Incorrect password" });
  }

  await db.update(users).set({
    twoFactorEnabled: false,
    twoFactorSecret: null,
  }).where(eq(users.id, req.user!.sub));

  res.json({ success: true });
});

export default router;
