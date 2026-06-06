// eslint-disable-next-line @typescript-eslint/no-require-imports
const otplib = require("otplib") as typeof import("otplib");
import QRCode from "qrcode";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const totp = new (otplib.TOTP as any)({ window: 1 });

export function generateTotpSecret(): string {
  return totp.generateSecret() as string;
}

export async function totpQrCodeUrl(email: string, secret: string): Promise<string> {
  const uri: string = totp.toURI({ account: email, issuer: "Reclear", secret });
  return QRCode.toDataURL(uri);
}

export function verifyTotp(code: string, secret: string): boolean {
  try { return totp.verify({ token: code, secret }) as boolean; }
  catch { return false; }
}
