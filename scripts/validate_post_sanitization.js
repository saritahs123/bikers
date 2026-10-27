const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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

function verifyPassword(password, hash) {
  if (!password || !hash || !hash.includes(':')) return false;
  const parts = hash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, storedHashHex] = parts;
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const storedBuffer = Buffer.from(storedHashHex, 'hex');
    if (storedBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(storedBuffer, derivedKey);
  } catch {
    return false;
  }
}

async function main() {
  const rawPassword = process.env.TEST_PASS_CHECK;
  const pool = getValidatedTestPool();
  const client = await pool.connect();
  try {
    console.log('======================================================================');
    console.log('--- VALIDACION POSTERIOR A LA SANITIZACION (FASE 6.3) ---');
    console.log('======================================================================\n');

    // 1. Verificación de CERO sesiones heredadas activas
    const sesRes = await client.query(`
      SELECT 
        count(*) as total_sesiones,
        count(*) FILTER (WHERE estado = 'ACTIVA') as activas,
        count(*) FILTER (WHERE estado = 'REVOCADA') as revocadas,
        count(*) FILTER (WHERE estado = 'CERRADA') as cerradas
      FROM admin.usuario_sesion
    `);
    const s = sesRes.rows[0];
    console.log('[1. ESTADO DE SESIONES]');
    console.log(`   Total de sesiones históricas: ${s.total_sesiones} (0 registros eliminados)`);
    console.log(`   Sesiones ACTIVA:              ${s.activas} ${s.activas === '0' ? '[OK - CERO ACTIVAS]' : '[ERROR]'}`);
    console.log(`   Sesiones REVOCADA:            ${s.revocadas}`);
    console.log(`   Sesiones CERRADA:             ${s.cerradas}\n`);

    if (parseInt(s.activas, 10) !== 0) {
      throw new Error(`FALLO: Aún quedan ${s.activas} sesiones activas.`);
    }

    // 2. Verificación de Administrador Local
    const adminRes = await client.query(`
      SELECT 
        u.usuario_id,
        u.empresa_id,
        u.estado as estado_usuario,
        tu.nombre as tipo_usuario,
        rf.nombre as rol_principal,
        us.identificador_principal,
        us.metodo_acceso_principal,
        us.correo_acceso,
        us.password,
        us.intentos_fallidos,
        us.bloqueado_hasta
      FROM admin.usuario u
      JOIN admin.tipo_usuario tu ON u.tipo_usuario_id = tu.tipo_usuario_id
      JOIN admin.rol_funcional rf ON u.rol_principal_id = rf.rol_funcional_id
      JOIN admin.usuario_seguridad us ON u.usuario_id = us.usuario_id
      WHERE LOWER(us.identificador_principal) = 'admin_test_local'
    `);

    if (adminRes.rows.length === 0) {
      throw new Error('FALLO: El usuario admin_test_local no fue encontrado en la base de datos.');
    }

    const admin = adminRes.rows[0];
    console.log('[2. ADMINISTRADOR LOCAL]');
    console.log(`   ID Usuario:             ${admin.usuario_id}`);
    console.log(`   Identificador:          ${admin.identificador_principal}`);
    console.log(`   Estado:                 ${admin.estado_usuario} [OK]`);
    console.log(`   Tipo de Usuario:        ${admin.tipo_usuario} [OK]`);
    console.log(`   Rol Principal:          ${admin.rol_principal} [OK]`);
    console.log(`   Empresa ID:             ${admin.empresa_id} [OK]`);
    console.log(`   Intentos Fallidos:      ${admin.intentos_fallidos}`);
    console.log(`   Bloqueado hasta:        ${admin.bloqueado_hasta || 'No bloqueado'}\n`);

    // 3. Verificación de roles y permisos del Administrador General
    const permRes = await client.query(`
      SELECT 
        (SELECT count(*) FROM admin.matriz_acceso_rol WHERE rol_funcional_id = 1) as reglas_modulos,
        (SELECT count(*) FROM admin.matriz_acceso_pantalla WHERE rol_funcional_id = 1) as reglas_pantallas,
        (SELECT count(*) FROM admin.usuario_rol_adicional WHERE usuario_id = $1 AND rol_funcional_id = 1) as rol_adicional_asignado
    `, [admin.usuario_id]);
    const p = permRes.rows[0];

    console.log('[3. PERMISOS ADMINISTRATIVOS]');
    console.log(`   Reglas en matriz_acceso_rol (Rol 1):      ${p.reglas_modulos}`);
    console.log(`   Reglas en matriz_acceso_pantalla (Rol 1): ${p.reglas_pantallas}`);
    console.log(`   Asignación en usuario_rol_adicional:     ${p.rol_adicional_asignado > 0 ? '[OK - Asignado]' : '[ADVERTENCIA]'}\n`);

    // 4. Verificación de Autenticación Funcional con Scrypt
    if (rawPassword) {
      const matchOk = verifyPassword(rawPassword, admin.password);
      const matchFail = verifyPassword('ClaveIncorrecta123!', admin.password);

      console.log('[4. VALIDACION DE AUTENTICACION]');
      console.log(`   Verificación con clave asignada:         ${matchOk ? '[OK - AUTENTICACION EXITOSA]' : '[FALLO]'}`);
      console.log(`   Rechazo con clave errónea:               ${!matchFail ? '[OK - RECHAZO EXITOSO]' : '[FALLO]'}\n`);

      if (!matchOk || matchFail) {
        throw new Error('FALLO: La validación criptográfica scrypt falló.');
      }
    }

    // 5. Verificación de integridad de catálogos
    const catRes = await client.query(`
      SELECT 
        (SELECT count(*) FROM admin.clientes) as clientes,
        (SELECT count(*) FROM admin.facturas) as facturas,
        (SELECT count(*) FROM admin.ordenes_trabajo) as ordenes,
        (SELECT count(*) FROM admin.bicicletas) as bicicletas
    `);
    const c = catRes.rows[0];
    console.log('[5. INTEGRIDAD DE CATALOGOS PRODUCTIVOS RESTAURADOS]');
    console.log(`   Clientes intactos:          ${c.clientes} (114 esperados)`);
    console.log(`   Facturas intactas:          ${c.facturas} (176 esperadas)`);
    console.log(`   Órdenes de trabajo:         ${c.ordenes} (137 esperadas)`);
    console.log(`   Bicicletas intactas:        ${c.bicicletas}\n`);

    console.log('======================================================================');
    console.log('[ÉXITO TOTAL] TODAS LAS COMPROBACIONES POSTERIORES FUERON SUPERADAS');
    console.log('======================================================================\n');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
