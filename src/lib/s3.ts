import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

export function isS3Configured(): boolean {
  return Boolean(
    process.env.AWS_S3_BUCKET_NAME &&
    process.env.AWS_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );
}

const SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "bikers_fort_staging_secret_2026";

export interface StagingTokenPayload {
  s3_key: string;
  empresa_id: number;
  usuario_id: number;
  mime_type: string;
  file_size: number;
  original_name: string;
  expires_at: number;
  nonce: string;
}

export function generateUploadToken(payload: Omit<StagingTokenPayload, "nonce">): string {
  const fullPayload: StagingTokenPayload = {
    ...payload,
    nonce: crypto.randomBytes(8).toString("hex")
  };
  const data = JSON.stringify(fullPayload);
  const base64Data = Buffer.from(data).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(base64Data).digest("base64url");
  return `${base64Data}.${signature}`;
}

export function verifyUploadToken(token: string): StagingTokenPayload | null {
  try {
    if (!token || !token.includes(".")) return null;
    const [base64Data, signature] = token.split(".");
    const expectedSig = crypto.createHmac("sha256", SECRET).update(base64Data).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }
    const payload: StagingTokenPayload = JSON.parse(Buffer.from(base64Data, "base64url").toString("utf8"));
    if (payload.expires_at < Date.now()) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

export async function deleteS3Object(s3Key: string): Promise<void> {
  if (!isS3Configured()) return;
  try {
    const client = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
    await client.send(new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: s3Key,
    }));
  } catch (err) {
    console.error("Error deleting S3 object:", err);
  }
}
