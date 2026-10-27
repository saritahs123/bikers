/**
 * SCRIPT ADMINISTRATIVO CONTROLADO — TEST LOCAL EXCLUSIVO
 * Archivo: scripts/fix_test_role_dashboard_access.js
 * Fase: 6.4.1 — Ride Lab
 *
 * Propósito:
 * Corregir exclusivamente el permiso de visualización de Dashboard General
 * (pantalla_id: 1, 'DASHBOARD_MAIN') para el rol de pruebas TEST_ROL_SOLO_LECTURA
 * (rol_funcional_id: 112) en la base de datos local bikers_dbtest.
 *
 * Restricciones:
 * - Conexión exclusiva a 127.0.0.1:5432/bikers_dbtest.
 * - Validación estricta previa de rol y pantalla.
 * - Ejecución en transacción atómica con validación de rowCount === 1.
 * - Idempotente.
 * - Cero credenciales expuestas en logs.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadTestEnv() {
  const envPath = path.resolve(process.cwd(), '.env.test.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Za-z0-9_]+)=(.*)$/);
      if (match) {
        const key = match[1];
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
}

async function fixTestRoleDashboardAccess() {
  loadTestEnv();

  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    console.error('[ERROR] DATABASE_URL no configurada en el entorno.');
    process.exit(1);
  }

  let url;
  try {
    url = new URL(connStr);
  } catch {
    console.error('[ERROR] Formato inválido de DATABASE_URL.');
    process.exit(1);
  }

  const host = url.hostname;
  const port = url.port || '5432';
  const dbName = url.pathname.replace(/^\//, '');

  if (host !== '127.0.0.1' && host !== 'localhost') {
    console.error(`[BLOQUEO DE SEGURIDAD] Host no autorizado: ${host}. Solo se permite 127.0.0.1.`);
    process.exit(1);
  }

  if (dbName !== 'bikers_dbtest') {
    console.error(`[BLOQUEO DE SEGURIDAD] Base no autorizada: ${dbName}. Solo se permite bikers_dbtest.`);
    process.exit(1);
  }

  console.log('======================================================================');
  console.log('--- CORRECCIÓN CONTROLADA RBAC: ROL TEST_ROL_SOLO_LECTURA ---');
  console.log(`Destino validado: ${host}:${port}/${dbName}`);
  console.log('======================================================================\n');

  const client = new Client({ connectionString: connStr });
  await client.connect();

  try {
    await client.query('BEGIN');

    // 1. Validar que rol 112 existe y corresponde a TEST_ROL_SOLO_LECTURA
    const roleRes = await client.query(`
      SELECT rol_funcional_id, nombre, estado
      FROM admin.rol_funcional
      WHERE rol_funcional_id = 112
    `);

    if (roleRes.rows.length === 0) {
      throw new Error('Rol funcional ID 112 no encontrado en admin.rol_funcional.');
    }

    const role = roleRes.rows[0];
    if (role.nombre !== 'TEST_ROL_SOLO_LECTURA') {
      throw new Error(`Rol funcional 112 no es TEST_ROL_SOLO_LECTURA (Nombre actual: ${role.nombre}).`);
    }

    console.log(`[OK] Rol validado: ID ${role.rol_funcional_id} - ${role.nombre} (${role.estado})`);

    // 2. Validar que pantalla 1 existe y corresponde a DASHBOARD_MAIN (ruta '/')
    const screenRes = await client.query(`
      SELECT pantalla_id, codigo, nombre, ruta, activo
      FROM admin.pantalla_sistema
      WHERE pantalla_id = 1
    `);

    if (screenRes.rows.length === 0) {
      throw new Error('Pantalla sistema ID 1 no encontrada en admin.pantalla_sistema.');
    }

    const screen = screenRes.rows[0];
    if (screen.codigo !== 'DASHBOARD_MAIN' || screen.ruta !== '/') {
      throw new Error(`Pantalla ID 1 no coincide con DASHBOARD_MAIN y ruta '/' (Código: ${screen.codigo}, Ruta: ${screen.ruta}).`);
    }

    console.log(`[OK] Pantalla validada: ID ${screen.pantalla_id} - ${screen.codigo} (${screen.ruta})`);

    // 3. Inspeccionar el registro actual en matriz_acceso_pantalla
    const currentRes = await client.query(`
      SELECT matriz_pantalla_id, rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_eliminar
      FROM admin.matriz_acceso_pantalla
      WHERE rol_funcional_id = 112 AND pantalla_id = 1
    `);

    if (currentRes.rows.length === 0) {
      throw new Error('No existe registro en admin.matriz_acceso_pantalla para rol 112 y pantalla 1.');
    }

    const currentMap = currentRes.rows[0];
    console.log('[INFO] Estado actual en admin.matriz_acceso_pantalla:', {
      id: currentMap.matriz_pantalla_id,
      rol_id: currentMap.rol_funcional_id,
      pantalla_id: currentMap.pantalla_id,
      puede_ver: currentMap.puede_ver,
      puede_crear: currentMap.puede_crear,
      puede_editar: currentMap.puede_editar,
      puede_eliminar: currentMap.puede_eliminar
    });

    if (
      currentMap.puede_ver === false &&
      currentMap.puede_crear === false &&
      currentMap.puede_editar === false &&
      currentMap.puede_eliminar === false
    ) {
      console.log('[IDEMPOTENTE] El registro ya tiene todos los permisos en false. No se requieren cambios.');
      await client.query('COMMIT');
      return;
    }

    // 4. Actualizar exclusivamente la fila objetivo
    const updateRes = await client.query(`
      UPDATE admin.matriz_acceso_pantalla
      SET
        puede_ver = false,
        puede_crear = false,
        puede_editar = false,
        puede_eliminar = false,
        puede_inactivar = false,
        puede_exportar = false,
        puede_importar = false,
        puede_aprobar = false,
        puede_asignar = false,
        puede_mover = false,
        puede_cerrar = false,
        puede_reabrir = false,
        fecha_actualizacion = NOW()
      WHERE rol_funcional_id = 112 AND pantalla_id = 1
    `);

    if (updateRes.rowCount !== 1) {
      throw new Error(`Se esperaba actualizar exactamente 1 fila, pero se afectaron ${updateRes.rowCount} filas.`);
    }

    // 5. Verificar estado posterior
    const verifyRes = await client.query(`
      SELECT matriz_pantalla_id, rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_eliminar
      FROM admin.matriz_acceso_pantalla
      WHERE rol_funcional_id = 112 AND pantalla_id = 1
    `);

    const updated = verifyRes.rows[0];
    if (updated.puede_ver !== false || updated.puede_crear !== false || updated.puede_editar !== false || updated.puede_eliminar !== false) {
      throw new Error('Verificación fallida: Los permisos no quedaron en false tras el update.');
    }

    console.log('[OK] Verificación post-update exitosa:', {
      id: updated.matriz_pantalla_id,
      rol_id: updated.rol_funcional_id,
      pantalla_id: updated.pantalla_id,
      puede_ver: updated.puede_ver,
      puede_crear: updated.puede_crear,
      puede_editar: updated.puede_editar,
      puede_eliminar: updated.puede_eliminar
    });

    await client.query('COMMIT');
    console.log('\n[ÉXITO] Transacción confirmada (COMMIT). Permiso revocado de manera segura y definitiva.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n[ROLLBACK EJECUTADO] Error durante la operación:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  fixTestRoleDashboardAccess().catch((err) => {
    console.error('[FATAL]', err);
    process.exit(1);
  });
}

module.exports = { fixTestRoleDashboardAccess };
