import { generateSecret, verify, generateURI } from "otplib";
import QRCode from "qrcode";

export { generateSecret as generateTotpSecret };

export async function totpQrCodeUrl(email: string, secret: string): Promise<string> {
  const uri = generateURI({ issuer: "Reclear", label: email, secret });
  return QRCode.toDataURL(uri);
}

export async function verifyTotp(code: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({ token: code, secret });
    return result.valid;
  } catch {
    return false;
  }
}
