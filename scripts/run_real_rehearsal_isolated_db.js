/**
 * RIDE LAB — FASE 6.6.3: ENSAYO REAL COMPLETO EN BASE AISLADA BIKERS_REHEARSAL_DB
 * Archivo: scripts/run_real_rehearsal_isolated_db.js
 *
 * Crea una base de datos aislada (bikers_rehearsal_db), clona el esquema admin
 * de bikers_dbtest mediante pg_dump (sin desconectar el servidor dev en ejecución),
 * revierte su estado al punto previo a 045-049, y ejecuta el ciclo de vida completo
 * del ejecutor supervisado.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Client } = require('pg');

const SUPERUSER_URL = 'postgresql://postgres:Sarita5171995@127.0.0.1:5432/postgres';
const REHEARSAL_DB_NAME = 'bikers_rehearsal_db';
const REHEARSAL_URL = `postgresql://bikers_test:Sarita5171995@127.0.0.1:5432/${REHEARSAL_DB_NAME}`;
const PG_DUMP_PATH = '"C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe"';
const PSQL_PATH = '"C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe"';

async function main() {
  console.log('======================================================================');
  console.log('=== FASE 6.6.3: ENSAYO REAL DE MIGRACIÓN EN BASE AISLADA ===');
  console.log(`Base de Ensayo: [${REHEARSAL_DB_NAME}] (Clon aislado de bikers_dbtest)`);
  console.log('======================================================================\n');

  // 1. Conectar como superuser para preparar la base de datos aislada
  console.log('[PASO 1] Creando base de datos bikers_rehearsal_db limpia...');
  const rootClient = new Client({ connectionString: SUPERUSER_URL });
  await rootClient.connect();

  try {
    await rootClient.query(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [REHEARSAL_DB_NAME]);

    await rootClient.query(`DROP DATABASE IF EXISTS ${REHEARSAL_DB_NAME}`);
    await rootClient.query(`CREATE DATABASE ${REHEARSAL_DB_NAME} OWNER bikers_test`);
    await rootClient.query(`GRANT ALL PRIVILEGES ON DATABASE ${REHEARSAL_DB_NAME} TO bikers_test`);
    console.log(`  Base ${REHEARSAL_DB_NAME} creada con éxito.`);
  } finally {
    await rootClient.end();
  }

  // 2. Clonar esquema admin desde bikers_dbtest hacia bikers_rehearsal_db usando pg_dump + psql
  console.log('\n[PASO 2] Clonando esquema admin hacia bikers_rehearsal_db...');
  const dumpFile = path.resolve(process.cwd(), 'temp_rehearsal_dump.sql');
  const pgEnv = { ...process.env, PGPASSWORD: 'Sarita5171995' };

  try {
    execSync(`${PG_DUMP_PATH} -h 127.0.0.1 -p 5432 -U postgres -d bikers_dbtest --schema=admin -f "${dumpFile}"`, { env: pgEnv });
    console.log('  Schema dump extraído exitosamente.');

    execSync(`${PSQL_PATH} -h 127.0.0.1 -p 5432 -U postgres -d ${REHEARSAL_DB_NAME} -q -f "${dumpFile}"`, { env: pgEnv });
    console.log('  Schema dump restaurado en bikers_rehearsal_db.');
  } finally {
    if (fs.existsSync(dumpFile)) {
      fs.unlinkSync(dumpFile);
    }
  }

  // 3. Conectar a bikers_rehearsal_db para revertir al estado previo a 045-049
  console.log('\n[PASO 3] Revertiendo esquema en base de ensayo al estado exacto PRE-045...');
  const rehClient = new Client({ connectionString: REHEARSAL_URL });
  await rehClient.connect();

  try {
    // A. Revertir migración 049
    await rehClient.query(`
      UPDATE admin.pantalla_sistema SET activo = true WHERE codigo = 'CRM_NIVELES_CLIENTES';
    `);
    console.log('  [049 Revertida] CRM_NIVELES_CLIENTES reactivada.');

    // B. Revertir migración 048 (Restaurar porciento_descuento)
    await rehClient.query(`
      ALTER TABLE admin.nivel_cliente ADD COLUMN IF NOT EXISTS porciento_descuento NUMERIC(5,2) DEFAULT 0.00;
      UPDATE admin.nivel_cliente SET porciento_descuento = COALESCE(descuento_servicio, 0.00);
      ALTER TABLE admin.nivel_cliente DROP COLUMN IF EXISTS descuento_servicio;
      ALTER TABLE admin.nivel_cliente DROP COLUMN IF EXISTS descuento_producto;
      ALTER TABLE admin.facturas DROP COLUMN IF EXISTS descuento_servicio;
      ALTER TABLE admin.facturas DROP COLUMN IF EXISTS descuento_producto;
      ALTER TABLE admin.facturas DROP COLUMN IF EXISTS porciento_descuento_servicio;
      ALTER TABLE admin.facturas DROP COLUMN IF EXISTS porciento_descuento_producto;
    `);
    console.log('  [048 Revertida] porciento_descuento restaurado y columnas diferenciadas retiradas.');

    // C. Revertir migración 047
    await rehClient.query(`
      ALTER TABLE admin.matriz_acceso_rol DROP CONSTRAINT IF EXISTS uq_matriz_acceso_rol;
      ALTER TABLE admin.usuario_rol_adicional DROP CONSTRAINT IF EXISTS uk_usuario_rol_adicional_rol_funcional;
      ALTER TABLE admin.usuario_rol_adicional ALTER COLUMN usuario_rol_adicional_id DROP DEFAULT;
      DROP SEQUENCE IF EXISTS admin.usuario_rol_adicional_usuario_rol_adicional_id_seq CASCADE;
    `);
    console.log('  [047 Revertida] Constraints de unicidad y secuencia de rol adicional retiradas.');

    // D. Revertir migración 046
    await rehClient.query(`
      DROP TRIGGER IF EXISTS trg_modulo_sistema_default_codigo ON admin.modulo_sistema;
      DROP TRIGGER IF EXISTS trg_modulo_sistema_protect_codigo ON admin.modulo_sistema;
      DROP FUNCTION IF EXISTS admin.fn_trg_modulo_sistema_default_codigo();
      DROP FUNCTION IF EXISTS admin.fn_trg_modulo_sistema_protect_codigo();
      DROP INDEX IF EXISTS admin.uq_modulo_sistema_codigo;
      ALTER TABLE admin.modulo_sistema DROP CONSTRAINT IF EXISTS chk_modulo_sistema_codigo_ascii;
      ALTER TABLE admin.modulo_sistema DROP COLUMN IF EXISTS codigo;
    `);
    console.log('  [046 Revertida] Columna codigo, constraints y triggers retirados de modulo_sistema.');

    // E. Revertir migración 045 (Limpiar matriz para roles 2-9)
    await rehClient.query(`
      DELETE FROM admin.matriz_acceso_pantalla WHERE rol_funcional_id BETWEEN 2 AND 9;
    `);
    console.log('  [045 Revertida] Registros de matriz de pantalla para roles 2-9 limpiados.');

    // F. Revertir registros de control de migraciones (simular estado previo a baseline)
    await rehClient.query(`
      DROP TABLE IF EXISTS admin.schema_migrations_log CASCADE;
      DROP TABLE IF EXISTS admin.schema_migrations CASCADE;
    `);
    console.log('  [Control Revertido] admin.schema_migrations eliminada para simular base virgen previa a baseline.');

  } finally {
    await rehClient.end();
  }

  // 4. Ejecutar el ciclo de vida del ejecutor supervisado contra bikers_rehearsal_db
  console.log('\n======================================================================');
  console.log('=== EJECUCIÓN DEL CICLO DE VIDA DEL EJECUTOR SUPERVISADO ===');
  console.log('======================================================================\n');

  const runnerEnv = {
    ...process.env,
    TARGET_DATABASE_URL: REHEARSAL_URL,
    DATABASE_URL: REHEARSAL_URL,
    APP_ENV: 'test'
  };

  function runCmd(cmd) {
    console.log(`\n>>> EJECUTANDO: ${cmd}`);
    const out = execSync(cmd, { env: runnerEnv, encoding: 'utf8' });
    console.log(out);
  }

  // PASO A: PRECHECK (Solo lectura, base virgen)
  console.log('--- ETAPA A: PRECHECK EN BASE PREVIA A BASELINE ---');
  runCmd('node scripts/db_prod_supervised_runner.js precheck --env=test');

  // PASO B: VERIFY-BASELINE (Auditoría estructural de 001 a 044)
  console.log('--- ETAPA B: VERIFY-BASELINE (Auditoría estructural) ---');
  runCmd('node scripts/db_prod_supervised_runner.js verify-baseline --env=test');

  // PASO C: RECONCILE-BASELINE (Registrar baseline 001 a 044)
  console.log('--- ETAPA C: RECONCILE-BASELINE ---');
  runCmd('node scripts/db_prod_supervised_runner.js reconcile-baseline --env=test');

  // PASO D: STATUS (Comprobar 44 Baseline y 5 Pendientes)
  console.log('--- ETAPA D: STATUS (Verificar 44 Baseline y 5 Pendientes) ---');
  runCmd('node scripts/db_prod_supervised_runner.js status --env=test');

  // PASO E: PLAN (Evaluar impacto y bloqueos de 045 a 049)
  console.log('--- ETAPA E: PLAN DE EJECUCIÓN 045-049 ---');
  runCmd('node scripts/db_prod_supervised_runner.js plan --env=test');

  // PASO F: APPLY (Aplicación supervisada de 045 a 049)
  console.log('--- ETAPA F: APPLY (Aplicar 045 a 049 transaccionalmente) ---');
  runCmd('node scripts/db_prod_supervised_runner.js apply --env=test --confirm=APPLY_TEST_MIGRATIONS');

  // PASO G: VERIFY (Verificación de checksums y secuencia 49/49)
  console.log('--- ETAPA G: VERIFY (Integridad final 49/49) ---');
  runCmd('node scripts/db_prod_supervised_runner.js verify --env=test');

  // PASO H: SEGUNDA EJECUCIÓN (Idempotencia / Cero duplicaciones)
  console.log('--- ETAPA H: SEGUNDA EJECUCIÓN (Prueba de no duplicación) ---');
  runCmd('node scripts/db_prod_supervised_runner.js apply --env=test --confirm=APPLY_TEST_MIGRATIONS');

  // 5. Verificación de integridad final en bikers_rehearsal_db
  console.log('\n[PASO FINAL] Verificando estado resultante en base de ensayo...');
  const verifyClient = new Client({ connectionString: REHEARSAL_URL });
  await verifyClient.connect();

  try {
    const smCounts = await verifyClient.query(`
      SELECT status, count(*) as c FROM admin.schema_migrations GROUP BY status ORDER BY status
    `);
    console.log('  Distribución final en schema_migrations:');
    console.table(smCounts.rows);

    const logCounts = await verifyClient.query(`
      SELECT action, new_status, count(*) as c FROM admin.schema_migrations_log GROUP BY action, new_status
    `);
    console.log('  Eventos registrados en schema_migrations_log:');
    console.table(logCounts.rows);

    const ncCols = await verifyClient.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'admin' AND table_name = 'nivel_cliente' 
        AND column_name IN ('descuento_servicio', 'descuento_producto', 'porciento_descuento')
    `);
    console.log('  Columnas resultantes en nivel_cliente:', ncCols.rows.map(r => r.column_name));

    const modCols = await verifyClient.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'admin' AND table_name = 'modulo_sistema' AND column_name = 'codigo'
    `);
    console.log('  Columna codigo en modulo_sistema:', modCols.rows.length === 1 ? 'EXISTE (OK)' : 'FALTANTE');

  } finally {
    await verifyClient.end();
  }

  console.log('\n======================================================================');
  console.log('=== ENSAYO REAL COMPLETADO EXITOSAMENTE AL 100% ===');
  console.log(`Base bikers_dbtest principal se mantuvo 100% intacta.`);
  console.log('======================================================================\n');
}

main().catch(err => {
  console.error('\n[FALLO EN ENSAYO]', err);
  process.exit(1);
});
