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

    const [activeBikePhoto] = await query(
      `SELECT bicicleta_foto_id
       FROM admin.bicicleta_fotos
       WHERE ruta_archivo = $1
       LIMIT 1`,
      [objectKey]
    ).catch(() => [null]);

    if (activeCheckChk || activeBikePhoto) {
      // Actively referenced: preserve S3 physical file and complete queue obligation
      await query(`
        UPDATE admin.s3_cleanup_queue
        SET estado = 'COMPLETED',
            intentos = intentos + 1,
            ultimo_error = 'PRESERVED: Active reference found in database',
            fecha_procesamiento = NOW()
        WHERE cleanup_id = $1
      `, [cleanupId]);

      // Ensure staging registry reflects active status and does NOT mark as CLEANED
      await query(`
        UPDATE admin.s3_staging_registry
        SET estado = 'ASSOCIATED',
            fecha_consumo = COALESCE(fecha_consumo, NOW())
        WHERE object_key = $1
      `, [objectKey]).catch(() => {});

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

    // Update staging registry state to CLEANED upon successful physical S3 deletion
    await query(`
      UPDATE admin.s3_staging_registry
      SET estado = 'CLEANED'
      WHERE object_key = $1
    `, [objectKey]).catch(() => {});

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
 * First automatically reaps stale staging objects into the queue.
 */
export async function processPendingS3Cleanups(limit = 50): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  reaped: number;
}> {
  await ensureS3CleanupTable();

  // 1. Automatically reap stale staging objects into cleanup queue atomically
  const reaped = await reapStaleStagingObjects().catch((err) => {
    console.error("Error reaping stale staging objects:", err);
    return 0;
  });

  // 2. Atomically claim rows using FOR UPDATE SKIP LOCKED to prevent race conditions across parallel workers
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
    failed,
    reaped
  };
}

/**
 * Registers an object in staging registry upon presigned URL generation.
 */
export async function registerStagingObject(params: {
  empresaId: number;
  usuarioId: number;
  objectKey: string;
  modulo: string;
  tipoEntidad: string;
  contextoId?: string | null;
  ttlHours?: number;
}): Promise<number> {
  const ttl = params.ttlHours || 24;
  const rows = await query<any>(
    `INSERT INTO admin.s3_staging_registry (
       empresa_id, usuario_id, object_key, modulo, tipo_entidad, contexto_id, estado, fecha_creacion, fecha_expiracion
     ) VALUES (
       $1, $2, $3, $4, $5, $6, 'STAGING', NOW(), NOW() + $7::INTERVAL
     )
     ON CONFLICT (object_key) DO UPDATE
     SET contexto_id = COALESCE(EXCLUDED.contexto_id, admin.s3_staging_registry.contexto_id)
     RETURNING staging_id`,
    [
      params.empresaId,
      params.usuarioId,
      params.objectKey,
      params.modulo.toUpperCase(),
      params.tipoEntidad,
      params.contextoId || null,
      `${ttl} hours`
    ]
  );
  return rows?.[0]?.staging_id || 0;
}

/**
 * Updates the state of a staging object (e.g. to 'ASSOCIATED', 'QUEUED', 'CLEANED').
 */
export async function updateStagingState(
  empresaId: number,
  objectKey: string,
  nuevoEstado: "STAGING" | "ASSOCIATED" | "QUEUED" | "CLEANED"
): Promise<boolean> {
  await query(
    `UPDATE admin.s3_staging_registry
     SET estado = $3::VARCHAR,
         fecha_consumo = CASE WHEN $3::VARCHAR = 'ASSOCIATED' THEN NOW() ELSE fecha_consumo END
     WHERE empresa_id = $1 AND object_key = $2`,
    [empresaId, objectKey, nuevoEstado]
  );
  return true;
}

/**
 * Automatically and atomically reaps abandoned staging objects past their expiration TTL (e.g. browser closed).
 * Enqueues them for asynchronous physical cleanup within a single transactional boundary using FOR UPDATE SKIP LOCKED.
 */
export async function reapStaleStagingObjects(limit = 100): Promise<number> {
  return await withTransaction(async (client) => {
    // Atomically lock and claim expired staging objects
    const res = await client.query(
      `SELECT staging_id, empresa_id, usuario_id, object_key, modulo, tipo_entidad
       FROM admin.s3_staging_registry
       WHERE estado = 'STAGING' AND fecha_expiracion <= NOW()
       ORDER BY fecha_expiracion ASC
       FOR UPDATE SKIP LOCKED
       LIMIT $1`,
      [limit]
    );

    const staleRows = res.rows;
    if (!staleRows || staleRows.length === 0) return 0;

    for (const row of staleRows) {
      // 1. Update staging registry state to QUEUED
      await client.query(
        `UPDATE admin.s3_staging_registry
         SET estado = 'QUEUED'
         WHERE staging_id = $1`,
        [row.staging_id]
      );

      // 2. Enqueue cleanup obligation in the same PostgreSQL transaction
      await enqueueS3Cleanup(client, {
        empresaId: row.empresa_id,
        objectKey: row.object_key,
        modulo: row.modulo,
        entidad: row.tipo_entidad,
        usuarioId: row.usuario_id
      });
    }

    return staleRows.length;
  });
}

/**
 * Verifies staging ownership and context authorization.
 * Strict Authority:
 * 1. session.empresa_id === record.empresa_id (Tenant isolation)
 * 2. record.estado !== 'ASSOCIATED' (Consolidated active DB protection)
 * 3. session.usuario_id === record.usuario_id OR valid cryptographically signed upload_token
 * NOTE: contexto_id is an extra context filter, NEVER a standalone privilege escalation bypass.
 */
export async function verifyStagingOwnership(params: {
  empresaId: number;
  objectKey: string;
  usuarioId?: number;
  contextoId?: string | null;
  uploadToken?: string | null;
}): Promise<{ authorized: boolean; reason?: string; stagingRecord?: any }> {
  // 1. Query durable registry
  const rows = await query<any>(
    `SELECT * FROM admin.s3_staging_registry
     WHERE empresa_id = $1 AND object_key = $2`,
    [params.empresaId, params.objectKey]
  );

  if (rows && rows.length > 0) {
    const record = rows[0];

    // Must be in active STAGING state
    if (record.estado !== "STAGING") {
      return { authorized: false, reason: record.estado === "ASSOCIATED" ? "ALREADY_ASSOCIATED" : "NOT_IN_STAGING" };
    }

    // Company isolation check
    if (Number(record.empresa_id) !== Number(params.empresaId)) {
      return { authorized: false, reason: "TENANT_MISMATCH" };
    }

    // Context filter (if incoming context does not match record's registered context, reject)
    if (params.contextoId && record.contexto_id && record.contexto_id !== params.contextoId) {
      return { authorized: false, reason: "CONTEXT_MISMATCH" };
    }

    // Primary Authority: User ownership check (Same tenant AND same user)
    if (params.usuarioId && Number(record.usuario_id) === Number(params.usuarioId)) {
      return { authorized: true, stagingRecord: record };
    }

    // Supplementary Authority: Cryptographic upload token for the uploader
    if (params.uploadToken) {
      const { verifyUploadToken } = await import("@/lib/s3");
      const payload = verifyUploadToken(params.uploadToken);
      if (
        payload &&
        payload.s3_key === params.objectKey &&
        Number(payload.empresa_id) === Number(params.empresaId) &&
        Number(payload.empresa_id) === Number(record.empresa_id) &&
        Number(payload.usuario_id) === Number(record.usuario_id) &&
        (!params.usuarioId || Number(params.usuarioId) === Number(payload.usuario_id))
      ) {
        return { authorized: true, stagingRecord: record };
      }
    }

    // Foreign user in the same tenant is strictly rejected
    return { authorized: false, reason: "UNAUTHORIZED_CONTEXT_OR_USER" };
  }

  // 2. If not registered in staging table (fallback / legacy), verify via uploadToken
  if (params.uploadToken) {
    const { verifyUploadToken } = await import("@/lib/s3");
    const payload = verifyUploadToken(params.uploadToken);
    if (
      payload &&
      payload.s3_key === params.objectKey &&
      Number(payload.empresa_id) === Number(params.empresaId) &&
      (!params.usuarioId || Number(payload.usuario_id) === Number(params.usuarioId))
    ) {
      return { authorized: true };
    }
  }

  return { authorized: false, reason: "NOT_FOUND" };
}
