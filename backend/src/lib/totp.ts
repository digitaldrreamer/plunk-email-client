import { generateSecret, verify, generate, generateURI } from "otplib";
import QRCode from "qrcode";
import { logger } from "./logger";

export { generateSecret as generateTotpSecret };

export async function totpQrCodeUrl(email: string, secret: string): Promise<string> {
  const uri = generateURI({ issuer: "Reclear", label: email, secret });
  return QRCode.toDataURL(uri);
}

export async function verifyTotp(code: string, secret: string): Promise<boolean> {
  const token = String(code).trim();
  try {
    const expected = await generate({ secret });
    const result = await verify({ token, secret });
    logger.info("TOTP verify", {
      action: "totp_verify",
      valid: result.valid,
      codeLen: token.length,
      secretLen: secret.length,
      expectedCode: expected,
      receivedCode: token,
    });
    return result.valid;
  } catch (err) {
    logger.error("TOTP verify threw", { action: "totp_verify_error", error: String(err), codeLen: token.length, secretLen: secret.length });
    return false;
  }
}
