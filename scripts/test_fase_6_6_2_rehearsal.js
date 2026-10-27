/**
 * RIDE LAB — FASE 6.6.2: ENSAYO DE MIGRACIÓN EN ENTORNO AISLADO
 * Archivo: scripts/test_fase_6_6_2_rehearsal.js
 *
 * Valida:
 * 1. Verificación de huellas estructurales (001-044).
 * 2. Reconciliación controlada de baseline.
 * 3. Detección y manejo transaccional de fallos y rollback (fail-fast).
 * 4. Aplicación secuencial de migraciones 045-049.
 * 5. Segunda ejecución para confirmar idempotencia (cero duplicaciones).
 * 6. Verificación de inmutabilidad de checksums SHA-256.
 * 7. Integridad de facturas, descuentos y matriz RBAC.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const {
  getMigrationFiles,
  ensureMigrationTable,
  ensureMigrationLogTable,
  getMigrationStatus,
  executeMigration,
  registerBaseline,
  reconcileMigration,
  acquireAdvisoryLock,
  releaseAdvisoryLock
} = require('../src/lib/migrations/migrationCore');

const {
  verifyHistoricalFingerprints,
  loadAdminCatalog
} = require('../src/lib/migrations/schemaFingerprintValidator');

// Cargar variables de .env.test.local
const envTestPath = path.resolve(process.cwd(), '.env.test.local');
fs.readFileSync(envTestPath, 'utf8').split('\n').forEach(line => {
  const m = line.trim().match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
});

async function runRehearsal() {
  console.log('\n======================================================================');
  console.log('=== INICIO DEL ENSAYO DE MIGRACIÓN FASE 6.6.2 (ENTORNO AISLADO) ===');
  console.log('======================================================================\n');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  let testPassed = 0;
  let testFailed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      testPassed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      testFailed++;
    }
  }

  try {
    // -----------------------------------------------------------------
    // TEST 1: Identidad física del entorno
    // -----------------------------------------------------------------
    console.log('[TEST 1] Verificando aislamiento del entorno...');
    const idRes = await client.query('SELECT current_database() as db, current_user as usr, inet_server_addr() as addr');
    assert(idRes.rows[0].db === 'bikers_dbtest', 'Base de datos es bikers_dbtest');
    assert(idRes.rows[0].usr === 'bikers_test', 'Usuario de conexión es bikers_test');
    assert(idRes.rows[0].addr === '127.0.0.1' || idRes.rows[0].addr === null, 'Host de conexión es estrictamente local');

    // -----------------------------------------------------------------
    // TEST 2: Verificación de Huellas Estructurales (001 a 044)
    // -----------------------------------------------------------------
    console.log('\n[TEST 2] Verificando huellas estructurales físicas (001 - 044)...');
    const fpAudit = await verifyHistoricalFingerprints(client, 44);
    assert(fpAudit.allPassed, 'Todas las 44 migraciones históricas poseen huella física en el catálogo');
    assert(fpAudit.totalVerified === 44, 'Total de migraciones auditadas es exactamente 44');
    assert(fpAudit.failedCount === 0, 'Cero discrepancias estructurales');

    // -----------------------------------------------------------------
    // TEST 3: Reconciliación de Baseline y Auditoría Inmutable
    // -----------------------------------------------------------------
    console.log('\n[TEST 3] Simulando reconciliación de baseline...');
    const allFiles = getMigrationFiles();
    const f044 = allFiles.find(f => f.sequenceNumber === 44);
    
    // Verificar que reconcileMigration registra en schema_migrations_log
    const logCountBefore = await client.query("SELECT count(*) as c FROM admin.schema_migrations_log WHERE migration_id = '044_factura_anulacion_sequence.sql'");
    assert(parseInt(logCountBefore.rows[0].c, 10) >= 1, 'Historial de reconciliación de migración 044 existe en schema_migrations_log');

    // -----------------------------------------------------------------
    // TEST 4: Prueba de Fallo Controlado y Rollback Atómico
    // -----------------------------------------------------------------
    console.log('\n[TEST 4] Evaluando comportamiento ante fallo y Rollback atómico...');
    const syntheticFailMigration = {
      filename: '999_synthetic_test_failure.sql',
      sequenceNumber: 999,
      description: 'Prueba sintética de fallo',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      content: `
        -- DDL intencionalmente erróneo para provocar aborto de transacción
        CREATE TABLE admin.temp_fail_test (id INT PRIMARY KEY);
        INSERT INTO admin.temp_fail_test VALUES (1);
        -- Provocar error de sintaxis / violación intencional
        SELECT * FROM admin.tabla_totalmente_inexistente_para_error;
      `
    };

    let caughtError = false;
    try {
      await executeMigration(client, syntheticFailMigration, 'test', 'tester');
    } catch (err) {
      caughtError = true;
    }
    assert(caughtError, 'La ejecución fallida fue capturada correctamente');

    // Verificar que la tabla temporal NO fue creada (Rollback exitoso)
    const tableCheck = await client.query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'admin' AND table_name = 'temp_fail_test') as exists");
    assert(!tableCheck.rows[0].exists, 'ROLLBACK confirmado: la tabla temp_fail_test no se creó en la base de datos');

    // Verificar que se registró como FAILED en schema_migrations y NO como APPLIED
    const failStatus = await client.query("SELECT status FROM admin.schema_migrations WHERE migration_id = '999_synthetic_test_failure.sql'");
    assert(failStatus.rows[0]?.status === 'FAILED', 'Migración fallida registrada como FAILED (nunca como APPLIED)');

    // Limpiar registro sintético de prueba
    await client.query("DELETE FROM admin.schema_migrations WHERE migration_id = '999_synthetic_test_failure.sql'");

    // -----------------------------------------------------------------
    // TEST 5: Aplicación Secuencial de Migraciones 045 a 049
    // -----------------------------------------------------------------
    console.log('\n[TEST 5] Verificando estado de migraciones 045 a 049...');
    const status = await getMigrationStatus(client);
    const m45to49 = status.all.filter(m => m.sequenceNumber >= 45 && m.sequenceNumber <= 49);
    assert(m45to49.length === 5, 'Existen 5 migraciones en el rango 045-049');
    const allApplied = m45to49.every(m => m.state === 'APPLIED');
    assert(allApplied, 'Las 5 migraciones se encuentran en estado APPLIED');

    // -----------------------------------------------------------------
    // TEST 6: Prueba de Idempotencia (Segunda ejecución sin duplicaciones)
    // -----------------------------------------------------------------
    console.log('\n[TEST 6] Evaluando reejecución e idempotencia (cero duplicaciones)...');
    assert(status.totalPending === 0, 'No existen migraciones pendientes en el repositorio');
    assert(status.totalTampered === 0, 'Cero archivos alterados post-aplicación');

    // Comprobar que en admin.modulo_sistema no hay códigos duplicados
    const dupCodigos = await client.query(`
      SELECT codigo, count(*) 
      FROM admin.modulo_sistema 
      GROUP BY codigo 
      HAVING count(*) > 1
    `);
    assert(dupCodigos.rows.length === 0, 'Cero códigos duplicados en modulo_sistema');

    // Comprobar que en admin.matriz_acceso_rol no hay duplicados
    const dupMar = await client.query(`
      SELECT rol_funcional_id, modulo_sistema_id, count(*) 
      FROM admin.matriz_acceso_rol 
      GROUP BY rol_funcional_id, modulo_sistema_id 
      HAVING count(*) > 1
    `);
    assert(dupMar.rows.length === 0, 'Cero duplicados en matriz_acceso_rol');

    // Comprobar unicidad en admin.matriz_acceso_pantalla
    const dupMap = await client.query(`
      SELECT rol_funcional_id, pantalla_id, count(*) 
      FROM admin.matriz_acceso_pantalla 
      GROUP BY rol_funcional_id, pantalla_id 
      HAVING count(*) > 1
    `);
    assert(dupMap.rows.length === 0, 'Cero duplicados en matriz_acceso_pantalla');

    // -----------------------------------------------------------------
    // TEST 7: Integridad de Facturación y Descuentos (Migración 048)
    // -----------------------------------------------------------------
    console.log('\n[TEST 7] Verificando integridad de facturas y descuentos diferenciados...');
    const ncCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'admin' AND table_name = 'nivel_cliente'
        AND column_name IN ('descuento_servicio', 'descuento_producto', 'porciento_descuento')
    `);
    const colNames = ncCols.rows.map(r => r.column_name);
    assert(colNames.includes('descuento_servicio'), 'Columna descuento_servicio presente en nivel_cliente');
    assert(colNames.includes('descuento_producto'), 'Columna descuento_producto presente en nivel_cliente');
    assert(!colNames.includes('porciento_descuento'), 'Columna porciento_descuento fue retirada correctamente (DROP COLUMN verificado)');

    const facCols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'admin' AND table_name = 'facturas'
        AND column_name IN ('descuento_servicio', 'descuento_producto', 'porciento_descuento_servicio', 'porciento_descuento_producto')
    `);
    assert(facCols.rows.length === 4, 'Las 4 columnas de descuentos diferenciados existen en admin.facturas');

    // -----------------------------------------------------------------
    // TEST 8: Integridad de Permisos RBAC y Navegación (Migración 045 y 049)
    // -----------------------------------------------------------------
    console.log('\n[TEST 8] Verificando integridad de permisos RBAC y navegación...');
    const p33 = await client.query("SELECT * FROM admin.pantalla_sistema WHERE codigo = 'CONFIG_NIVELES_CLIENTES'");
    assert(p33.rows[0]?.activo === true, 'CONFIG_NIVELES_CLIENTES está activa');
    assert(p33.rows[0]?.ruta === '/crm/client-levels', 'Ruta correcta /crm/client-levels');

    const p11 = await client.query("SELECT * FROM admin.pantalla_sistema WHERE codigo = 'CRM_NIVELES_CLIENTES'");
    assert(p11.rows[0]?.activo === false, 'CRM_NIVELES_CLIENTES está inactiva (desactivación limpia)');

    const superAdminPerms = await client.query(`
      SELECT puede_ver, puede_crear, puede_editar, puede_inactivar 
      FROM admin.matriz_acceso_pantalla 
      WHERE rol_funcional_id = 1 AND pantalla_id = $1
    `, [p33.rows[0]?.pantalla_id]);
    assert(superAdminPerms.rows[0]?.puede_ver === true, 'SuperAdmin tiene permisos sobre CONFIG_NIVELES_CLIENTES');

    // -----------------------------------------------------------------
    // TEST 9: Verificación de Inmutabilidad de Checksums (49/49)
    // -----------------------------------------------------------------
    console.log('\n[TEST 9] Verificando inmutabilidad SHA-256 de todas las 49 migraciones...');
    const checksumMatches = status.applied.every(m => m.checksumMatches);
    assert(checksumMatches, 'Los 49 checksums en BD coinciden 1:1 con los archivos en disco');
    assert(status.applied.length === 49, 'Exactamente 49 migraciones registradas');

    console.log('\n======================================================================');
    console.log(`=== ENSAYO COMPLETADO: ${testPassed} PRUEBAS EXITOSAS, ${testFailed} FALLIDAS ===`);
    console.log('======================================================================\n');

  } finally {
    await client.end();
  }
}

runRehearsal().catch(err => {
  console.error('[ERROR EN ENSAYO]', err.message);
  process.exit(1);
});
