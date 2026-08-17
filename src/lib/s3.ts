import crypto from "crypto";
import { isS3Configured, deleteS3Object } from "@/lib/storage/s3";

export { isS3Configured, deleteS3Object };

/**
 * Returns server secret for HMAC signing.
 * Fails safely if neither SESSION_SECRET nor JWT_SECRET is configured.
 */
function getSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error("CONFIG_ERROR: No se ha configurado SESSION_SECRET ni JWT_SECRET en el servidor.");
  }
  return secret.trim();
}

/**
 * Validates if string follows standard S3 objectKey structure:
 * {ambiente}/{empresa_id}/{modulo}/{entidad}/...
 */
export function isS3ObjectKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  const clean = key.trim();
  return /^(production|preview|development)\/\d+\/[a-z0-9_-]+\/[a-z0-9_-]+\//i.test(clean);
}

export interface StagingTokenPayload {
  s3_key: string;
  empresa_id: number;
  usuario_id: number;
  module?: string;
  entityType?: string;
  mime_type?: string;
  file_size?: number;
  original_name?: string;
  expires_at: number; // Milliseconds timestamp (Date.now())
  nonce: string;
}

export function generateUploadToken(payload: Omit<StagingTokenPayload, "nonce">): string {
  const secret = getSecret();
  const fullPayload: StagingTokenPayload = {
    ...payload,
    nonce: crypto.randomBytes(8).toString("hex")
  };
  const data = JSON.stringify(fullPayload);
  const base64Data = Buffer.from(data).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(base64Data).digest("base64url");
  return `${base64Data}.${signature}`;
}

export function verifyUploadToken(token: string): StagingTokenPayload | null {
  try {
    if (!token || typeof token !== "string" || !token.includes(".")) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const secret = getSecret();
    const [base64Data, signature] = parts;
    const expectedSig = crypto.createHmac("sha256", secret).update(base64Data).digest("base64url");
    
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload: StagingTokenPayload = JSON.parse(Buffer.from(base64Data, "base64url").toString("utf8"));
    
    // Strict millisecond expiration check using Date.now()
    if (!payload || typeof payload.expires_at !== "number" || Date.now() > payload.expires_at) {
      return null;
    }

    return payload;
  } catch (e) {
    return null;
  }
}
