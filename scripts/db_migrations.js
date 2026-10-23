/**
 * CLI DE CONTROL DE MIGRACIONES DE BASE DE DATOS
 * Archivo: scripts/db_migrations.js
 * Proyecto: Bikers' Fort Core — Ride Lab
 *
 * Comandos soportados:
 * - status:  Muestra el estado de todas las migraciones (aplicadas, pendientes, checksums).
 * - plan:    Presenta el plan de ejecución y análisis de impacto sin modificar nada.
 * - verify:  Verifica la integridad de las migraciones aplicadas y detecta alteraciones (tamper).
 * - migrate: Aplica de forma segura y transaccional las migraciones pendientes (Solo TEST).
 * - baseline: Registra migraciones reconciliadas como BASELINE sin reejecutar su SQL.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const {
  getMigrationFiles,
  ensureMigrationTable,
  acquireAdvisoryLock,
  releaseAdvisoryLock,
  getMigrationStatus,
  executeMigration,
  registerBaseline,
  reconcileMigration
} = require('../src/lib/migrations/migrationCore');

// 1. Parseo de argumentos de línea de comandos
const args = process.argv.slice(2);
const command = args[0] || 'status';
const envArg = args.find(a => a.startsWith('--env='))?.split('=')[1] || 'test';
const targetArg = args.find(a => a.startsWith('--target='))?.split('=')[1];
const migrationArg = args.find(a => a.startsWith('--migration='))?.split('=')[1];

// 2. Carga segura de variables de entorno según el modo
function loadEnvironment(env) {
  if (env === 'test') {
    const envPath = path.resolve(process.cwd(), '.env.test.local');
    if (!fs.existsSync(envPath)) {
      console.error('[BLOQUEO] No se encontró el archivo .env.test.local');
      process.exit(1);
    }
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Za-z0-9_]+)=(.*)$/);
      if (match) {
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[match[1]] = val;
      }
    }
    process.env.APP_ENV = 'test';
  }
}

// 3. Validación estricta de seguridad de conexión
function validateConnectionSecurity(connectionString, env) {
  if (!connectionString) {
    throw new Error('DATABASE_URL no está configurada.');
  }

  let urlObj;
  try {
    urlObj = new URL(connectionString);
  } catch {
    throw new Error('Formato de DATABASE_URL inválido.');
  }

  const host = (urlObj.hostname || '').toLowerCase();
  const port = parseInt(urlObj.port || '5432', 10);
  const db = (urlObj.pathname || '').replace(/^\//, '');

  if (env === 'test') {
    const allowed = ['127.0.0.1', 'localhost', '::1'];
    if (!allowed.includes(host) || port !== 5432 || db !== 'bikers_dbtest' || host.includes('amazonaws.com')) {
      throw new Error(
        `[BLOQUEO DE SEGURIDAD] Destino no autorizado para TEST (${host}:${port}/${db}). Solo se permite 127.0.0.1:5432/bikers_dbtest.`
      );
    }
  }

  return { host, port, db };
}

async function main() {
  console.log('\n======================================================================');
  console.log(`--- CONTROL DE MIGRACIONES DE BASE DE DATOS (MODO: ${envArg.toUpperCase()}) ---`);
  console.log('======================================================================\n');

  // Proteccion absoluta: Bloquear 'migrate' en produccion
  if (envArg === 'production' && (command === 'migrate' || command === 'baseline')) {
    console.error('======================================================================');
    console.error('[BLOQUEO CRÍTICO] La ejecución automática de migraciones en PRODUCCIÓN');
    console.error('está estrictamente deshabilitada desde este CLI.');
    console.error('Para producción, utilice únicamente: npm run db:prod:plan');
    console.error('y ejecute los scripts previa autorización formal mediante túnel seguro.');
    console.error('======================================================================\n');
    process.exit(1);
  }

  loadEnvironment(envArg);
  const connectionString = process.env.DATABASE_URL;

  // En modo PRODUCCION con comando PLAN, si no hay conexión a RDS, generar plan estático de despliegue
  if (envArg === 'production' && command === 'plan' && !connectionString) {
    console.log('[MODO ESTATICO DE PRODUCCION] Generando informe de despliegue sin conexion activa a AWS RDS.\n');
    const allFiles = getMigrationFiles();
    console.log(`[INVENTARIO DE MIGRACIONES EN REPOSITORIO (TOTAL: ${allFiles.length})]`);
    console.table(allFiles.map(f => ({
      ID: f.sequenceNumber,
      Archivo: f.filename,
      Checksum: f.checksum.slice(0, 16) + '...',
      Descripcion: f.description
    })));

    console.log('\n[PLAN DE DESPLIEGUE CONTROLADO PARA PRODUCCION]');
    console.log('1. Validaciones Previas Obligatorias:');
    console.log('   - Generar un pg_dump de la base productiva en AWS RDS antes del despliegue.');
    console.log('   - Abrir un túnel SSH seguro autenticado mediante Bastion.');
    console.log('   - Verificar que no existan transacciones lentas en curso (pg_stat_activity).');
    console.log('2. Protocolo de Ejecución:');
    console.log('   - Ejecutar cada script pendiente dentro de un bloque BEGIN ... COMMIT.');
    console.log('   - Validar el resultado de salida antes de confirmar la transacción.');
    console.log('   - Registrar la migración en admin.schema_migrations de producción.');
    console.log('3. Plan de Contingencia / Rollback:');
    console.log('   - En caso de error, el bloque ROLLBACK cancela automáticamente el script.');
    console.log('   - Si la migración ya fue confirmada y presenta incidentes, aplicar el script inverso o restaurar el dump.\n');
    return;
  }

  const connInfo = validateConnectionSecurity(connectionString, envArg);
  console.log(`[CONEXION OBJETIVO] ${connInfo.host}:${connInfo.port}/${connInfo.db} (Ambiente: ${envArg})`);

  const client = new Client({
    connectionString,
    ssl: envArg === 'production' ? { rejectUnauthorized: false } : false
  });

  await client.connect();

  try {
    // Validar conexión real
    const idRes = await client.query('SELECT current_database() as db, current_user as usr, inet_server_addr() as addr');
    const realDb = idRes.rows[0].db;
    const realUser = idRes.rows[0].usr;

    if (envArg === 'test' && (realDb !== 'bikers_dbtest' || realUser !== 'bikers_test')) {
      throw new Error(`[BLOQUEO] Identidad de base de datos no coincide (${realDb} / ${realUser}).`);
    }

    // Asegurar tabla admin.schema_migrations si estamos en test o si el comando lo requiere
    if (envArg === 'test') {
      await ensureMigrationTable(client);
    }

    // COMANDO 1: STATUS
    if (command === 'status') {
      const status = await getMigrationStatus(client);
      console.log(`\n[RESUMEN DE MIGRACIONES]`);
      console.log(`   Total en migrations/:        ${status.totalOnDisk}`);
      console.log(`   Aplicadas / Baseline:        ${status.totalApplied}`);
      console.log(`   Pendientes:                  ${status.totalPending}`);
      console.log(`   Alteradas (Tampered):        ${status.totalTampered}\n`);

      const tableData = status.all.map(s => ({
        ID: s.sequenceNumber,
        Archivo: s.filename,
        Estado: s.state === 'PENDING' ? '⏳ PENDIENTE' : (s.checksumMatches ? '✅ ' + s.state : '❌ ALTERADO'),
        Ejecutado: s.executedAt ? new Date(s.executedAt).toISOString().replace('T', ' ').slice(0, 19) : '-',
        Ambiente: s.environment || '-'
      }));

      console.table(tableData);

      if (status.totalTampered > 0) {
        console.warn('\n[ALERTA DE SEGURIDAD] Se detectaron archivos de migración cuyo checksum actual no coincide');
        console.warn('con el registrado en la base de datos al momento de aplicarse:');
        console.table(status.tampered.map(t => ({
          Archivo: t.filename,
          Checksum_En_BD: t.appliedChecksum.slice(0, 16) + '...',
          Checksum_En_Disco: t.diskChecksum.slice(0, 16) + '...'
        })));
      }
    }

    // COMANDO 2: PLAN
    else if (command === 'plan') {
      const status = await getMigrationStatus(client);
      console.log(`[ANALISIS DEL PLAN DE EJECUCION]`);
      console.log(`   Migraciones registradas:   ${status.totalApplied}`);
      console.log(`   Migraciones a ejecutar:    ${status.totalPending}\n`);

      if (status.totalPending === 0) {
        console.log('✅ El esquema se encuentra 100% al día. No hay migraciones pendientes por aplicar.\n');
      } else {
        console.log('--- MIGRACIONES PENDIENTES A APLICAR ---');
        console.table(status.pending.map((p, idx) => ({
          Orden: idx + 1,
          Archivo: p.filename,
          Descripcion: p.description,
          Checksum: p.diskChecksum.slice(0, 16) + '...'
        })));

        console.log('\n[EVALUACION DE RIESGOS Y BLOQUEOS]');
        for (const p of status.pending) {
          const files = getMigrationFiles();
          const targetFile = files.find(f => f.filename === p.filename);
          const hasAlterTable = targetFile?.content.includes('ALTER TABLE');
          const hasDrop = targetFile?.content.includes('DROP');
          const hasDdl = targetFile?.content.includes('CREATE') || hasAlterTable;

          console.log(`   - ${p.filename}:`);
          console.log(`     * Tipo de cambio: ${hasDdl ? 'DDL Estructural' : 'DML Datos'}`);
          console.log(`     * Riesgo de bloqueo: ${hasAlterTable ? 'Medio (ACCESS EXCLUSIVE LOCK temporal)' : 'Bajo'}`);
          console.log(`     * Modificaciones destructivas (DROP): ${hasDrop ? 'Detectadas (Revisar)' : 'Ninguna'}`);
        }
        console.log('\nPara aplicar en TEST local ejecute: npm run db:test:migrate\n');
      }
    }

    // COMANDO 3: VERIFY
    else if (command === 'verify') {
      const status = await getMigrationStatus(client);
      console.log('[VERIFICANDO INTEGRIDAD Y CONSISTENCIA]');

      let errors = 0;
      if (status.totalTampered > 0) {
        console.error(`❌ FALLO: ${status.totalTampered} archivos aplicados han sido alterados en disco.`);
        errors++;
      } else {
        console.log('✅ Inmutabilidad confirmada: Todos los checksums de archivos aplicados coinciden.');
      }

      // Validar orden de secuencias
      let lastSeq = -1;
      let orderOk = true;
      for (const m of status.applied) {
        if (m.sequenceNumber < lastSeq) {
          orderOk = false;
          break;
        }
        lastSeq = m.sequenceNumber;
      }

      if (orderOk) {
        console.log('✅ Orden cronológico y secuencial de migraciones verificado.');
      } else {
        console.error('❌ FALLO: Se detectó una inconsistencia en el orden de las migraciones aplicadas.');
        errors++;
      }

      if (errors === 0) {
        console.log('\n[ÉXITO] Verificación de integridad completada sin inconsistencias.\n');
      } else {
        process.exit(1);
      }
    }

    // COMANDO 4: MIGRATE (Solo TEST local)
    else if (command === 'migrate') {
      console.log('[INICIANDO EJECUCION DE MIGRACIONES EN BASE LOCAL]');

      // Adquirir bloqueo exclusivo de migración
      const locked = await acquireAdvisoryLock(client);
      if (!locked) {
        console.error('[BLOQUEO] Otro proceso de migración se encuentra en ejecución activa.');
        process.exit(1);
      }

      try {
        const status = await getMigrationStatus(client);

        if (status.totalPending === 0) {
          console.log('✅ No hay migraciones pendientes. Esquema al día.\n');
          return;
        }

        console.log(`Se aplicarán ${status.totalPending} migraciones pendientes en bikers_dbtest:\n`);

        const allFiles = getMigrationFiles();
        for (const pendingItem of status.pending) {
          const fileObj = allFiles.find(f => f.filename === pendingItem.filename);
          if (!fileObj) continue;

          await executeMigration(client, fileObj, 'test', realUser);
        }

        console.log('\n======================================================================');
        console.log('[ÉXITO] Todas las migraciones pendientes fueron aplicadas correctamente.');
        console.log('======================================================================\n');

      } finally {
        await releaseAdvisoryLock(client);
      }
    }

    // COMANDO 5: BASELINE (Reconciliación de bases restauradas)
    else if (command === 'baseline') {
      const upToNumber = targetArg ? parseInt(targetArg, 10) : 43; // Por defecto hasta la 043 (dejando 044 pendiente)
      console.log(`[ESTABLECIENDO BASELINE HASTA MIGRACION ${upToNumber}]`);

      const allFiles = getMigrationFiles();
      const filesToBaseline = allFiles.filter(f => f.sequenceNumber <= upToNumber);

      console.log(`Registrando ${filesToBaseline.length} migraciones en admin.schema_migrations con estado 'BASELINE'...`);

      for (const f of filesToBaseline) {
        await registerBaseline(client, f, envArg, realUser);
      }

      console.log(`\n[ÉXITO] Baseline registrado para ${filesToBaseline.length} migraciones.`);
      console.log(`Las migraciones posteriores (> ${upToNumber}) permanecerán como PENDIENTES.\n`);
    }

    // COMANDO 6: RECONCILE (Reconciliación controlada de migración cubierta por estructura existente)
    else if (command === 'reconcile') {
      const targetMig = migrationArg || (targetArg === '44' || targetArg === '044' ? '044_factura_anulacion_sequence.sql' : null);
      if (!targetMig) {
        console.error('[ERROR] Debe especificar --migration=<archivo.sql> o --target=44 para reconciliar.');
        process.exit(1);
      }

      console.log(`[INICIANDO RECONCILIACION CONTROLADA: ${targetMig}]`);

      // Adquirir bloqueo exclusivo de migración
      const locked = await acquireAdvisoryLock(client);
      if (!locked) {
        console.error('[BLOQUEO] Otro proceso de migración se encuentra en ejecución activa.');
        process.exit(1);
      }

      try {
        // Si es la migración 044, validar estado físico de la columna IDENTITY antes de proceder
        let idCheckInfo = null;
        if (targetMig.includes('044')) {
          const colRes = await client.query(`
            SELECT column_name, is_identity, identity_generation, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'admin' AND table_name = 'factura_anulacion' AND column_name = 'factura_anulacion_id'
          `);
          const seqRes = await client.query(`
            SELECT pg_get_serial_sequence('admin.factura_anulacion', 'factura_anulacion_id') as serial_seq
          `);

          if (colRes.rows[0]?.is_identity !== 'YES' || !seqRes.rows[0]?.serial_seq) {
            throw new Error('[BLOQUEO] No se puede reconciliar 044: la columna factura_anulacion_id no es IDENTITY o no tiene secuencia asociada.');
          }

          idCheckInfo = {
            column: colRes.rows[0],
            serialSequence: seqRes.rows[0].serial_seq
          };
          console.log(`✅ Verificación física de columna IDENTITY superada: ${idCheckInfo.serialSequence}`);
        }

        await reconcileMigration(client, targetMig, {
          environment: envArg,
          executedBy: realUser,
          reason: targetMig.includes('044')
            ? 'El objetivo funcional de la migración 044 (creación y vinculación de secuencia autoincremental para factura_anulacion_id) ya está cubierto nativamente por la migración 033 mediante la especificación SQL estándar INT4 GENERATED BY DEFAULT AS IDENTITY. La ejecución directa de 044 produjo "cannot change ownership of identity sequence" porque PostgreSQL prohíbe reasignar manualmente la propiedad de secuencias IDENTITY internas.'
            : 'Reconciliación controlada autorizada',
          identityVerification: idCheckInfo
        });

        console.log(`\n======================================================================`);
        console.log(`[ÉXITO] Migración ${targetMig} reconciliada como BASELINE.`);
        console.log(`Historial previo FAILED preservado en admin.schema_migrations y admin.schema_migrations_log.`);
        console.log(`======================================================================\n`);

      } finally {
        await releaseAdvisoryLock(client);
      }
    }

    else {
      console.error(`Comando desconocido: "${command}". Comandos válidos: status, plan, verify, migrate, baseline, reconcile.`);
      process.exit(1);
    }

  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('\n[ERROR INESPERADO]', err.message);
  process.exit(1);
});
