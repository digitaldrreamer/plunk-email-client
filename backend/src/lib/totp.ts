import { OTP, generateSecret } from "otplib";
import QRCode from "qrcode";

const otp = new OTP();

export function generateTotpSecret(): string {
  return generateSecret();
}

export async function totpQrCodeUrl(email: string, secret: string): Promise<string> {
  const uri = otp.generateURI({ issuer: "Reclear", label: email, secret });
  return QRCode.toDataURL(uri);
}

export function verifyTotp(code: string, secret: string): boolean {
  try {
    const result = otp.verifySync({ token: code, secret });
    return result.valid;
  }
  catch { return false; }
}
