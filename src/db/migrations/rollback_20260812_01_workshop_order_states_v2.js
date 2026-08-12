const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  const envPath = path.join(__dirname, "../../../.env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const match = envContent.match(/DATABASE_URL="?([^"\r\n]+)"?/);
    if (match) connectionString = match[1];
  }
}
if (!connectionString) {
  connectionString = "postgresql://biker:Sarita4171995@127.0.0.1:15432/bikers";
}

async function rollbackMigration(executionId) {
  if (!executionId) {
    throw new Error("Debes proporcionar el UUID de la ejecución a revertir (migracionEjecucionId).");
  }

  console.log(`[ROLLBACK RUNNER] Initiating rollback for execution ID ${executionId}...`);

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // DDL: Create conflict table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin.orden_migracion_conflictos (
        conflicto_id serial PRIMARY KEY,
        migracion_ejecucion_id uuid NOT NULL,
        orden_trabajo_id integer NOT NULL REFERENCES admin.ordenes_trabajo(orden_trabajo_id),
        estado_original integer NOT NULL,
        estado_asignado_migracion integer NOT NULL,
        estado_encontrado_actual integer NOT NULL,
        fecha_deteccion timestamptz NOT NULL DEFAULT NOW(),
        resolucion text NULL DEFAULT 'PENDIENTE_REVISION',
        CONSTRAINT uq_conflicto_migracion_orden UNIQUE (migracion_ejecucion_id, orden_trabajo_id)
      );
    `);

    // 1. Identify conflicts BEFORE modifying any order
    const conflictRes = await client.query(`
      INSERT INTO admin.orden_migracion_conflictos (
        migracion_ejecucion_id, orden_trabajo_id, estado_original, estado_asignado_migracion, estado_encontrado_actual
      )
      SELECT 
        r.migracion_ejecucion_id, ot.orden_trabajo_id, r.estado_orden_id_original, r.estado_orden_id_asignado, ot.estado_orden_id
      FROM admin.ordenes_trabajo ot
      JOIN admin.orden_estado_migracion_respaldo r ON ot.orden_trabajo_id = r.orden_trabajo_id
      WHERE r.migracion_ejecucion_id = $1::uuid
        AND ot.estado_orden_id != r.estado_orden_id_asignado
        AND r.rollback_ejecutado = false
      ON CONFLICT ON CONSTRAINT uq_conflicto_migracion_orden DO NOTHING
      RETURNING orden_trabajo_id;
    `, [executionId]);

    console.log(`[ROLLBACK CONFLICTS DETECTED] ${conflictRes.rowCount} orders have conflicts (state changed after migration).`);

    // 2. Restore ONLY orders that are NOT in conflict (current state == state assigned by migration)
    const restoreRes = await client.query(`
      WITH ordenes_restauradas AS (
        UPDATE admin.ordenes_trabajo ot
        SET estado_orden_id = r.estado_orden_id_original,
            fecha_actualizacion = NOW()
        FROM admin.orden_estado_migracion_respaldo r
        WHERE ot.orden_trabajo_id = r.orden_trabajo_id
          AND r.migracion_ejecucion_id = $1::uuid
          AND ot.estado_orden_id = r.estado_orden_id_asignado
          AND r.rollback_ejecutado = false
        RETURNING ot.orden_trabajo_id
      )
      SELECT COUNT(*)::int AS count FROM ordenes_restauradas;
    `, [executionId]);

    const restoredCount = restoreRes.rows[0]?.count || 0;
    console.log(`[ROLLBACK RESTORED] ${restoredCount} orders restored to original state.`);

    // 3. Mark rollback_ejecutado = true ONLY for orders successfully restored
    await client.query(`
      UPDATE admin.orden_estado_migracion_respaldo
      SET rollback_ejecutado = true
      WHERE migracion_ejecucion_id = $1::uuid
        AND orden_trabajo_id NOT IN (
          SELECT orden_trabajo_id FROM admin.orden_migracion_conflictos WHERE migracion_ejecucion_id = $1::uuid
        );
    `, [executionId]);

    // 4. Delete migration history entries ONLY for restored orders
    await client.query(`
      DELETE FROM admin.orden_historial_estado
      WHERE (metadata->>'migracion_ejecucion_id') = $1::text
        AND orden_trabajo_id NOT IN (
          SELECT orden_trabajo_id FROM admin.orden_migracion_conflictos WHERE migracion_ejecucion_id = $1::uuid
        );
    `, [executionId]);

    // 5. Check remaining unresolved conflicts
    const pendingConflictsRes = await client.query(`
      SELECT COUNT(*)::int AS count
      FROM admin.orden_migracion_conflictos
      WHERE migracion_ejecucion_id = $1::uuid AND resolucion = 'PENDIENTE_REVISION';
    `, [executionId]);

    const pendingConflicts = pendingConflictsRes.rows[0]?.count || 0;

    if (pendingConflicts === 0) {
      // Re-enable catalog states if all conflicts resolved
      await client.query(`UPDATE admin.estado_orden_trabajo SET activo = true WHERE estado_orden_id IN (2, 3, 4, 6);`);
      await client.query(`DELETE FROM admin.schema_migrations WHERE version = '20260812_01_workshop_order_states_v2';`);
      console.log("[ROLLBACK COMPLETE] Schema migration record cleared.");
    } else {
      console.log(`[ROLLBACK PARTIAL] ${pendingConflicts} conflict(s) remain unresolved. schema_migrations kept for audit.`);
    }

    await client.query("COMMIT");

    return {
      restauradas: restoredCount,
      conflictivas: conflictRes.rowCount,
      pendientes_conflicto: pendingConflicts
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[ROLLBACK ERROR]:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

module.exports = { rollbackMigration };
