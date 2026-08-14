const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

// Read DATABASE_URL from .env.local
let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  const envPath = path.join(__dirname, "../../../.env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const match = envContent.match(/^\s*DATABASE_URL="?([^"\r\n]+)"?/m);
    if (match) connectionString = match[1];
  }
}
if (!connectionString) {
  connectionString = "postgresql://biker:Sarita4171995@127.0.0.1:15432/bikers";
}

async function runMigration(options = {}) {
  const isDryRun = options.dryRun || process.argv.includes("--dry-run");
  const usuarioEjecucion = options.usuarioId || null;
  const migracionEjecucionId = crypto.randomUUID();

  console.log(`[MIGRATION RUNNER] Initiating version 20260812_01_workshop_order_states_v2...`);
  console.log(`[MIGRATION EXECUTION ID]: ${migracionEjecucionId}`);
  console.log(`[DRY RUN MODE]: ${isDryRun ? "YES (Will ROLLBACK at end)" : "NO (Will COMMIT)"}`);

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if migration already executed
    const checkVersion = await client.query(
      `SELECT version FROM admin.schema_migrations WHERE version = $1`,
      ["20260812_01_workshop_order_states_v2"]
    );
    if (checkVersion.rows.length > 0 && !isDryRun) {
      console.log("[MIGRATION ALREADY APPLIED] Skipping execution.");
      await client.query("ROLLBACK");
      return;
    }

    // Check pre-existing duplicate open sessions before creating index
    const dupCheck = await client.query(`
      SELECT orden_servicio_id, COUNT(*)::int AS sesiones_abiertas
      FROM admin.orden_servicio_mano_obra
      WHERE fecha_finalizacion IS NULL AND (activo IS DISTINCT FROM false)
      GROUP BY orden_servicio_id
      HAVING COUNT(*) > 1;
    `);

    if (dupCheck.rows.length > 0) {
      console.error("[MIGRATION ABORTED] Duplicate open time sessions found in DB:", dupCheck.rows);
      throw new Error(`Inconsistencia en BD: ${dupCheck.rows.length} servicio(s) poseen múltiples sesiones abiertas. Resuélvalas antes de aplicar la migración.`);
    }

    // Create DDL structure
    const sqlScriptPath = path.join(__dirname, "20260812_01_workshop_order_states_v2.sql");
    if (fs.existsSync(sqlScriptPath)) {
      const ddlSql = fs.readFileSync(sqlScriptPath, "utf8");
      await client.query(ddlSql);
    }

    // Create backup table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin.orden_estado_migracion_respaldo (
        migracion_ejecucion_id uuid NOT NULL,
        orden_trabajo_id integer NOT NULL,
        estado_orden_id_original integer NOT NULL,
        estado_orden_id_asignado integer NOT NULL,
        criterio_clasificacion text NOT NULL,
        fecha_ejecucion timestamptz NOT NULL DEFAULT NOW(),
        usuario_ejecucion integer NULL,
        version_migracion varchar(50) NOT NULL,
        rollback_ejecutado boolean NOT NULL DEFAULT false,
        PRIMARY KEY (migracion_ejecucion_id, orden_trabajo_id)
      );
    `);

    // Insert backup rows BEFORE updating any order
    const backupRes = await client.query(`
      INSERT INTO admin.orden_estado_migracion_respaldo (
        migracion_ejecucion_id,
        orden_trabajo_id,
        estado_orden_id_original,
        estado_orden_id_asignado,
        criterio_clasificacion,
        fecha_ejecucion,
        usuario_ejecucion,
        version_migracion,
        rollback_ejecutado
      )
      SELECT 
        $1::uuid,
        ot.orden_trabajo_id,
        ot.estado_orden_id AS estado_orden_id_original,
        CASE 
          WHEN (SELECT COUNT(*) FROM admin.orden_servicios os WHERE os.orden_trabajo_id = ot.orden_trabajo_id AND (os.activo IS DISTINCT FROM false)) > 0
           AND (SELECT COUNT(*) FROM admin.orden_servicios os WHERE os.orden_trabajo_id = ot.orden_trabajo_id AND os.estado_orden_servicio_id != 3 AND (os.activo IS DISTINCT FROM false)) = 0
          THEN 7

          WHEN (SELECT COUNT(*) FROM admin.orden_servicios os WHERE os.orden_trabajo_id = ot.orden_trabajo_id AND os.estado_orden_servicio_id IN (2, 3, 5) AND (os.activo IS DISTINCT FROM false)) > 0
            OR (SELECT COUNT(*) FROM admin.orden_servicio_mano_obra mo JOIN admin.orden_servicios os ON mo.orden_servicio_id = os.orden_servicio_id WHERE os.orden_trabajo_id = ot.orden_trabajo_id) > 0
            OR (SELECT COUNT(*) FROM admin.orden_productos op WHERE op.orden_trabajo_id = ot.orden_trabajo_id AND (op.activo IS DISTINCT FROM false)) > 0
          THEN 5

          ELSE 1
        END AS estado_orden_id_asignado,
        'Clasificación Mutuamente Excluyente v2' AS criterio_clasificacion,
        NOW(),
        $2,
        '20260812_01_workshop_order_states_v2',
        false
      FROM admin.ordenes_trabajo ot
      WHERE ot.estado_orden_id IN (2, 3, 4, 6) AND ot.activo = true
      ON CONFLICT DO NOTHING
      RETURNING orden_trabajo_id, estado_orden_id_original, estado_orden_id_asignado;
    `, [migracionEjecucionId, usuarioEjecucion]);

    console.log(`[BACKUP CREATED] ${backupRes.rowCount} orders backed up for execution ID ${migracionEjecucionId}.`);

    // Perform atomic classification update
    const updateRes = await client.query(`
      UPDATE admin.ordenes_trabajo ot
      SET estado_orden_id = r.estado_orden_id_asignado,
          fecha_actualizacion = NOW()
      FROM admin.orden_estado_migracion_respaldo r
      WHERE ot.orden_trabajo_id = r.orden_trabajo_id
        AND r.migracion_ejecucion_id = $1::uuid;
    `, [migracionEjecucionId]);

    console.log(`[RECLASSIFICATION UPDATE] ${updateRes.rowCount} work orders updated.`);

    // Insert history audit rows
    await client.query(`
      INSERT INTO admin.orden_historial_estado (
        orden_trabajo_id, estado_anterior_id, estado_nuevo_id,
        usuario_cambio, comentario, motivo, metadata, fecha_cambio, activo, fecha_registro
      )
      SELECT 
        r.orden_trabajo_id,
        r.estado_orden_id_original,
        r.estado_orden_id_asignado,
        r.usuario_ejecucion,
        'Reclasificación de estado por migración v2',
        r.criterio_clasificacion,
        jsonb_build_object(
          'migracion_ejecucion_id', r.migracion_ejecucion_id,
          'version_migracion', r.version_migracion,
          'criterio', r.criterio_clasificacion
        ),
        NOW(),
        true,
        NOW()
      FROM admin.orden_estado_migracion_respaldo r
      WHERE r.migracion_ejecucion_id = $1::uuid;
    `, [migracionEjecucionId]);

    // Record schema_migrations entry
    await client.query(`
      INSERT INTO admin.schema_migrations (version, ejecutado_en, ejecutado_por, metadata)
      VALUES ($1, NOW(), $2, $3::jsonb)
      ON CONFLICT (version) DO UPDATE SET ejecutado_en = NOW();
    `, [
      "20260812_01_workshop_order_states_v2",
      usuarioEjecucion,
      JSON.stringify({ migracion_ejecucion_id: migracionEjecucionId, reclassified_count: updateRes.rowCount })
    ]);

    if (isDryRun) {
      console.log("[DRY RUN COMPLETE] Rolling back all changes as requested.");
      await client.query("ROLLBACK");
    } else {
      await client.query("COMMIT");
      console.log("[MIGRATION SUCCESS] Version 20260812_01_workshop_order_states_v2 applied successfully.");
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[MIGRATION ERROR]:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runMigration };
