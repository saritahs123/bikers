/**
 * SISTEMA PROFESIONAL DE CONTROL DE MIGRACIONES — CORE
 * Archivo: src/lib/migrations/migrationCore.js
 * Proyecto: Bikers' Fort Core — Ride Lab
 *
 * Proporciona:
 * - Detección y ordenamiento de scripts SQL en migrations/
 * - Cálculo de Checksums SHA-256 (Inmutabilidad)
 * - Creación y gestión de admin.schema_migrations
 * - Bloqueo de concurrencia mediante PostgreSQL Advisory Locks
 * - Ejecución transaccional aislada (BEGIN ... COMMIT / ROLLBACK)
 * - Registro de auditoría (tiempo de ejecución, usuario, resultado)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ID único para PostgreSQL Advisory Lock (Ride Lab Migrations Lock)
const MIGRATION_ADVISORY_LOCK_ID = 987654321;

/**
 * Calcula el checksum SHA-256 del contenido de un archivo
 */
function calculateChecksum(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Extrae la descripción del encabezado del archivo SQL si existe
 */
function extractDescription(content) {
  const match = content.match(/--\s*DESCRIPTION:\s*([^\r\n]+)/i);
  if (match) return match[1].trim();
  const firstLine = content.split('\n')[0].replace(/^--\s*/, '').trim();
  return firstLine.slice(0, 200) || 'Sin descripción';
}

/**
 * Obtiene la lista ordenada de todos los archivos SQL en migrations/
 */
function getMigrationFiles(migrationsDir) {
  const dir = migrationsDir || path.resolve(process.cwd(), 'migrations');
  if (!fs.existsSync(dir)) {
    throw new Error(`El directorio de migraciones no existe: ${dir}`);
  }

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => {
      const numA = parseInt(a.split('_')[0], 10);
      const numB = parseInt(b.split('_')[0], 10);
      if (isNaN(numA) || isNaN(numB)) return a.localeCompare(b);
      return numA - numB;
    });

  return files.map(file => {
    const fullPath = path.join(dir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const seqNum = parseInt(file.split('_')[0], 10) || 0;
    const checksum = calculateChecksum(content);
    const description = extractDescription(content);

    return {
      filename: file,
      fullPath,
      sequenceNumber: seqNum,
      checksum,
      description,
      size: fs.statSync(fullPath).size,
      content
    };
  });
}

/**
 * Asegura la existencia de la tabla admin.schema_migrations en la base de datos
 */
async function ensureMigrationTable(client) {
  const ddl = `
    CREATE TABLE IF NOT EXISTS admin.schema_migrations (
        migration_id VARCHAR(100) PRIMARY KEY,
        sequence_number INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        checksum_sha256 CHAR(64) NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
        executed_by VARCHAR(100) NOT NULL DEFAULT current_user,
        execution_time_ms INTEGER,
        status VARCHAR(20) NOT NULL DEFAULT 'APPLIED',
        environment VARCHAR(20) NOT NULL DEFAULT 'test',
        details JSONB,
        CONSTRAINT chk_schema_migrations_status CHECK (status IN ('APPLIED', 'BASELINE', 'FAILED', 'VERIFIED')),
        CONSTRAINT chk_schema_migrations_env CHECK (environment IN ('test', 'production', 'staging', 'development'))
    );

    CREATE INDEX IF NOT EXISTS idx_schema_migrations_seq ON admin.schema_migrations (sequence_number);
    CREATE INDEX IF NOT EXISTS idx_schema_migrations_status ON admin.schema_migrations (status);
  `;
  await client.query(ddl);
}

/**
 * Adquiere un advisory lock exclusivo para evitar ejecuciones concurrentes
 */
async function acquireAdvisoryLock(client) {
  const res = await client.query('SELECT pg_try_advisory_lock($1) as locked', [MIGRATION_ADVISORY_LOCK_ID]);
  return Boolean(res.rows[0]?.locked);
}

/**
 * Libera el advisory lock exclusivo
 */
async function releaseAdvisoryLock(client) {
  await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_ADVISORY_LOCK_ID]);
}

/**
 * Obtiene todas las migraciones registradas en admin.schema_migrations
 */
async function getAppliedMigrations(client) {
  const check = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'admin' AND table_name = 'schema_migrations'
    ) as exists
  `);

  if (!check.rows[0]?.exists) {
    return [];
  }

  const res = await client.query(`
    SELECT 
      migration_id,
      sequence_number,
      name,
      description,
      checksum_sha256,
      executed_at,
      executed_by,
      execution_time_ms,
      status,
      environment
    FROM admin.schema_migrations
    ORDER BY sequence_number, executed_at
  `);
  return res.rows;
}

/**
 * Compara los archivos del repositorio con la tabla admin.schema_migrations
 */
async function getMigrationStatus(client, migrationsDir) {
  const diskFiles = getMigrationFiles(migrationsDir);
  const appliedRows = await getAppliedMigrations(client);
  const appliedMap = new Map(appliedRows.map(r => [r.migration_id, r]));

  const summary = diskFiles.map(file => {
    const applied = appliedMap.get(file.filename);
    let state = 'PENDING';
    let checksumMatches = true;

    if (applied) {
      state = applied.status; // 'APPLIED' o 'BASELINE' o 'FAILED'
      checksumMatches = applied.checksum_sha256 === file.checksum;
    }

    return {
      filename: file.filename,
      sequenceNumber: file.sequenceNumber,
      description: file.description,
      diskChecksum: file.checksum,
      appliedChecksum: applied ? applied.checksum_sha256 : null,
      checksumMatches,
      state,
      executedAt: applied ? applied.executed_at : null,
      executedBy: applied ? applied.executed_by : null,
      executionTimeMs: applied ? applied.execution_time_ms : null,
      environment: applied ? applied.environment : null
    };
  });

  const pending = summary.filter(s => s.state === 'PENDING' || s.state === 'FAILED');
  const applied = summary.filter(s => s.state === 'APPLIED' || s.state === 'BASELINE');
  const tampered = summary.filter(s => appliedMap.has(s.filename) && !s.checksumMatches);

  return {
    totalOnDisk: diskFiles.length,
    totalApplied: applied.length,
    totalPending: pending.length,
    totalTampered: tampered.length,
    all: summary,
    pending,
    applied,
    tampered
  };
}

/**
 * Registra una migración como BASELINE (para reconciliación de esquemas restaurados)
 */
async function registerBaseline(client, migration, environment = 'test', executedBy = 'system_baseline') {
  await ensureMigrationTable(client);
  await client.query(`
    INSERT INTO admin.schema_migrations
      (migration_id, sequence_number, name, description, checksum_sha256, executed_at, executed_by, execution_time_ms, status, environment, details)
    VALUES
      ($1, $2, $3, $4, $5, clock_timestamp(), $6, 0, 'BASELINE', $7, $8)
    ON CONFLICT (migration_id) DO UPDATE
    SET checksum_sha256 = EXCLUDED.checksum_sha256,
        status = 'BASELINE',
        environment = EXCLUDED.environment,
        details = EXCLUDED.details
  `, [
    migration.filename,
    migration.sequenceNumber,
    migration.filename.replace('.sql', ''),
    migration.description,
    migration.checksum,
    executedBy,
    environment,
    JSON.stringify({ baselineReconciled: true, reconciledAt: new Date().toISOString() })
  ]);
}

/**
 * Ejecuta una migración individual transaccionalmente
 */
async function executeMigration(client, migration, environment = 'test', executedBy = 'system') {
  await ensureMigrationTable(client);

  const startTime = Date.now();
  console.log(`[EJECUTANDO] ${migration.filename}...`);

  try {
    await client.query('BEGIN');

    // Ejecutar el SQL de la migración
    await client.query(migration.content);

    const durationMs = Date.now() - startTime;

    // Registrar en admin.schema_migrations
    await client.query(`
      INSERT INTO admin.schema_migrations
        (migration_id, sequence_number, name, description, checksum_sha256, executed_at, executed_by, execution_time_ms, status, environment, details)
      VALUES
        ($1, $2, $3, $4, $5, clock_timestamp(), $6, $7, 'APPLIED', $8, $9)
      ON CONFLICT (migration_id) DO UPDATE
      SET checksum_sha256 = EXCLUDED.checksum_sha256,
          executed_at = clock_timestamp(),
          executed_by = EXCLUDED.executed_by,
          execution_time_ms = EXCLUDED.execution_time_ms,
          status = 'APPLIED',
          environment = EXCLUDED.environment,
          details = EXCLUDED.details
    `, [
      migration.filename,
      migration.sequenceNumber,
      migration.filename.replace('.sql', ''),
      migration.description,
      migration.checksum,
      executedBy,
      durationMs,
      environment,
      JSON.stringify({ executedSuccessfully: true })
    ]);

    await client.query('COMMIT');
    console.log(`[OK - APLICADA] ${migration.filename} (${durationMs}ms)`);
    return { success: true, durationMs };

  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {}

    const durationMs = Date.now() - startTime;
    console.error(`[FALLO - ROLLBACK] Error en ${migration.filename}: ${err.message}`);

    // Registrar intento fallido para auditoría
    try {
      await client.query(`
        INSERT INTO admin.schema_migrations
          (migration_id, sequence_number, name, description, checksum_sha256, executed_at, executed_by, execution_time_ms, status, environment, details)
        VALUES
          ($1, $2, $3, $4, $5, clock_timestamp(), $6, $7, 'FAILED', $8, $9)
        ON CONFLICT (migration_id) DO UPDATE
        SET status = 'FAILED',
            executed_at = clock_timestamp(),
            details = EXCLUDED.details
      `, [
        migration.filename,
        migration.sequenceNumber,
        migration.filename.replace('.sql', ''),
        migration.description,
        migration.checksum,
        executedBy,
        durationMs,
        environment,
        JSON.stringify({ error: err.message, stack: err.stack?.slice(0, 500) })
      ]);
    } catch (logErr) {}

    throw err;
  }
}

/**
 * Asegura la existencia de la tabla de auditoría inmutable admin.schema_migrations_log
 */
async function ensureMigrationLogTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS admin.schema_migrations_log (
      log_id BIGSERIAL PRIMARY KEY,
      migration_id VARCHAR(100) NOT NULL,
      sequence_number INTEGER NOT NULL,
      action VARCHAR(50) NOT NULL,
      previous_status VARCHAR(20),
      new_status VARCHAR(20) NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
      executed_by VARCHAR(100) NOT NULL DEFAULT current_user,
      details JSONB
    );
    CREATE INDEX IF NOT EXISTS idx_schema_migrations_log_mig ON admin.schema_migrations_log (migration_id);
  `);
}

/**
 * Reconcilia de forma controlada y transaccional una migración cuyo objetivo ya está satisfecho
 * por la estructura física existente, preservando de forma inmutable el historial de intentos fallidos.
 */
async function reconcileMigration(client, migrationFilename, options = {}) {
  await ensureMigrationTable(client);
  await ensureMigrationLogTable(client);

  const {
    environment = 'test',
    executedBy = 'system_reconciliation',
    reason = 'Objetivo funcional cubierto por estructura existente',
    identityVerification = null
  } = options;

  const allFiles = getMigrationFiles();
  const fileObj = allFiles.find(f => f.filename === migrationFilename);
  if (!fileObj) {
    throw new Error(`Archivo de migración no encontrado en disco: ${migrationFilename}`);
  }

  const curRes = await client.query(
    'SELECT * FROM admin.schema_migrations WHERE migration_id = $1',
    [migrationFilename]
  );
  const currentRow = curRes.rows[0];

  await client.query('BEGIN');
  try {
    // 1. Si había un intento previo (ej. FAILED), registrarlo en el log de auditoría
    if (currentRow) {
      await client.query(`
        INSERT INTO admin.schema_migrations_log
          (migration_id, sequence_number, action, previous_status, new_status, executed_at, executed_by, details)
        VALUES
          ($1, $2, 'RECORD_PRIOR_STATE', $3, $3, $4, $5, $6)
      `, [
        currentRow.migration_id,
        currentRow.sequence_number,
        currentRow.status,
        currentRow.executed_at,
        currentRow.executed_by,
        currentRow.details
      ]);
    }

    // 2. Construir metadata completa combinando auditoría de fallo y reconciliación
    const combinedDetails = {
      reconciliation: {
        reconciledAt: new Date().toISOString(),
        reconciledBy: executedBy,
        type: 'HISTORICAL_ADOPTION_IDENTITY_COVERAGE',
        reason,
        sqlExecutionConfirmed: false,
        identityVerification,
        checksumVerified: true,
        checksumSha256: fileObj.checksum
      },
      priorHistory: currentRow ? {
        previousStatus: currentRow.status,
        attemptedAt: currentRow.executed_at,
        executionTimeMs: currentRow.execution_time_ms,
        priorDetails: currentRow.details
      } : null
    };

    // 3. Registrar en admin.schema_migrations con estado BASELINE
    await client.query(`
      INSERT INTO admin.schema_migrations
        (migration_id, sequence_number, name, description, checksum_sha256, executed_at, executed_by, execution_time_ms, status, environment, details)
      VALUES
        ($1, $2, $3, $4, $5, clock_timestamp(), $6, 0, 'BASELINE', $7, $8)
      ON CONFLICT (migration_id) DO UPDATE
      SET status = 'BASELINE',
          checksum_sha256 = EXCLUDED.checksum_sha256,
          executed_at = clock_timestamp(),
          executed_by = EXCLUDED.executed_by,
          execution_time_ms = 0,
          environment = EXCLUDED.environment,
          details = EXCLUDED.details
    `, [
      fileObj.filename,
      fileObj.sequenceNumber,
      fileObj.filename.replace('.sql', ''),
      fileObj.description,
      fileObj.checksum,
      executedBy,
      environment,
      JSON.stringify(combinedDetails)
    ]);

    // 4. Registrar en admin.schema_migrations_log el evento de reconciliación
    await client.query(`
      INSERT INTO admin.schema_migrations_log
        (migration_id, sequence_number, action, previous_status, new_status, executed_at, executed_by, details)
      VALUES
        ($1, $2, 'RECONCILED_AS_BASELINE', $3, 'BASELINE', clock_timestamp(), $4, $5)
    `, [
      fileObj.filename,
      fileObj.sequenceNumber,
      currentRow ? currentRow.status : 'PENDING',
      executedBy,
      JSON.stringify(combinedDetails)
    ]);

    await client.query('COMMIT');
    return { success: true, migrationId: migrationFilename, combinedDetails };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

module.exports = {
  MIGRATION_ADVISORY_LOCK_ID,
  calculateChecksum,
  extractDescription,
  getMigrationFiles,
  ensureMigrationTable,
  ensureMigrationLogTable,
  acquireAdvisoryLock,
  releaseAdvisoryLock,
  getAppliedMigrations,
  getMigrationStatus,
  registerBaseline,
  executeMigration,
  reconcileMigration
};
