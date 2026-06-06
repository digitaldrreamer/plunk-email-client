import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: "admin" | "user";
  mustChangePassword?: boolean;
  scope?: string; // "2fa" for the limited pre-2FA token
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 12);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export function signToken(payload: JwtPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  return jwt.verify(token, secret) as JwtPayload;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function generateOneTimePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"; // unambiguous chars
  return Array.from(crypto.randomBytes(12))
    .map((b) => chars[b % chars.length])
    .join("");
}

export function generateResetToken(): { raw: string; hashed: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  const hashed = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hashed };
}

export function signTwoFactorTemp(sub: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  return jwt.sign({ sub, scope: "2fa" }, secret, { expiresIn: "10m" });
}

export function verifyTwoFactorTemp(token: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  const payload = jwt.verify(token, secret) as JwtPayload;
  if (payload.scope !== "2fa") throw new Error("Invalid token scope");
  return payload.sub;
}
