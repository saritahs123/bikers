/**
 * VALIDACIÓN ESTRICTA DE BASE DE DATOS LOCAL DE PRUEBAS (POSTGRESQL 18)
 * Archivo: scripts/validate_local_db.js
 * Proyecto: Ride Lab — Bikers' Fort Core
 *
 * Propósito:
 * Garantizar que el entorno de pruebas apunte única y exclusivamente a la instancia
 * local PostgreSQL 18 (127.0.0.1:5432 / bikers_dbtest) y que el esquema 'admin' esté
 * íntegro con las empresas de prueba, antes de permitir que la aplicación se inicie.
 *
 * Bloquea de inmediato si detecta AWS RDS, puertos productivos (6432) o hosts no locales.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Función auxiliar para cargar variables desde .env.test.local si no están en process.env
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

async function validateLocalDatabase() {
  loadTestEnv();

  console.log('\n======================================================================');
  console.log('--- VALIDACIÓN DE SEGURIDAD: AMBIENTE LOCAL DE PRUEBAS ---');
  console.log('======================================================================\n');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[BLOQUEO CRÍTICO] La variable DATABASE_URL no está configurada.');
    process.exit(1);
  }

  // 1. Análisis estricto de URL sin exponer credenciales
  let urlObj;
  try {
    urlObj = new URL(connectionString);
  } catch (err) {
    console.error('[BLOQUEO CRÍTICO] Formato inválido en DATABASE_URL.');
    process.exit(1);
  }

  const hostname = (urlObj.hostname || '').toLowerCase();
  const port = parseInt(urlObj.port || '5432', 10);
  const dbName = (urlObj.pathname || '').replace(/^\//, '');
  const username = decodeURIComponent(urlObj.username || '');

  // 2. Comprobaciones de seguridad de destino
  const allowedHosts = ['127.0.0.1', 'localhost', '::1'];
  if (!allowedHosts.includes(hostname)) {
    console.error(`[BLOQUEO DE SEGURIDAD] Host no permitido para pruebas: "${hostname}".`);
    console.error('El ambiente de pruebas solo puede ejecutarse en 127.0.0.1 o localhost.');
    process.exit(1);
  }

  if (hostname.includes('amazonaws.com') || hostname.includes('bikerrd.com')) {
    console.error('[BLOQUEO DE SEGURIDAD] ¡Peligro! Detectada conexión hacia AWS RDS de producción.');
    process.exit(1);
  }

  if (port === 6432) {
    console.error('[BLOQUEO DE SEGURIDAD] El puerto 6432 corresponde al pool productivo PgBouncer.');
    console.error('El PostgreSQL local debe usar el puerto estándar 5432.');
    process.exit(1);
  }

  if (port === 59083) {
    console.error('[BLOQUEO DE SEGURIDAD] El puerto 59083 corresponde al túnel SSH hacia la base de producción.');
    console.error('El ambiente de pruebas no puede conectarse a través de túneles hacia producción.');
    process.exit(1);
  }

  if (port !== 5432) {
    console.error(`[BLOQUEO DE SEGURIDAD] Puerto no autorizado para pruebas: ${port}. Solo se permite el puerto 5432.`);
    process.exit(1);
  }

  if (dbName !== 'bikers_dbtest') {
    console.error(`[BLOQUEO DE SEGURIDAD] Base de datos incorrecta: "${dbName}".`);
    console.error('El ambiente de pruebas DEBE apuntar exclusivamente a "bikers_dbtest".');
    process.exit(1);
  }

  if (username !== 'bikers_test') {
    console.warn(`[ADVERTENCIA] El usuario de conexión es "${username}". Se esperaba "bikers_test".`);
  }

  console.log(`[OK] Verificación de Host: ${hostname}:${port} (Local seguro)`);
  console.log(`[OK] Verificación de Base de Datos: ${dbName}`);
  console.log(`[OK] Verificación de Usuario: ${username}`);

  // 3. Conexión efectiva a PostgreSQL local
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5000,
    ssl: false
  });

  try {
    await client.connect();
    console.log('[OK] Conexión establecida con el motor PostgreSQL local.');

    // 4. Validar versión del motor
    const verRes = await client.query('SELECT version()');
    const versionStr = verRes.rows[0]?.version || '';
    console.log(`[INFO] Versión del Servidor: ${versionStr.split(',')[0]}`);

    if (!versionStr.includes('PostgreSQL 18')) {
      console.warn('[ADVERTENCIA] La instancia local detectada no reporta PostgreSQL 18.');
    } else {
      console.log('[OK] Confirmado motor PostgreSQL 18.');
    }

    // 5. Validar que la base activa sea bikers_dbtest y usuario bikers_test
    const identityRes = await client.query('SELECT current_database() AS db, current_user AS usr');
    const currentDb = identityRes.rows[0]?.db;
    const currentUser = identityRes.rows[0]?.usr;

    if (currentDb !== 'bikers_dbtest') {
      console.error(`[BLOQUEO CRÍTICO] current_database() retornó "${currentDb}" en lugar de "bikers_dbtest".`);
      await client.end();
      process.exit(1);
    }
    console.log(`[OK] current_database(): ${currentDb}`);
    console.log(`[OK] current_user: ${currentUser}`);

    // 6. Validar existencia del esquema 'admin'
    const schRes = await client.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'admin'"
    );
    if (!schRes.rows || schRes.rows.length === 0) {
      console.error('[BLOQUEO CRÍTICO] El esquema "admin" no existe en la base bikers_dbtest.');
      await client.end();
      process.exit(1);
    }
    console.log('[OK] Esquema "admin" confirmado.');

    // 7. Validar tablas en admin
    const tablesRes = await client.query(
      "SELECT count(*) AS total FROM information_schema.tables WHERE table_schema = 'admin'"
    );
    const tableCount = parseInt(tablesRes.rows[0]?.total || '0', 10);
    console.log(`[OK] Tablas restauradas en esquema "admin": ${tableCount} tablas.`);

    if (tableCount < 30) {
      console.warn(`[ADVERTENCIA] Se detectaron solo ${tableCount} tablas. Verifique si el restore se completó.`);
    }

    // 8. Validar empresas de prueba
    const empRes = await client.query("SELECT * FROM admin.empresa ORDER BY empresa_id");
    console.log('\n[INFO] Empresas configuradas en la base local:');
    for (const emp of empRes.rows) {
      const name = emp.nombre_empresa || emp.nombre_comercial || emp.nombre || emp.razon_social || `Empresa #${emp.empresa_id}`;
      const rnc = emp.rnc || emp.identificacion_fiscal || 'N/A';
      console.log(`   - ID ${emp.empresa_id}: ${name} (RNC: ${rnc})`);
    }

    const hasTestName = empRes.rows.some(r => {
      const str = JSON.stringify(r).toUpperCase();
      return str.includes('TEST');
    });
    if (hasTestName) {
      console.log('[OK] Confirmadas empresas con identificador TEST.');
    }

    // 9. Comprobar secuencias
    const seqRes = await client.query(
      "SELECT count(*) AS total FROM information_schema.sequences WHERE sequence_schema = 'admin'"
    );
    console.log(`[OK] Secuencias disponibles en "admin": ${seqRes.rows[0]?.total || 0}`);

    await client.end();

    console.log('\n======================================================================');
    console.log('[ÉXITO] TODAS LAS VERIFICACIONES DEL AMBIENTE LOCAL DE PRUEBAS PASARON');
    console.log('El entorno está listo y aislado para ejecutar Next.js en modo pruebas.');
    console.log('======================================================================\n');
    return true;
  } catch (connErr) {
    console.error('\n[ERROR DE CONEXIÓN A POSTGRESQL LOCAL]:', connErr.message);
    console.error('Verifique que el servicio postgresql-x64-18 esté iniciado en Windows y que');
    console.error('las credenciales en .env.test.local sean correctas.\n');
    try { await client.end(); } catch {}
    process.exit(1);
  }
}

if (require.main === module) {
  validateLocalDatabase();
}

module.exports = { validateLocalDatabase };
