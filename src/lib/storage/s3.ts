import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

// Ensure server-only execution
if (typeof window !== "undefined") {
  throw new Error("src/lib/storage/s3.ts debe ser utilizado exclusivamente en el entorno de servidor.");
}

/**
 * Returns missing AWS S3 environment variable names (without leaking secret values).
 */
export function getMissingS3EnvVars(): string[] {
  const missing: string[] = [];
  if (!process.env.AWS_REGION) missing.push("AWS_REGION");
  if (!process.env.AWS_S3_BUCKET && !process.env.AWS_S3_BUCKET_NAME) missing.push("AWS_S3_BUCKET");
  if (!process.env.AWS_ACCESS_KEY_ID) missing.push("AWS_ACCESS_KEY_ID");
  if (!process.env.AWS_SECRET_ACCESS_KEY) missing.push("AWS_SECRET_ACCESS_KEY");
  return missing;
}

/**
 * Checks if S3 configuration is valid with all 4 required credentials.
 */
export function isS3Configured(): boolean {
  return getMissingS3EnvVars().length === 0;
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

const region = process.env.AWS_REGION || "us-east-1";
const bucketName = process.env.AWS_S3_BUCKET || process.env.AWS_S3_BUCKET_NAME || "bikers-fort-prod-media";

// Initialize single S3Client instance
const s3Client = new S3Client({
  region,
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      : undefined
});

/**
 * Returns normalized environment: production, preview, or development.
 */
export function getEnvironment(): "production" | "preview" | "development" {
  const vercelEnv = process.env.VERCEL_ENV?.toLowerCase().trim();
  if (vercelEnv === "production" || vercelEnv === "preview") {
    return vercelEnv;
  }
  return "development";
}

/**
 * Reads AWS_S3_PRESIGNED_URL_EXPIRES env var, defaults to 300s, clamped between 60s and 900s.
 */
export function getPresignedExpirationSeconds(customSeconds?: number): number {
  let seconds = customSeconds;
  if (seconds === undefined || seconds === null || isNaN(seconds)) {
    const envVal = parseInt(process.env.AWS_S3_PRESIGNED_URL_EXPIRES || "300", 10);
    seconds = isNaN(envVal) ? 300 : envVal;
  }
  return Math.max(60, Math.min(900, seconds));
}

/**
 * Sanitizes file names removing control chars, slashes, and path traversal sequences.
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName || typeof fileName !== "string") return "archivo";
  
  const basename = fileName.split(/[/\\]/).pop() || "archivo";
  
  const cleaned = basename
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".");
    
  return cleaned.substring(0, 120) || "archivo";
}

/**
 * Generates structured S3 Key according to standard:
 * {ambiente}/{empresa_id}/{modulo}/{entidad}/{entidad_id_o_pending}/{uuid}-{nombre_sanitizado}
 */
export function generateObjectKey(params: {
  empresaId: number | string;
  module: string;
  entityType: string;
  entityId?: number | string | null;
  fileName: string;
}): string {
  const env = getEnvironment();
  const empresaIdStr = String(params.empresaId).trim();
  const modStr = sanitizeFileName(params.module.toLowerCase().trim());
  const entityTypeStr = sanitizeFileName(params.entityType.toLowerCase().trim());
  const entityIdStr = params.entityId ? String(params.entityId).trim() : "pending";
  const uuid = crypto.randomUUID();
  const cleanName = sanitizeFileName(params.fileName);

  return `${env}/${empresaIdStr}/${modStr}/${entityTypeStr}/${entityIdStr}/${uuid}-${cleanName}`;
}

/**
 * Generates presigned URL for direct client upload (PUT).
 */
export async function getPresignedUploadUrl(params: {
  key: string;
  contentType: string;
  expiresIn?: number;
}): Promise<{ uploadUrl: string; expiresIn: number }> {
  const expiresIn = getPresignedExpirationSeconds(params.expiresIn);
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: params.key,
    ContentType: params.contentType
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
  return { uploadUrl, expiresIn };
}

/**
 * Generates presigned URL for secure temporary download (GET).
 */
export async function getPresignedDownloadUrl(params: {
  key: string;
  expiresIn?: number;
}): Promise<{ downloadUrl: string; expiresIn: number }> {
  const expiresIn = getPresignedExpirationSeconds(params.expiresIn);

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: params.key
  });

  const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn });
  return { downloadUrl, expiresIn };
}

/**
 * Deletes object from S3 bucket using canonical S3 client.
 */
export async function deleteS3Object(key: string): Promise<boolean> {
  if (!isS3Configured()) return false;
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error("Error al eliminar objeto de S3:", error);
    return false;
  }
}

/**
 * Checks if object exists in S3 bucket using HeadObject.
 */
export async function checkS3ObjectExists(key: string): Promise<boolean> {
  if (!isS3Configured()) return false;
  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key
    });
    await s3Client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    console.error("Error al verificar existencia de objeto en S3:", error);
    return false;
  }
}

/**
 * Executes HeadObjectCommand after client PUT and before DB persistence.
 * Validates:
 * - Object existence
 * - Real ContentLength > 0
 * - Real ContentType
 */
export async function verifyS3ObjectMetadata(key: string): Promise<{
  valid: boolean;
  contentLength: number;
  contentType: string;
  error?: string;
}> {
  if (!isS3Configured()) {
    const missing = getMissingS3EnvVars();
    return {
      valid: false,
      contentLength: 0,
      contentType: "",
      error: `Almacenamiento S3 no configurado. Variables ausentes: ${missing.join(", ")}`
    };
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key
    });
    const res = await s3Client.send(command);
    const contentLength = res.ContentLength ?? 0;
    const contentType = res.ContentType || "";

    if (contentLength <= 0) {
      return {
        valid: false,
        contentLength: 0,
        contentType,
        error: "El archivo en S3 está vacío (0 bytes)."
      };
    }

    return {
      valid: true,
      contentLength,
      contentType
    };
  } catch (error: any) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return {
        valid: false,
        contentLength: 0,
        contentType: "",
        error: "El objeto no fue encontrado en el bucket S3 tras la subida."
      };
    }
    console.error("Error al ejecutar HeadObjectCommand en S3:", error);
    return {
      valid: false,
      contentLength: 0,
      contentType: "",
      error: error.message || "Error al verificar metadatos de S3 mediante HeadObject."
    };
  }
}

export { s3Client, bucketName, region };
