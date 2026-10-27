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

function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

async function createAdmin() {
  const rawPassword = process.env.LOCAL_ADMIN_PASS;
  if (!rawPassword) {
    console.error('[ERROR] LOCAL_ADMIN_PASS no está definida en el entorno.');
    process.exit(1);
  }

  const pool = getValidatedTestPool();
  const client = await pool.connect();
  try {
    console.log('======================================================================');
    console.log('--- PROVISIONAMIENTO DE ADMINISTRADOR LOCAL EXCLUSIVO (FASE 6.3) ---');
    console.log('======================================================================\n');

    // 1. Verificación de seguridad de conexión
    const connRes = await client.query(`
      SELECT current_database() as db, current_user as usr, inet_server_addr() as addr
    `);
    const conn = connRes.rows[0];
    if (conn.db !== 'bikers_dbtest' || conn.usr !== 'bikers_test') {
      throw new Error(`ABORTADO: Conexión inválida (${conn.db} / ${conn.usr})`);
    }

    console.log('[OK] Conexión validada a 127.0.0.1:5432 / bikers_dbtest');

    // 2. Comprobar si ya existe admin_test_local
    const existing = await client.query(`
      SELECT u.usuario_id, us.identificador_principal, u.estado 
      FROM admin.usuario u
      JOIN admin.usuario_seguridad us ON u.usuario_id = us.usuario_id
      WHERE LOWER(us.identificador_principal) = 'admin_test_local'
    `);

    const passwordHash = hashPassword(rawPassword);

    await client.query('BEGIN');

    let userId;
    if (existing.rows.length > 0) {
      userId = existing.rows[0].usuario_id;
      console.log(`[INFO] Usuario admin_test_local preexistente (ID: ${userId}). Actualizando credenciales y roles...`);

      // Actualizar seguridad
      await client.query(`
        UPDATE admin.usuario_seguridad
        SET password = $1,
            intentos_fallidos = 0,
            bloqueado_hasta = NULL,
            requiere_cambio_clave = false,
            forzar_cambio_clave = false,
            fecha_ultimo_cambio_password = NOW()
        WHERE usuario_id = $2
      `, [passwordHash, userId]);

      // Asegurar estado activo y rol principal Administrador General
      await client.query(`
        UPDATE admin.usuario
        SET estado = 'ACTIVO',
            tipo_usuario_id = 1,
            rol_principal_id = 1,
            empresa_id = 1,
            duracion_sesion_minutos = 480
        WHERE usuario_id = $1
      `, [userId]);

    } else {
      // Calcular IDs atómicamente
      const maxUserRes = await client.query(`SELECT COALESCE(MAX(usuario_id), 0) + 1 AS next_id FROM admin.usuario`);
      userId = parseInt(maxUserRes.rows[0].next_id, 10);

      const maxSegRes = await client.query(`SELECT COALESCE(MAX(usuario_seguridad_id), 0) + 1 AS next_id FROM admin.usuario_seguridad`);
      const nextSegId = parseInt(maxSegRes.rows[0].next_id, 10);

      // 1. Insertar admin.usuario
      await client.query(`
        INSERT INTO admin.usuario
          (usuario_id, empresa_id, tipo_usuario_id, rol_principal_id, estado, estado_activacion, duracion_sesion_minutos, fecha_creacion, fecha_actualizacion)
        VALUES
          ($1, 1, 1, 1, 'ACTIVO', 'Activo', 480, NOW(), NOW())
      `, [userId]);

      // 2. Insertar admin.usuario_identidad
      await client.query(`
        INSERT INTO admin.usuario_identidad
          (usuario_id, nombre, apellido, correo_electronico, telefono, numero_documento, fecha_creacion, fecha_actualizacion)
        VALUES
          ($1, 'Administrador', 'Local Pruebas', 'admin.local@ridelab.test', '8095550000', '00000000001', NOW(), NOW())
      `, [userId]);

      // 3. Insertar admin.usuario_seguridad
      await client.query(`
        INSERT INTO admin.usuario_seguridad
          (usuario_seguridad_id, usuario_id, password, metodo_acceso_principal, identificador_principal, correo_acceso,
           mfa_activo, restriccion_ip, restriccion_horaria, requiere_cambio_clave, forzar_cambio_clave,
           fecha_credenciales_generada, intentos_fallidos, intentos_fallidos_permitidos, detalle_estado,
           idioma_preferido, zona_horaria, formato_fecha, inactividad_minutos)
        VALUES
          ($1, $2, $3, 'USUARIO', 'admin_test_local', 'admin.local@ridelab.test',
           false, '*', 'Cualquier horario', false, false,
           NOW(), 0, 10, 'Usuario administrador exclusivo de pruebas locales',
           'es', 'America/Santo_Domingo', 'DD/MM/YYYY', 480)
      `, [nextSegId, userId, passwordHash]);
    }

    // 4. Asegurar rol adicional de Administrador General en admin.usuario_rol_adicional
    const hasRolAdicional = await client.query(`
      SELECT 1 FROM admin.usuario_rol_adicional 
      WHERE usuario_id = $1 AND rol_funcional_id = 1
    `, [userId]);

    if (hasRolAdicional.rows.length === 0) {
      const maxUraRes = await client.query(`SELECT COALESCE(MAX(usuario_rol_adicional_id), 0) + 1 AS next_id FROM admin.usuario_rol_adicional`);
      const nextUraId = parseInt(maxUraRes.rows[0].next_id, 10);

      await client.query(`
        INSERT INTO admin.usuario_rol_adicional
          (usuario_rol_adicional_id, usuario_id, rol_funcional_id, fecha_creacion, fecha_actualizacion)
        VALUES
          ($1, $2, 1, NOW(), NOW())
      `, [nextUraId, userId]);
      console.log('[OK] Asignado rol adicional ID 1 (Administrador General).');
    }

    // 5. Validar dentro de la transacción
    const verifyRes = await client.query(`
      SELECT 
        u.usuario_id,
        u.empresa_id,
        u.estado as estado_usuario,
        tu.nombre as tipo_usuario,
        rf.nombre as rol_principal,
        us.identificador_principal,
        us.metodo_acceso_principal,
        us.correo_acceso
      FROM admin.usuario u
      JOIN admin.tipo_usuario tu ON u.tipo_usuario_id = tu.tipo_usuario_id
      JOIN admin.rol_funcional rf ON u.rol_principal_id = rf.rol_funcional_id
      JOIN admin.usuario_seguridad us ON u.usuario_id = us.usuario_id
      WHERE u.usuario_id = $1
    `, [userId]);

    console.log('\n[USUARIO PROVISIONADO CORRECTAMENTE]');
    console.table(verifyRes.rows);

    await client.query('COMMIT');
    console.log('[ÉXITO] Transacción confirmada. Usuario administrador de pruebas listo para login.\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ERROR] Error al crear usuario administrador:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

createAdmin().catch(console.error);
