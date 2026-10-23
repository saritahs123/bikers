const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function loadTestEnv() {
  const envPath = path.resolve(process.cwd(), '.env.test.local');
  if (fs.existsSync(envPath)) {
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
        if (!process.env[match[1]]) {
          process.env[match[1]] = val;
        }
      }
    }
  }
}

function getValidatedTestPool() {
  loadTestEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[BLOQUEO CRÍTICO] La variable DATABASE_URL no está configurada.');
    process.exit(1);
  }
  let urlObj;
  try {
    urlObj = new URL(connectionString);
  } catch {
    console.error('[BLOQUEO CRÍTICO] Formato inválido en DATABASE_URL.');
    process.exit(1);
  }
  const hostname = (urlObj.hostname || '').toLowerCase();
  const port = parseInt(urlObj.port || '5432', 10);
  const dbName = (urlObj.pathname || '').replace(/^\//, '');

  const allowedHosts = ['127.0.0.1', 'localhost', '::1'];
  if (!allowedHosts.includes(hostname) || hostname.includes('amazonaws.com') || hostname.includes('bikerrd.com')) {
    console.error(`[BLOQUEO DE SEGURIDAD] Host no permitido para pruebas: "${hostname}".`);
    process.exit(1);
  }
  if (port !== 5432) {
    console.error(`[BLOQUEO DE SEGURIDAD] Puerto no autorizado para pruebas: ${port}. Solo se permite 5432.`);
    process.exit(1);
  }
  if (dbName !== 'bikers_dbtest') {
    console.error(`[BLOQUEO DE SEGURIDAD] Base de datos incorrecta: "${dbName}". Solo se permite "bikers_dbtest".`);
    process.exit(1);
  }
  return new Pool({ connectionString, ssl: false });
}

async function runSanitization() {
  const pool = getValidatedTestPool();
  const client = await pool.connect();
  try {
    console.log('======================================================================');
    console.log('--- EJECUCION CONTROLADA DE SANITIZACION (FASE 6.3) ---');
    console.log('======================================================================\n');

    // 1. Verificación previa de conexión efectiva
    const connRes = await client.query(`
      SELECT 
        current_database() as db,
        current_user as usr,
        inet_server_addr() as addr,
        inet_server_port() as port,
        version() as ver
    `);
    const conn = connRes.rows[0];
    console.log(`[CONEXION EFECTIVA]`);
    console.log(`   Base de Datos: ${conn.db}`);
    console.log(`   Usuario:       ${conn.usr}`);
    console.log(`   Host:          ${conn.addr || '127.0.0.1 (local)'}`);
    console.log(`   Puerto:        ${conn.port || 5432}`);
    console.log(`   Versión:       ${conn.ver.split(',')[0]}\n`);

    if (conn.db !== 'bikers_dbtest' || conn.usr !== 'bikers_test') {
      throw new Error(`ABORTADO: Conexión inválida para sanitización (${conn.db} / ${conn.usr})`);
    }

    // 2. Pre-conteo de validación
    const preCountRes = await client.query(`
      SELECT 
        (SELECT count(*) FROM admin.usuario_sesion WHERE estado = 'ACTIVA') as activas,
        (SELECT count(*) FROM admin.usuario_sesion) as total_sesiones,
        (SELECT count(*) FROM admin.clientes) as clientes,
        (SELECT count(*) FROM admin.facturas) as facturas,
        (SELECT count(*) FROM admin.ordenes_trabajo) as ordenes
    `);
    const pre = preCountRes.rows[0];
    console.log('[CONTEO PRE-MODIFICACION]');
    console.log(`   Sesiones activas:       ${pre.activas}`);
    console.log(`   Total sesiones:         ${pre.total_sesiones}`);
    console.log(`   Clientes (intactos):    ${pre.clientes}`);
    console.log(`   Facturas (intactas):    ${pre.facturas}`);
    console.log(`   Órdenes de trabajo:     ${pre.ordenes}\n`);

    if (parseInt(pre.activas, 10) !== 35) {
      throw new Error(`ABORTADO: Se esperaban exactamente 35 sesiones activas, se encontraron: ${pre.activas}`);
    }

    // 3. INICIO DE TRANSACCION ESTRICTA
    console.log('[INICIANDO TRANSACCION: BEGIN]');
    await client.query('BEGIN');

    // Validación DO block
    await client.query(`
      DO $$
      BEGIN
          IF current_database() <> 'bikers_dbtest' THEN
              RAISE EXCEPTION 'Base de datos no autorizada';
          END IF;
          IF current_user <> 'bikers_test' THEN
              RAISE EXCEPTION 'Usuario no autorizado';
          END IF;
      END $$;
    `);

    // Actualización de sesiones
    const updateRes = await client.query(`
      UPDATE admin.usuario_sesion
      SET estado = 'REVOCADA',
          tipo_cierre = 'REVOCACION',
          motivo_cierre = 'Invalidada por protocolo de aislamiento de ambiente local de pruebas',
          fecha_expiracion = NOW(),
          fecha_cierre = NOW(),
          fecha_revocacion = NOW(),
          dispositivo_navegador = '[REVOCADO_PROTOCOLO_TEST_LOCAL]'
      WHERE estado = 'ACTIVA'
    `);
    console.log(`[UPDATE] Registros modificados en admin.usuario_sesion: ${updateRes.rowCount}`);

    if (updateRes.rowCount !== 35) {
      throw new Error(`ABORTADO: updateRes.rowCount fue ${updateRes.rowCount}, se esperaban 35.`);
    }

    // 4. Verificación post-update dentro de la transacción
    const postInTxRes = await client.query(`
      SELECT 
        (SELECT count(*) FROM admin.usuario_sesion WHERE estado = 'ACTIVA') as activas_restantes,
        (SELECT count(*) FROM admin.usuario_sesion WHERE estado = 'REVOCADA') as revocadas_total,
        (SELECT count(*) FROM admin.usuario_sesion) as total_sesiones,
        (SELECT count(*) FROM admin.clientes) as clientes,
        (SELECT count(*) FROM admin.facturas) as facturas,
        (SELECT count(*) FROM admin.ordenes_trabajo) as ordenes
    `);
    const post = postInTxRes.rows[0];

    console.log('\n[VALIDACION DENTRO DE LA TRANSACCION]');
    console.log(`   Sesiones activas restantes: ${post.activas_restantes}`);
    console.log(`   Sesiones revocadas total:   ${post.revocadas_total}`);
    console.log(`   Total histórico sesiones:   ${post.total_sesiones} (Preservado)`);
    console.log(`   Total clientes:             ${post.clientes} (Intacto)`);
    console.log(`   Total facturas:             ${post.facturas} (Intacto)`);
    console.log(`   Total órdenes de trabajo:   ${post.ordenes} (Intacto)`);

    if (parseInt(post.activas_restantes, 10) !== 0) {
      throw new Error('ABORTADO: Todavía quedan sesiones activas dentro de la transacción.');
    }
    if (parseInt(post.total_sesiones, 10) !== 369) {
      throw new Error('ABORTADO: El conteo total de sesiones cambió.');
    }

    // 5. EJECUTAR COMMIT
    console.log('\n[TODAS LAS VALIDACIONES SUPERADAS] -> EJECUTANDO COMMIT');
    await client.query('COMMIT');
    console.log('[ÉXITO] Transacción persistida correctamente en bikers_dbtest.\n');

  } catch (err) {
    console.error('\n[ERROR EN SANITIZACION] -> EJECUTANDO ROLLBACK DE EMERGENCIA:', err.message);
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {}
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runSanitization().catch(console.error);
