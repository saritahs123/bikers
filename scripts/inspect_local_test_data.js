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

function getValidatedTestClient() {
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
  return new Client({ connectionString, ssl: false });
}

async function inspectTestData() {
  const client = getValidatedTestClient();
  await client.connect();

  console.log('\n======================================================');
  console.log('--- REPORTE DE INSPECCIÓN: DATOS EN BIKERS_DBTEST ---');
  console.log('======================================================\n');

  // 1. Sesiones
  const sesRes = await client.query(`
    SELECT 
      count(*) as total_sesiones,
      count(*) FILTER (WHERE estado = 'ACTIVA') as activas,
      count(*) FILTER (WHERE estado = 'REVOCADA' OR estado = 'EXPIRADA') as inactivas
    FROM admin.usuario_sesion
  `);
  console.log('1. Sesiones en admin.usuario_sesion:', sesRes.rows[0]);

  // 2. Usuarios
  const usrRes = await client.query(`
    SELECT count(*) as total_usuarios FROM admin.usuario
  `);
  console.log('2. Usuarios en admin.usuario:', usrRes.rows[0].total_usuarios);

  // 3. Clientes
  const cliRes = await client.query(`
    SELECT count(*) as total_clientes FROM admin.clientes
  `);
  console.log('3. Clientes en admin.clientes:', cliRes.rows[0].total_clientes);

  // 4. Triggers
  const trgRes = await client.query(`
    SELECT trigger_name, event_manipulation, event_object_table
    FROM information_schema.triggers
    WHERE trigger_schema = 'admin'
  `);
  console.log('4. Triggers en esquema admin:', trgRes.rows.length === 0 ? 'Ninguno detectado' : trgRes.rows);

  // 5. Procedimientos o funciones
  const fnRes = await client.query(`
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'admin'
  `);
  console.log('5. Funciones en esquema admin:', fnRes.rows.map(r => r.routine_name));

  await client.end();
  console.log('\n======================================================\n');
}

inspectTestData().catch(console.error);
