import { PoolClient } from "pg";
import { query, withTransaction } from "../db";
import { deleteS3Object, isS3ObjectKey } from "./s3";

export interface S3CleanupRecord {
  cleanup_id: number;
  empresa_id: number;
  object_key: string;
  modulo: string;
  entidad: string;
  entidad_id: number | null;
  estado: "PENDING" | "COMPLETED" | "FAILED";
  intentos: number;
  ultimo_error: string | null;
  fecha_creacion: string;
  fecha_procesamiento: string | null;
  usuario_creacion: number | null;
}

let tableEnsured = false;

/**
 * Ensures the admin.s3_cleanup_queue table exists in PostgreSQL.
 */
export async function ensureS3CleanupTable(client?: PoolClient): Promise<void> {
  if (tableEnsured) return;

  const sql = `
    CREATE TABLE IF NOT EXISTS admin.s3_cleanup_queue (
      cleanup_id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL,
      object_key VARCHAR(500) NOT NULL,
      modulo VARCHAR(50) NOT NULL,
      entidad VARCHAR(50) NOT NULL,
      entidad_id INTEGER,
      estado VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      intentos INTEGER NOT NULL DEFAULT 0,
      ultimo_error TEXT,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fecha_procesamiento TIMESTAMPTZ,
      usuario_creacion INTEGER,
      CONSTRAINT chk_s3_cleanup_estado CHECK (estado IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'))
    );
    CREATE INDEX IF NOT EXISTS idx_s3_cleanup_claim ON admin.s3_cleanup_queue(estado, intentos, fecha_procesamiento);
    CREATE INDEX IF NOT EXISTS idx_s3_cleanup_empresa ON admin.s3_cleanup_queue(empresa_id);
    CREATE INDEX IF NOT EXISTS idx_s3_cleanup_fecha ON admin.s3_cleanup_queue(fecha_creacion);
  `;

  if (client) {
    await client.query(sql);
  } else {
    await query(sql);
  }
  tableEnsured = true;
}

/**
 * Enqueues an S3 object deletion obligation within the DB transaction.
 * Guarantees zero loss of object keys before or during metadata removal.
 */
export async function enqueueS3Cleanup(
  client: PoolClient | null,
  params: {
    empresaId: number;
    objectKey: string;
    modulo: string;
    entidad: string;
    entidadId?: number | null;
    usuarioId?: number | null;
  }
): Promise<number> {
  await ensureS3CleanupTable(client || undefined);

  // Validate objectKey format (avoid storing presigned URLs or secrets)
  const cleanKey = (params.objectKey || "").trim();
  if (!cleanKey || cleanKey.startsWith("http://") || cleanKey.startsWith("https://")) {
    throw new Error("Solo se pueden encolar S3 Object Keys válidos y seguros, no URLs presignadas.");
  }

  const sql = `
    INSERT INTO admin.s3_cleanup_queue (
      empresa_id, object_key, modulo, entidad, entidad_id, estado, intentos, fecha_creacion, usuario_creacion
    ) VALUES ($1, $2, $3, $4, $5, 'PENDING', 0, NOW(), $6)
    RETURNING cleanup_id
  `;

  const values = [
    params.empresaId,
    cleanKey,
    params.modulo.toUpperCase(),
    params.entidad.toLowerCase(),
    params.entidadId || null,
    params.usuarioId || null
  ];

  if (client) {
    const res = await client.query(sql, values);
    return res.rows[0].cleanup_id;
  } else {
    const res = await query(sql, values);
    return res[0].cleanup_id;
  }
}

/**
 * Executes cleanup for a specific queue record against S3 and updates its durable state.
 */
export async function executeDurableS3Cleanup(
  cleanupId: number,
  objectKey: string
): Promise<{ success: boolean; error?: string; preserved?: boolean }> {
  await ensureS3CleanupTable();

  try {
    // Safety check: verify if the object_key is currently referenced by any active database entity
    const [activeCheckChk] = await query(
      `SELECT recepcion_checklist_id
       FROM admin.recepcion_checklist
       WHERE (ruta_archivo = $1 OR url_archivo = $1)
         AND (activo = true OR activo IS NULL)
       LIMIT 1`,
      [objectKey]
    ).catch(() => [null]);

    if (activeCheckChk) {
      // Actively referenced: preserve S3 physical file and complete queue obligation
      await query(`
        UPDATE admin.s3_cleanup_queue
        SET estado = 'COMPLETED',
            intentos = intentos + 1,
            ultimo_error = 'PRESERVED: Active reference found in database',
            fecha_procesamiento = NOW()
        WHERE cleanup_id = $1
      `, [cleanupId]);

      return { success: true, preserved: true };
    }

    const deleted = await deleteS3Object(objectKey);
    if (!deleted) {
      throw new Error("deleteS3Object devolvió false o S3 no está configurado.");
    }

    await query(`
      UPDATE admin.s3_cleanup_queue
      SET estado = 'COMPLETED',
          intentos = intentos + 1,
          ultimo_error = NULL,
          fecha_procesamiento = NOW()
      WHERE cleanup_id = $1
    `, [cleanupId]);

    return { success: true };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    await query(`
      UPDATE admin.s3_cleanup_queue
      SET estado = 'FAILED',
          intentos = intentos + 1,
          ultimo_error = $2,
          fecha_procesamiento = NOW()
      WHERE cleanup_id = $1
    `, [cleanupId, errorMsg]);

    return { success: false, error: errorMsg };
  }
}

/**
 * Retries a failed or pending cleanup item by ID.
 */
export async function retryS3Cleanup(cleanupId: number): Promise<{ success: boolean; record?: S3CleanupRecord; error?: string }> {
  await ensureS3CleanupTable();

  const rows = await query<S3CleanupRecord>(`
    SELECT * FROM admin.s3_cleanup_queue WHERE cleanup_id = $1
  `, [cleanupId]);

  if (!rows || rows.length === 0) {
    return { success: false, error: "Registro de limpieza S3 no encontrado." };
  }

  const record = rows[0];
  const result = await executeDurableS3Cleanup(record.cleanup_id, record.object_key);

  const updatedRows = await query<S3CleanupRecord>(`
    SELECT * FROM admin.s3_cleanup_queue WHERE cleanup_id = $1
  `, [cleanupId]);

  return {
    success: result.success,
    record: updatedRows[0],
    error: result.error
  };
}

/**
 * Scans and processes all pending or failed S3 cleanups up to a limit.
 */
export async function processPendingS3Cleanups(limit = 50): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  await ensureS3CleanupTable();

  // Atomically claim rows using FOR UPDATE SKIP LOCKED to prevent race conditions across parallel workers
  // Also recovers abandoned PROCESSING jobs where the worker died (timeout > 15 minutes)
  const claimedRows = await query<S3CleanupRecord>(`
    UPDATE admin.s3_cleanup_queue
    SET estado = 'PROCESSING', fecha_procesamiento = NOW()
    WHERE cleanup_id IN (
      SELECT cleanup_id
      FROM admin.s3_cleanup_queue
      WHERE (
        estado IN ('PENDING', 'FAILED')
        OR (estado = 'PROCESSING' AND fecha_procesamiento < NOW() - INTERVAL '15 minutes')
      )
      AND intentos < 5
      ORDER BY fecha_creacion ASC
      FOR UPDATE SKIP LOCKED
      LIMIT $1
    )
    RETURNING *
  `, [limit]);

  let succeeded = 0;
  let failed = 0;

  for (const row of claimedRows) {
    const res = await executeDurableS3Cleanup(row.cleanup_id, row.object_key);
    if (res.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return {
    processed: claimedRows.length,
    succeeded,
    failed
  };
}
