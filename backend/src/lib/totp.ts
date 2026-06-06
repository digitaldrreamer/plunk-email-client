import { authenticator } from "otplib";
import QRCode from "qrcode";

authenticator.options = { window: 1 };

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export async function totpQrCodeUrl(email: string, secret: string): Promise<string> {
  const uri = authenticator.keyuri(email, "Reclear", secret);
  return QRCode.toDataURL(uri);
}

export function verifyTotp(code: string, secret: string): boolean {
  try { return authenticator.verify({ token: code, secret }); }
  catch { return false; }
}
