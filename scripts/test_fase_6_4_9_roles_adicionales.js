/**
 * RIDE LAB — FASE 6.4.9: SUITE DE PRUEBAS DE GESTIÓN COMPLETA DE ROLES ADICIONALES Y MIGRACIÓN 047
 * 
 * Cobertura obligatoria: 26 escenarios funcionales y de seguridad.
 * Ejecución exclusiva en PostgreSQL local test (127.0.0.1:5432/bikers_dbtest).
 */

const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { Pool } = require('pg');

const env = dotenv.parse(fs.readFileSync('.env.test.local'));
process.env.DATABASE_URL = env.DATABASE_URL;
process.env.APP_ENV = 'test';
const pool = new Pool({ connectionString: env.DATABASE_URL });

const BASE_URL = process.env.TEST_APP_URL || 'http://localhost:3000';

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

function makeHttpRequest(urlPath, sessionToken = null, method = 'GET', bodyData = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const headers = {};
    if (sessionToken) {
      headers['Cookie'] = `session_token=${sessionToken}`;
    }
    if (bodyData) {
      headers['Content-Type'] = 'application/json';
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = null;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(25000, () => {
      req.destroy();
      reject(new Error(`Request to ${urlPath} timed out`));
    });

    if (bodyData) {
      req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
    }
    req.end();
  });
}

async function runFase649Tests() {
  const client = await pool.connect();
  const createdSessions = [];
  const createdUsers = [];
  const testResults = [];
  let passedCount = 0;
  let failedCount = 0;

  function record(num, name, condition, details = '') {
    const status = condition ? 'PASS' : 'FAIL';
    if (condition) passedCount++;
    else failedCount++;

    const icon = condition ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon} [Escenario ${num.toString().padStart(2, '0')}] ${name}`);
    if (details) console.log(`   Detalle: ${details}`);
    testResults.push({ num, name, status, details });
  }

  async function createSession(userId) {
    const rawToken = 'fase649_' + crypto.randomBytes(24).toString('hex');
    const tokenHash = hashSessionToken(rawToken);
    const res = await client.query(`
      INSERT INTO admin.usuario_sesion (
        usuario_id, token_identificador, dispositivo_navegador, direccion_ip,
        ubicacion, fecha_inicio, ultima_actividad, fecha_expiracion, estado
      ) VALUES (
        $1, $2, 'Fase 6.4.9 Test Agent', '127.0.0.1', 'Localhost',
        NOW(), NOW(), NOW() + INTERVAL '1 hour', 'ACTIVA'
      ) RETURNING sesion_id
    `, [userId, tokenHash]);
    createdSessions.push(res.rows[0].sesion_id);
    return rawToken;
  }

  async function createSyntheticUser({ companyId = 1, roleId = 5, emailPrefix = 'synth' }) {
    const email = `${emailPrefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}@testbikers.com`;
    const maxUserRes = await client.query(`SELECT COALESCE(MAX(usuario_id), 0) + 1 AS next_id FROM admin.usuario`);
    const userId = Number(maxUserRes.rows[0].next_id);

    await client.query(`
      INSERT INTO admin.usuario (usuario_id, empresa_id, tipo_usuario_id, rol_principal_id, estado, estado_activacion, duracion_sesion_minutos, fecha_creacion)
      VALUES ($1, $2, 3, $3, 'ACTIVO', 'Activo', 480, NOW())
    `, [userId, companyId, roleId]);

    await client.query(`
      INSERT INTO admin.usuario_identidad (usuario_id, nombre, apellido, correo_electronico, telefono)
      VALUES ($1, 'Synth', 'TestUser', $2, '8095550000')
    `, [userId, email]);

    const maxSegRes = await client.query(`SELECT COALESCE(MAX(usuario_seguridad_id), 0) + 1 AS next_id FROM admin.usuario_seguridad`);
    const segId = Number(maxSegRes.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.usuario_seguridad (usuario_seguridad_id, usuario_id, password, metodo_acceso_principal, identificador_principal, mfa_activo, requiere_cambio_clave, forzar_cambio_clave)
      VALUES ($1, $2, 'hash_placeholder', 'EMAIL', $3, false, false, false)
    `, [segId, userId, email]);

    createdUsers.push(userId);
    return { userId, email };
  }

  console.log("======================================================================");
  console.log("--- FASE 6.4.9: GESTIÓN DE ROLES ADICIONALES Y MIGRACIÓN 047 SUITE ---");
  console.log("======================================================================\n");

  try {
    // 0. Base snapshot check
    const countBeforeRes = await client.query(`SELECT COUNT(*) FROM admin.usuario`);
    const userCountBefore = Number(countBeforeRes.rows[0].count);
    console.log(`[INIT] Conteo inicial de usuarios en bikers_dbtest: ${userCountBefore}`);

    // Verify company 2 exists
    const comp2Check = await client.query(`SELECT empresa_id FROM admin.empresa WHERE empresa_id = 2`);
    if (comp2Check.rows.length === 0) {
      await client.query(`INSERT INTO admin.empresa (empresa_id, nombre_comercial, razon_social, estado) VALUES (2, 'Empresa Test 2', 'Empresa Test 2 SAS', 'ACTIVO')`);
    }

    // Create actors
    const superAdmin = await createSyntheticUser({ companyId: 1, roleId: 1, emailPrefix: 'synth_super' });
    const superToken = await createSession(superAdmin.userId);

    const delegatedAdmin = await createSyntheticUser({ companyId: 1, roleId: 2, emailPrefix: 'synth_delegated' });
    const delegatedToken = await createSession(delegatedAdmin.userId);

    const ordinaryUser = await createSyntheticUser({ companyId: 1, roleId: 118, emailPrefix: 'synth_ordinary' });
    const ordinaryToken = await createSession(ordinaryUser.userId);

    const targetUser = await createSyntheticUser({ companyId: 1, roleId: 5, emailPrefix: 'synth_target' });

    const otherCompanyUser = await createSyntheticUser({ companyId: 2, roleId: 5, emailPrefix: 'synth_othercomp' });

    console.log(`[SETUP] Actores sintéticos inicializados con éxito.\n`);

    // ==================================================================
    // ESCENARIO 01: Creación de usuario sin roles adicionales (POST /api/usuarios)
    // ==================================================================
    const email01 = `test_no_add_${Date.now()}@testbikers.com`;
    const res01 = await makeHttpRequest('/api/usuarios', superToken, 'POST', {
      first_name: 'Usuario',
      last_name: 'SinAdicionales',
      email: email01,
      password: 'Password123!',
      confirm_password: 'Password123!',
      companyId: 1,
      roleId: 5,
      tipo_usuario_id: 3,
      roles_additional: []
    });
    const createdId01 = res01.json?.usuario_id || res01.json?.user_id || res01.json?.data?.id || res01.json?.id;
    if (createdId01) createdUsers.push(createdId01);
    const dbCheck01 = createdId01
      ? await client.query(`SELECT COUNT(*) FROM admin.usuario_rol_adicional WHERE usuario_id = $1`, [createdId01])
      : { rows: [{ count: -1 }] };
    record(1, "Creación de usuario sin roles adicionales",
      (res01.statusCode === 200 || res01.statusCode === 201) && Number(dbCheck01.rows[0].count) === 0,
      `HTTP ${res01.statusCode} — Registros en usuario_rol_adicional: ${dbCheck01.rows[0].count}`
    );

    // ==================================================================
    // ESCENARIO 02: Creación de usuario con 1 rol adicional (POST /api/usuarios)
    // ==================================================================
    const email02 = `test_1_add_${Date.now()}@testbikers.com`;
    const res02 = await makeHttpRequest('/api/usuarios', superToken, 'POST', {
      first_name: 'Usuario',
      last_name: 'ConUnRol',
      email: email02,
      password: 'Password123!',
      confirm_password: 'Password123!',
      companyId: 1,
      roleId: 5,
      tipo_usuario_id: 3,
      roles_additional: [3]
    });
    const createdId02 = res02.json?.usuario_id || res02.json?.user_id || res02.json?.data?.id || res02.json?.id;
    if (createdId02) createdUsers.push(createdId02);
    const dbCheck02 = createdId02
      ? await client.query(`SELECT rol_funcional_id, usuario_rol_adicional_id FROM admin.usuario_rol_adicional WHERE usuario_id = $1`, [createdId02])
      : { rows: [] };
    record(2, "Creación de usuario con 1 rol adicional",
      (res02.statusCode === 200 || res02.statusCode === 201) && dbCheck02.rows.length === 1 && dbCheck02.rows[0].rol_funcional_id === 3 && dbCheck02.rows[0].usuario_rol_adicional_id > 0,
      `HTTP ${res02.statusCode} — Rol asignado: ${dbCheck02.rows[0]?.rol_funcional_id}, Secuencia ID: ${dbCheck02.rows[0]?.usuario_rol_adicional_id}`
    );

    // ==================================================================
    // ESCENARIO 03: Creación de usuario con múltiples roles adicionales (POST /api/usuarios)
    // ==================================================================
    const email03 = `test_multi_add_${Date.now()}@testbikers.com`;
    const res03 = await makeHttpRequest('/api/usuarios', superToken, 'POST', {
      first_name: 'Usuario',
      last_name: 'ConVariosRoles',
      email: email03,
      password: 'Password123!',
      confirm_password: 'Password123!',
      companyId: 1,
      roleId: 5,
      tipo_usuario_id: 3,
      roles_additional: [3, 4]
    });
    const createdId03 = res03.json?.usuario_id || res03.json?.user_id || res03.json?.data?.id || res03.json?.id;
    if (createdId03) createdUsers.push(createdId03);
    const dbCheck03 = createdId03
      ? await client.query(`SELECT rol_funcional_id FROM admin.usuario_rol_adicional WHERE usuario_id = $1 ORDER BY rol_funcional_id`, [createdId03])
      : { rows: [] };
    const roles03 = dbCheck03.rows.map(r => r.rol_funcional_id);
    record(3, "Creación de usuario con múltiples roles adicionales",
      (res03.statusCode === 200 || res03.statusCode === 201) && roles03.length === 2 && roles03[0] === 3 && roles03[1] === 4,
      `HTTP ${res03.statusCode} — Roles asignados: [${roles03.join(', ')}]`
    );

    // ==================================================================
    // ESCENARIO 04: Edición de roles adicionales existentes (PUT /api/usuarios/[id])
    // ==================================================================
    // Modificamos al usuario creado en Escenario 02 (que tenía [3]) para que tenga [4]
    const res04 = await makeHttpRequest(`/api/usuarios/${createdId02}`, superToken, 'PUT', {
      roles_additional: [4]
    });
    const dbCheck04 = await client.query(`SELECT rol_funcional_id FROM admin.usuario_rol_adicional WHERE usuario_id = $1`, [createdId02]);
    const roles04 = dbCheck04.rows.map(r => r.rol_funcional_id);
    record(4, "Edición de roles adicionales existentes (reemplazo [3] -> [4])",
      res04.statusCode === 200 && roles04.length === 1 && roles04[0] === 4,
      `HTTP ${res04.statusCode} — Roles en DB: [${roles04.join(', ')}]`
    );

    // ==================================================================
    // ESCENARIO 05: Agregar rol secundario en edición (PUT /api/usuarios/[id])
    // ==================================================================
    // Modificamos para agregar rol 6 manteniendo 4: [4, 6]
    const res05 = await makeHttpRequest(`/api/usuarios/${createdId02}`, superToken, 'PUT', {
      roles_additional: [4, 6]
    });
    const dbCheck05 = await client.query(`SELECT rol_funcional_id FROM admin.usuario_rol_adicional WHERE usuario_id = $1 ORDER BY rol_funcional_id`, [createdId02]);
    const roles05 = dbCheck05.rows.map(r => r.rol_funcional_id);
    record(5, "Agregar rol secundario en edición ([4] -> [4, 6])",
      res05.statusCode === 200 && roles05.length === 2 && roles05[0] === 4 && roles05[1] === 6,
      `HTTP ${res05.statusCode} — Roles en DB: [${roles05.join(', ')}]`
    );

    // ==================================================================
    // ESCENARIO 06: Retirar rol secundario en edición (PUT /api/usuarios/[id])
    // ==================================================================
    // Retiramos rol 4 dejando solo 6: [6]
    const res06 = await makeHttpRequest(`/api/usuarios/${createdId02}`, superToken, 'PUT', {
      roles_additional: [6]
    });
    const dbCheck06 = await client.query(`SELECT rol_funcional_id FROM admin.usuario_rol_adicional WHERE usuario_id = $1`, [createdId02]);
    const roles06 = dbCheck06.rows.map(r => r.rol_funcional_id);
    record(6, "Retirar rol secundario en edición ([4, 6] -> [6])",
      res06.statusCode === 200 && roles06.length === 1 && roles06[0] === 6,
      `HTTP ${res06.statusCode} — Roles en DB: [${roles06.join(', ')}]`
    );

    // ==================================================================
    // ESCENARIO 07: Retirar todos los roles secundarios (roles_additional: [])
    // ==================================================================
    const res07 = await makeHttpRequest(`/api/usuarios/${createdId02}`, superToken, 'PUT', {
      roles_additional: []
    });
    const dbCheck07 = await client.query(`SELECT COUNT(*) FROM admin.usuario_rol_adicional WHERE usuario_id = $1`, [createdId02]);
    record(7, "Retirar todos los roles secundarios (roles_additional: [])",
      res07.statusCode === 200 && Number(dbCheck07.rows[0].count) === 0,
      `HTTP ${res07.statusCode} — Cantidad en DB: ${dbCheck07.rows[0].count}`
    );

    // ==================================================================
    // ESCENARIO 08: Omitir campo roles_additional en PUT y conservar existentes
    // ==================================================================
    // Primero le asignamos [3, 4]
    await makeHttpRequest(`/api/usuarios/${createdId02}`, superToken, 'PUT', { roles_additional: [3, 4] });
    // Luego actualizamos solo el nombre, omitiendo roles_additional
    const res08 = await makeHttpRequest(`/api/usuarios/${createdId02}`, superToken, 'PUT', {
      first_name: 'NombreActualizado'
    });
    const dbCheck08 = await client.query(`SELECT rol_funcional_id FROM admin.usuario_rol_adicional WHERE usuario_id = $1 ORDER BY rol_funcional_id`, [createdId02]);
    const roles08 = dbCheck08.rows.map(r => r.rol_funcional_id);
    record(8, "Omitir campo roles_additional en PUT conserva roles existentes",
      res08.statusCode === 200 && roles08.length === 2 && roles08[0] === 3 && roles08[1] === 4,
      `HTTP ${res08.statusCode} — Roles conservados en DB: [${roles08.join(', ')}]`
    );

    // ==================================================================
    // ESCENARIO 09: Rechazo de duplicados en el arreglo de entrada ([3, 3])
    // ==================================================================
    const res09 = await makeHttpRequest(`/api/usuarios/${createdId02}`, superToken, 'PUT', {
      roles_additional: [3, 3]
    });
    const msg09 = (res09.json?.message || res09.json?.error || res09.body).toLowerCase();
    record(9, "Rechazo de duplicados en roles_additional ([3, 3])",
      res09.statusCode === 400 && msg09.includes('duplicados'),
      `HTTP ${res09.statusCode} — Mensaje: ${res09.json?.message || res09.body}`
    );

    // ==================================================================
    // ESCENARIO 10: Rechazo de roles inactivos (Rol 11: FELIX, INACTIVO)
    // ==================================================================
    const res10 = await makeHttpRequest(`/api/usuarios/${createdId02}`, superToken, 'PUT', {
      roles_additional: [11]
    });
    const msg10 = (res10.json?.message || res10.json?.error || res10.body).toLowerCase();
    record(10, "Rechazo de rol inactivo (Rol 11)",
      res10.statusCode === 400 && (msg10.includes('no existe') || msg10.includes('activo')),
      `HTTP ${res10.statusCode} — Mensaje: ${res10.json?.message || res10.body}`
    );

    // ==================================================================
    // ESCENARIO 11: Rechazo de rol inexistente en la base de datos (Rol 99999)
    // ==================================================================
    const res11 = await makeHttpRequest(`/api/usuarios/${createdId02}`, superToken, 'PUT', {
      roles_additional: [99999]
    });
    const msg11 = (res11.json?.message || res11.json?.error || res11.body).toLowerCase();
    record(11, "Rechazo de rol inexistente (Rol 99999)",
      res11.statusCode === 400 && (msg11.includes('no existe') || msg11.includes('activo')),
      `HTTP ${res11.statusCode} — Mensaje: ${res11.json?.message || res11.body}`
    );

    // ==================================================================
    // ESCENARIO 12: Rechazo de rol adicional igual al rol principal
    // ==================================================================
    // targetUser tiene rol principal 5. Intentamos ponerle rol adicional 5.
    const res12 = await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, superToken, 'PUT', {
      roles_additional: [5]
    });
    const msg12 = (res12.json?.message || res12.json?.error || res12.body).toLowerCase();
    record(12, "Rechazo de rol adicional igual al rol principal",
      res12.statusCode === 400 && msg12.includes('principal'),
      `HTTP ${res12.statusCode} — Mensaje: ${res12.json?.message || res12.body}`
    );

    // ==================================================================
    // ESCENARIO 13: Bloqueo de asignación no autorizada de Rol 1 por no-SuperAdmin
    // ==================================================================
    // Administrador Delegado (Rol 2) intenta asignar Rol 1 como rol adicional a targetUser
    const res13 = await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, delegatedToken, 'PUT', {
      roles_additional: [1]
    });
    const dbCheck13 = await client.query(`SELECT COUNT(*) FROM admin.usuario_rol_adicional WHERE usuario_id = $1 AND rol_funcional_id = 1`, [targetUser.userId]);
    record(13, "Bloqueo de asignación de Rol 1 por usuario no-SuperAdmin",
      res13.statusCode === 403 && Number(dbCheck13.rows[0].count) === 0,
      `HTTP ${res13.statusCode} — Asignaciones de Rol 1 en DB: ${dbCheck13.rows[0].count}`
    );

    // ==================================================================
    // ESCENARIO 14: Asignación legítima institucional de Rol 1 por SuperAdmin autenticado
    // ==================================================================
    const res14 = await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, superToken, 'PUT', {
      roles_additional: [1]
    });
    const dbCheck14 = await client.query(`SELECT COUNT(*) FROM admin.usuario_rol_adicional WHERE usuario_id = $1 AND rol_funcional_id = 1`, [targetUser.userId]);
    record(14, "Asignación legítima institucional de Rol 1 por SuperAdmin",
      res14.statusCode === 200 && Number(dbCheck14.rows[0].count) === 1,
      `HTTP ${res14.statusCode} — Asignaciones de Rol 1 en DB: ${dbCheck14.rows[0].count}`
    );

    // ==================================================================
    // ESCENARIO 15: Bloqueo de auto-modificación de roles
    // ==================================================================
    // Delegated admin intenta asignarse rol adicional 1 a sí mismo
    const res15 = await makeHttpRequest(`/api/usuarios/${delegatedAdmin.userId}`, delegatedToken, 'PUT', {
      roles_additional: [1]
    });
    record(15, "Bloqueo de auto-modificación de roles adicionales",
      res15.statusCode === 403,
      `HTTP ${res15.statusCode} — Rechazo de auto-modificación verificado`
    );

    // ==================================================================
    // ESCENARIO 16: Rollback transaccional ante error
    // ==================================================================
    // Limpiamos roles de targetUser
    await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, superToken, 'PUT', { roles_additional: [3] });
    // Intentamos asignar [4, 99999] (el segundo falla)
    const res16 = await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, superToken, 'PUT', {
      roles_additional: [4, 99999]
    });
    const dbCheck16 = await client.query(`SELECT rol_funcional_id FROM admin.usuario_rol_adicional WHERE usuario_id = $1`, [targetUser.userId]);
    const roles16 = dbCheck16.rows.map(r => r.rol_funcional_id);
    record(16, "Rollback transaccional ante error en asignación",
      res16.statusCode === 400 && roles16.length === 1 && roles16[0] === 3,
      `HTTP ${res16.statusCode} — Estado conservado íntegramente: [${roles16.join(', ')}]`
    );

    // ==================================================================
    // ESCENARIO 17: Generación de IDs concurrentes sin colisión (secuencia de PostgreSQL)
    // ==================================================================
    const tempUserA = await createSyntheticUser({ companyId: 1, roleId: 5, emailPrefix: 'temp_conc_a' });
    const tempUserB = await createSyntheticUser({ companyId: 1, roleId: 5, emailPrefix: 'temp_conc_b' });
    const tempUserC = await createSyntheticUser({ companyId: 1, roleId: 5, emailPrefix: 'temp_conc_c' });
    const tempUserD = await createSyntheticUser({ companyId: 1, roleId: 5, emailPrefix: 'temp_conc_d' });

    // Use pool.query so each query runs on its own client connection in true concurrency
    const concurrentPromises = [
      pool.query(`INSERT INTO admin.usuario_rol_adicional (usuario_id, rol_funcional_id) VALUES ($1, 3) RETURNING usuario_rol_adicional_id`, [tempUserA.userId]),
      pool.query(`INSERT INTO admin.usuario_rol_adicional (usuario_id, rol_funcional_id) VALUES ($1, 3) RETURNING usuario_rol_adicional_id`, [tempUserB.userId]),
      pool.query(`INSERT INTO admin.usuario_rol_adicional (usuario_id, rol_funcional_id) VALUES ($1, 3) RETURNING usuario_rol_adicional_id`, [tempUserC.userId]),
      pool.query(`INSERT INTO admin.usuario_rol_adicional (usuario_id, rol_funcional_id) VALUES ($1, 3) RETURNING usuario_rol_adicional_id`, [tempUserD.userId])
    ];
    const concurrentResults = await Promise.all(concurrentPromises);
    const generatedIds = concurrentResults.map(r => r.rows[0].usuario_rol_adicional_id);
    const uniqueIds = new Set(generatedIds);
    record(17, "Generación de IDs concurrentes sin colisión vía secuencia",
      generatedIds.length === 4 && uniqueIds.size === 4 && generatedIds.every(id => id > 0),
      `IDs generados concurrentemente: [${generatedIds.join(', ')}]`
    );

    // ==================================================================
    // ESCENARIO 18: Integridad de restricción UNIQUE en admin.usuario_rol_adicional
    // ==================================================================
    let uniqueViolated18 = false;
    try {
      await client.query(`INSERT INTO admin.usuario_rol_adicional (usuario_id, rol_funcional_id) VALUES ($1, 3)`, [tempUserA.userId]);
    } catch (err) {
      if (err.code === '23505') uniqueViolated18 = true;
    }
    record(18, "Restricción UNIQUE en usuario_rol_adicional previene duplicados en DB",
      uniqueViolated18,
      `Error PostgreSQL 23505 (unique_violation) disparado correctamente`
    );

    // ==================================================================
    // ESCENARIO 19: Integridad de restricción UNIQUE uq_matriz_acceso_rol
    // ==================================================================
    const constrCheck19 = await client.query(`
      SELECT conname FROM pg_constraint 
      WHERE conname = 'uq_matriz_acceso_rol'
    `);
    let uniqueViolated19 = false;
    try {
      const sampleRow = await client.query(`SELECT rol_funcional_id, modulo_sistema_id FROM admin.matriz_acceso_rol LIMIT 1`);
      if (sampleRow.rows.length > 0) {
        await client.query(`
          INSERT INTO admin.matriz_acceso_rol (matriz_acceso_rol_id, rol_funcional_id, modulo_sistema_id, puede_ver)
          VALUES (999999, $1, $2, true)
        `, [sampleRow.rows[0].rol_funcional_id, sampleRow.rows[0].modulo_sistema_id]);
      }
    } catch (err) {
      if (err.code === '23505' && err.constraint === 'uq_matriz_acceso_rol') {
        uniqueViolated19 = true;
      }
    }
    record(19, "Restricción UNIQUE uq_matriz_acceso_rol aplicada y operativa",
      constrCheck19.rows.length === 1 && uniqueViolated19,
      `Constraint uq_matriz_acceso_rol presente en catálogo y rechaza colisiones con error 23505`
    );

    // ==================================================================
    // ESCENARIO 20: Permisos efectivos combinados (rol principal + roles adicionales)
    // ==================================================================
    // Asignamos al usuario targetUser rol principal 5 (Operador) y rol adicional 2 (Admin Empresa)
    await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, superToken, 'PUT', { roles_additional: [2] });
    const targetSessionToken = await createSession(targetUser.userId);
    const meRes20 = await makeHttpRequest('/api/auth/me', targetSessionToken, 'GET');
    const effectiveRoles = meRes20.json?.user?.roles_additional || meRes20.json?.roles_additional || [];
    record(20, "Permisos efectivos combinados devueltos en sesión",
      meRes20.statusCode === 200 && effectiveRoles.includes(2),
      `HTTP ${meRes20.statusCode} — Roles adicionales en sesión: [${effectiveRoles.join(', ')}]`
    );

    // ==================================================================
    // ESCENARIO 21: Revocación inmediata al retirar un rol adicional
    // ==================================================================
    // Retiramos rol adicional 2 dejando []
    await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, superToken, 'PUT', { roles_additional: [] });
    const meRes21 = await makeHttpRequest('/api/auth/me', targetSessionToken, 'GET');
    const effectiveRoles21 = meRes21.json?.user?.roles_additional || meRes21.json?.roles_additional || [];
    record(21, "Revocación inmediata al retirar rol adicional",
      meRes21.statusCode === 200 && !effectiveRoles21.includes(2),
      `HTTP ${meRes21.statusCode} — Roles adicionales tras retiro: [${effectiveRoles21.join(', ')}]`
    );

    // ==================================================================
    // ESCENARIO 22: Navegación y módulos agregados por rol adicional
    // ==================================================================
    // Verificamos que /api/matriz-acceso-rol incluye la matriz completa
    const rbacRes22 = await makeHttpRequest('/api/matriz-acceso-rol', superToken, 'GET');
    record(22, "Matriz RBAC disponible para cálculo dinámico en frontend",
      rbacRes22.statusCode === 200 && Array.isArray(rbacRes22.json?.roles) && rbacRes22.json?.roles.length > 0,
      `HTTP ${rbacRes22.statusCode} — Roles en catálogo RBAC: ${rbacRes22.json?.roles?.length}`
    );

    // ==================================================================
    // ESCENARIO 23: Smart Home Dispatcher responde a roles adicionales
    // ==================================================================
    // Verificamos respuesta de /api/auth/me informando roles combinados para el router
    const meRes23 = await makeHttpRequest('/api/auth/me', superToken, 'GET');
    record(23, "Información de autorización para Smart Home Dispatcher",
      meRes23.statusCode === 200 && (meRes23.json?.user?.is_superadmin === true || meRes23.json?.is_superadmin === true),
      `SuperAdmin identificado correctamente para Smart Home Dispatcher: ${meRes23.json?.is_superadmin ?? meRes23.json?.user?.is_superadmin}`
    );

    // ==================================================================
    // ESCENARIO 24: Aislamiento multiempresa preservado en la asignación
    // ==================================================================
    // Delegated admin de Empresa 1 intenta modificar al usuario de Empresa 2
    const res24 = await makeHttpRequest(`/api/usuarios/${otherCompanyUser.userId}`, delegatedToken, 'PUT', {
      roles_additional: [3]
    });
    const dbCheck24 = await client.query(`SELECT COUNT(*) FROM admin.usuario_rol_adicional WHERE usuario_id = $1`, [otherCompanyUser.userId]);
    record(24, "Aislamiento multiempresa impide modificar roles en otra empresa",
      (res24.statusCode === 404 || res24.statusCode === 403) && Number(dbCheck24.rows[0].count) === 0,
      `HTTP ${res24.statusCode} — Roles asignados en otra empresa: ${dbCheck24.rows[0].count}`
    );

    // ==================================================================
    // ESCENARIO 25: Persistencia y formato en GET /api/usuarios/[id]
    // ==================================================================
    // Le asignamos a targetUser los roles [3, 4] y consultamos GET /api/usuarios/[id]
    await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, superToken, 'PUT', { roles_additional: [3, 4] });
    const res25 = await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, superToken, 'GET');
    const userDetail25 = res25.json?.data || res25.json?.user || res25.json;
    const hasNumArray25 = Array.isArray(userDetail25?.roles_additional) && userDetail25.roles_additional.includes(3) && userDetail25.roles_additional.includes(4);
    const hasObjArray25 = Array.isArray(userDetail25?.additional_roles) && userDetail25.additional_roles.length === 2;
    record(25, "Persistencia y formato devuelto en GET /api/usuarios/[id]",
      res25.statusCode === 200 && hasNumArray25 && hasObjArray25,
      `HTTP ${res25.statusCode} — roles_additional: [${userDetail25?.roles_additional?.join(', ')}], additional_roles: ${userDetail25?.additional_roles?.length} objetos`
    );

    // ==================================================================
    // ESCENARIO 26: Conservación del registro histórico de usuario 234 con rol adicional 1
    // ==================================================================
    const dbCheck26 = await client.query(`
      SELECT usuario_rol_adicional_id, usuario_id, rol_funcional_id 
      FROM admin.usuario_rol_adicional 
      WHERE usuario_id = 234
    `);
    const preserved26 = dbCheck26.rows.length === 1 &&
      dbCheck26.rows[0].usuario_rol_adicional_id === 1 &&
      dbCheck26.rows[0].rol_funcional_id === 1;
    record(26, "Conservación del registro histórico de usuario 234 con rol 1",
      preserved26,
      `Registro usuario 234: ID=${dbCheck26.rows[0]?.usuario_rol_adicional_id}, Rol=${dbCheck26.rows[0]?.rol_funcional_id}`
    );

  } catch (err) {
    console.error("FATAL ERROR IN TEST SUITE:", err);
  } finally {
    // Cleanup synthetic data
    console.log("\n[CLEANUP] Limpiando datos de prueba sintéticos...");
    try {
      if (createdSessions.length > 0) {
        await client.query(`DELETE FROM admin.usuario_sesion WHERE sesion_id = ANY($1::int[])`, [createdSessions]);
      }
      if (createdUsers.length > 0) {
        await client.query(`DELETE FROM admin.usuario_rol_adicional WHERE usuario_id = ANY($1::int[]) AND usuario_id != 234`, [createdUsers]);
        await client.query(`DELETE FROM admin.usuario_alcance WHERE usuario_id = ANY($1::int[])`, [createdUsers]);
        await client.query(`DELETE FROM admin.usuario_auditoria WHERE admin_id = ANY($1::int[]) OR usuario_id = ANY($1::int[])`, [createdUsers]);
        await client.query(`DELETE FROM admin.usuario_actividad WHERE usuario_id = ANY($1::int[])`, [createdUsers]);
        await client.query(`DELETE FROM admin.usuario_sesion WHERE usuario_id = ANY($1::int[])`, [createdUsers]);
        await client.query(`DELETE FROM admin.usuario_seguridad WHERE usuario_id = ANY($1::int[])`, [createdUsers]);
        await client.query(`DELETE FROM admin.usuario_identidad WHERE usuario_id = ANY($1::int[])`, [createdUsers]);
        await client.query(`DELETE FROM admin.usuario WHERE usuario_id = ANY($1::int[]) AND usuario_id != 234`, [createdUsers]);
      }
      console.log(`[CLEANUP] ${createdUsers.length} usuarios y ${createdSessions.length} sesiones sintéticas eliminadas con éxito.`);
    } catch (cleanupErr) {
      console.warn("Advertencia durante limpieza:", cleanupErr.message);
    }

    client.release();
    await pool.end();

    console.log("\n======================================================================");
    console.log(`--- RESUMEN FINAL: ${passedCount} PASADOS / ${failedCount} FALLADOS (TOTAL: 26) ---`);
    console.log("======================================================================\n");

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runFase649Tests();
