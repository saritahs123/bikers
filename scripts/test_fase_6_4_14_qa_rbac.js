/**
 * RIDE LAB — FASE 6.4.14: QA FINAL DE PERMISOS RBAC Y VALIDACIÓN FUNCIONAL
 * Suite Automatizada de Validación de Seguridad, Control de Asignación y Modelo B
 * 
 * Cobertura Completa:
 * 1. puede_editar = true, puede_asignar = false: permite editar nombre/teléfono.
 * 2. El mismo usuario no puede cambiar el rol principal (HTTP 403).
 * 3. El mismo usuario no puede agregar roles adicionales (HTTP 403).
 * 4. El mismo usuario no puede retirar roles adicionales (HTTP 403).
 * 5. El mismo usuario no puede cambiar roles utilizando alias alternativos (HTTP 403).
 * 6. Usuario con puede_editar = true y puede_asignar = true: puede modificar roles autorizados (HTTP 200).
 * 7. Usuario con puede_crear = true, puede_asignar = false: no puede crear usuarios asignándoles roles (HTTP 403).
 * 8. Usuario con ambos permisos (crear + asignar): puede crear usuarios con roles autorizados (HTTP 200).
 * 9. Usuario no-SuperAdmin: no puede asignar Rol 1 (HTTP 403).
 * 10. Usuario SuperAdmin: puede realizar asignaciones institucionales legítimas (HTTP 200).
 * 11. Ningún usuario puede autoescalar privilegios (HTTP 403).
 * 12. No hay modificaciones parciales ante HTTP 403 (atomicidad garantizada).
 * 13. Aislamiento multiempresa estricto (HTTP 403).
 * 14. Conservación de roles adicionales cuando el campo se omite en PUT.
 * 15. Vaciado permitido de roles adicionales mediante [] con autorización (HTTP 200).
 * 16. Revocación inmediata en caliente de puede_asignar sin relogin.
 * 17. Peticiones concurrentes no eluden los controles de seguridad.
 * 18-25. Pruebas funcionales de módulos (Facturación, Taller, CRM, Inventario, Configuración, Reportes, Seguridad).
 * 
 * Base de datos: local PostgreSQL test (127.0.0.1:5432/bikers_dbtest).
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

async function runFase6414Tests() {
  const client = await pool.connect();
  const createdSessions = [];
  const createdUsers = [];
  const createdRoles = [];
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
    const rawToken = 'fase6414_' + crypto.randomBytes(24).toString('hex');
    const tokenHash = hashSessionToken(rawToken);
    const res = await client.query(`
      INSERT INTO admin.usuario_sesion (
        usuario_id, token_identificador, dispositivo_navegador, direccion_ip,
        ubicacion, fecha_inicio, ultima_actividad, fecha_expiracion, estado
      ) VALUES (
        $1, $2, 'Fase 6.4.14 QA Test Agent', '127.0.0.1', 'Localhost',
        NOW(), NOW(), NOW() + INTERVAL '1 hour', 'ACTIVA'
      ) RETURNING sesion_id
    `, [userId, tokenHash]);
    createdSessions.push(res.rows[0].sesion_id);
    return rawToken;
  }

  async function createSyntheticUser({ companyId = 1, roleId = 5, emailPrefix = 'qa_test' }) {
    const email = `${emailPrefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}@testbikers.com`;
    const maxUserRes = await client.query(`SELECT COALESCE(MAX(usuario_id), 0) + 1 AS next_id FROM admin.usuario`);
    const userId = Number(maxUserRes.rows[0].next_id);

    await client.query(`
      INSERT INTO admin.usuario (usuario_id, empresa_id, tipo_usuario_id, rol_principal_id, estado, estado_activacion, duracion_sesion_minutos, fecha_creacion)
      VALUES ($1, $2, 3, $3, 'ACTIVO', 'Activo', 480, NOW())
    `, [userId, companyId, roleId]);

    await client.query(`
      INSERT INTO admin.usuario_identidad (usuario_id, nombre, apellido, correo_electronico, telefono)
      VALUES ($1, 'SynthQA', 'UserTest', $2, '8095551234')
    `, [userId, email]);

    const maxSegRes = await client.query(`SELECT COALESCE(MAX(usuario_seguridad_id), 0) + 1 AS next_id FROM admin.usuario_seguridad`);
    const segId = Number(maxSegRes.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.usuario_seguridad (usuario_seguridad_id, usuario_id, password, metodo_acceso_principal, identificador_principal, mfa_activo, requiere_cambio_clave, forzar_cambio_clave)
      VALUES ($1, $2, 'hash_placeholder', 'EMAIL', $3, false, false, false)
    `, [segId, userId, email]);

    createdUsers.push(userId);
    return userId;
  }

  async function createSyntheticRole(name, description, permissions) {
    const uniqueRoleName = `${name}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const maxRfRes = await client.query(`SELECT COALESCE(MAX(rol_funcional_id), 0) + 1 AS next_id FROM admin.rol_funcional`);
    const roleId = Number(maxRfRes.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.rol_funcional (rol_funcional_id, nombre, descripcion, estado, fecha_creacion)
      VALUES ($1, $2, $3, 'ACTIVO', NOW())
    `, [roleId, uniqueRoleName, description]);
    createdRoles.push(roleId);

    // Módulo SEGURIDAD (id = 2)
    const maxMarRes = await client.query(`SELECT COALESCE(MAX(matriz_acceso_rol_id), 0) + 1 AS next_id FROM admin.matriz_acceso_rol`);
    await client.query(`
      INSERT INTO admin.matriz_acceso_rol (
        matriz_acceso_rol_id, rol_funcional_id, modulo_sistema_id,
        puede_ver, puede_crear, puede_editar, puede_inactivar, puede_exportar, puede_importar,
        puede_aprobar, puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
        estado, fecha_creacion, fecha_actualizacion
      ) VALUES (
        $1, $2, 2,
        $3, $4, $5, false, false, false,
        false, $6, false, false, false, false,
        'ACTIVO', NOW(), NOW()
      )
    `, [
      Number(maxMarRes.rows[0].next_id), roleId,
      Boolean(permissions.puede_ver), Boolean(permissions.puede_crear),
      Boolean(permissions.puede_editar), Boolean(permissions.puede_asignar)
    ]);

    // Pantalla SEGURIDAD_USUARIOS (pantalla_id de /settings/security/users)
    const pantRes = await client.query(`SELECT pantalla_id FROM admin.pantalla_sistema WHERE UPPER(codigo) = 'SEGURIDAD_USUARIOS' OR ruta = '/settings/security/users' LIMIT 1`);
    if (pantRes.rows.length > 0) {
      const pantId = pantRes.rows[0].pantalla_id;
      const maxMapRes = await client.query(`SELECT COALESCE(MAX(matriz_pantalla_id), 0) + 1 AS next_id FROM admin.matriz_acceso_pantalla`);
      await client.query(`
        INSERT INTO admin.matriz_acceso_pantalla (
          matriz_pantalla_id, rol_funcional_id, pantalla_id,
          puede_ver, puede_crear, puede_editar, puede_inactivar, puede_exportar, puede_importar,
          puede_aprobar, puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
          estado, fecha_creacion, fecha_actualizacion
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6, false, false, false,
          false, $7, false, false, false, false,
          'ACTIVO', NOW(), NOW()
        )
      `, [
        Number(maxMapRes.rows[0].next_id), roleId, pantId,
        Boolean(permissions.puede_ver), Boolean(permissions.puede_crear),
        Boolean(permissions.puede_editar), Boolean(permissions.puede_asignar)
      ]);
    }

    return roleId;
  }

  try {
    console.log('='.repeat(80));
    console.log('RIDE LAB — FASE 6.4.14: QA FINAL DE PERMISOS RBAC Y VALIDACIÓN FUNCIONAL');
    console.log('='.repeat(80));

    // 0. Pre-limpieza de cualquier rol o usuario sintético previo de QA
    await client.query(`DELETE FROM admin.matriz_acceso_pantalla WHERE rol_funcional_id IN (SELECT rol_funcional_id FROM admin.rol_funcional WHERE nombre LIKE 'QA_%')`);
    await client.query(`DELETE FROM admin.matriz_acceso_rol WHERE rol_funcional_id IN (SELECT rol_funcional_id FROM admin.rol_funcional WHERE nombre LIKE 'QA_%')`);
    await client.query(`DELETE FROM admin.usuario_rol_adicional WHERE rol_funcional_id IN (SELECT rol_funcional_id FROM admin.rol_funcional WHERE nombre LIKE 'QA_%')`);
    await client.query(`DELETE FROM admin.rol_funcional WHERE nombre LIKE 'QA_%'`);

    // 1. Obtener usuario SuperAdmin existente (Rol 1)
    const superAdminRes = await client.query(`
      SELECT u.usuario_id
      FROM admin.usuario u
      WHERE u.rol_principal_id = 1 AND u.estado = 'ACTIVO'
      ORDER BY u.usuario_id ASC LIMIT 1
    `);
    if (superAdminRes.rows.length === 0) {
      throw new Error('No se encontró usuario SuperAdmin (rol_principal_id=1) activo.');
    }
    const superAdminId = superAdminRes.rows[0].usuario_id;
    const superAdminToken = await createSession(superAdminId);

    // 2. Crear Roles Especializados para la Suite de Pruebas:
    // Rol A: Solo Editar (puede_ver=true, puede_editar=true, puede_asignar=false)
    const roleEditOnlyId = await createSyntheticRole('QA_EDIT_NO_ASSIGN', 'Rol de prueba con editar sin asignar', {
      puede_ver: true, puede_crear: false, puede_editar: true, puede_asignar: false
    });
    const userEditOnlyId = await createSyntheticUser({ companyId: 1, roleId: roleEditOnlyId, emailPrefix: 'qa_edit_only' });
    const tokenEditOnly = await createSession(userEditOnlyId);

    // Rol B: Editar Y Asignar (puede_ver=true, puede_editar=true, puede_asignar=true)
    const roleEditAndAssignId = await createSyntheticRole('QA_EDIT_AND_ASSIGN', 'Rol de prueba con editar y asignar', {
      puede_ver: true, puede_crear: false, puede_editar: true, puede_asignar: true
    });
    const userEditAndAssignId = await createSyntheticUser({ companyId: 1, roleId: roleEditAndAssignId, emailPrefix: 'qa_edit_assign' });
    const tokenEditAndAssign = await createSession(userEditAndAssignId);

    // Rol C: Solo Crear (puede_ver=true, puede_crear=true, puede_asignar=false)
    const roleCreateOnlyId = await createSyntheticRole('QA_CREATE_NO_ASSIGN', 'Rol de prueba con crear sin asignar', {
      puede_ver: true, puede_crear: true, puede_editar: false, puede_asignar: false
    });
    const userCreateOnlyId = await createSyntheticUser({ companyId: 1, roleId: roleCreateOnlyId, emailPrefix: 'qa_create_only' });
    const tokenCreateOnly = await createSession(userCreateOnlyId);

    // Rol D: Crear Y Asignar (puede_ver=true, puede_crear=true, puede_asignar=true)
    const roleCreateAndAssignId = await createSyntheticRole('QA_CREATE_AND_ASSIGN', 'Rol de prueba con crear y asignar', {
      puede_ver: true, puede_crear: true, puede_editar: false, puede_asignar: true
    });
    const userCreateAndAssignId = await createSyntheticUser({ companyId: 1, roleId: roleCreateAndAssignId, emailPrefix: 'qa_create_assign' });
    const tokenCreateAndAssign = await createSession(userCreateAndAssignId);

    // Usuario Objetivo (Target): rol_principal_id = 5, con rol adicional = 3
    const targetUserId = await createSyntheticUser({ companyId: 1, roleId: 5, emailPrefix: 'qa_target' });
    await client.query(`
      INSERT INTO admin.usuario_rol_adicional (usuario_id, rol_funcional_id)
      VALUES ($1, 3)
      ON CONFLICT DO NOTHING
    `, [targetUserId]);

    // Usuario en Otra Empresa (Empresa 2)
    const otherCompanyUserId = await createSyntheticUser({ companyId: 2, roleId: 5, emailPrefix: 'qa_other_comp' });

    console.log('\n--- ETAPA 1 Y 2: VALIDACIONES DE SEGURIDAD Y CONTROL DE ASIGNACIÓN ---');

    // =========================================================================
    // Escenario 1: puede_editar=true, puede_asignar=false permite editar nombre o teléfono
    // =========================================================================
    const res1 = await makeHttpRequest(`/api/usuarios/${targetUserId}`, tokenEditOnly, 'PUT', {
      first_name: 'NombreActualizadoOk',
      phone: '8095559999'
    });
    const db1 = await client.query(`SELECT nombre, telefono FROM admin.usuario_identidad WHERE usuario_id = $1`, [targetUserId]);
    record(1, 'puede_editar=true, puede_asignar=false permite editar nombre y teléfono',
      res1.statusCode === 200 && db1.rows[0].nombre === 'NombreActualizadoOk' && db1.rows[0].telefono === '8095559999',
      `Status: ${res1.statusCode}, DB Nombre: ${db1.rows[0].nombre}`
    );

    // =========================================================================
    // Escenario 2: El mismo usuario no puede cambiar el rol principal sin puede_asignar
    // =========================================================================
    const res2 = await makeHttpRequest(`/api/usuarios/${targetUserId}`, tokenEditOnly, 'PUT', {
      roleId: 6
    });
    const db2 = await client.query(`SELECT rol_principal_id FROM admin.usuario WHERE usuario_id = $1`, [targetUserId]);
    record(2, 'Usuario sin puede_asignar no puede cambiar el rol principal (HTTP 403)',
      res2.statusCode === 403 && db2.rows[0].rol_principal_id === 5,
      `Status: ${res2.statusCode}, Rol en DB: ${db2.rows[0].rol_principal_id}, Msg: ${res2.json?.message}`
    );

    // =========================================================================
    // Escenario 3: El mismo usuario no puede agregar roles adicionales sin puede_asignar
    // =========================================================================
    const res3 = await makeHttpRequest(`/api/usuarios/${targetUserId}`, tokenEditOnly, 'PUT', {
      roles_additional: [3, 4]
    });
    const db3 = await client.query(`SELECT rol_funcional_id FROM admin.usuario_rol_adicional WHERE usuario_id = $1 ORDER BY 1`, [targetUserId]);
    const addRoles3 = db3.rows.map(r => r.rol_funcional_id);
    record(3, 'Usuario sin puede_asignar no puede agregar roles adicionales (HTTP 403)',
      res3.statusCode === 403 && addRoles3.length === 1 && addRoles3[0] === 3,
      `Status: ${res3.statusCode}, Roles adicionales en DB: [${addRoles3.join(', ')}]`
    );

    // =========================================================================
    // Escenario 4: El mismo usuario no puede retirar roles adicionales sin puede_asignar
    // =========================================================================
    const res4 = await makeHttpRequest(`/api/usuarios/${targetUserId}`, tokenEditOnly, 'PUT', {
      roles_additional: []
    });
    const db4 = await client.query(`SELECT rol_funcional_id FROM admin.usuario_rol_adicional WHERE usuario_id = $1`, [targetUserId]);
    record(4, 'Usuario sin puede_asignar no puede retirar roles adicionales (HTTP 403)',
      res4.statusCode === 403 && db4.rows.length === 1 && db4.rows[0].rol_funcional_id === 3,
      `Status: ${res4.statusCode}, Roles en DB: ${db4.rows.length}`
    );

    // =========================================================================
    // Escenario 5: No se puede cambiar roles utilizando alias alternativos sin puede_asignar
    // =========================================================================
    const res5a = await makeHttpRequest(`/api/usuarios/${targetUserId}`, tokenEditOnly, 'PUT', { rol_principal_id: 6 });
    const res5b = await makeHttpRequest(`/api/usuarios/${targetUserId}`, tokenEditOnly, 'PUT', { role_id: 6 });
    const res5c = await makeHttpRequest(`/api/usuarios/${targetUserId}`, tokenEditOnly, 'PUT', { roles_adicionales: [4] });
    const res5d = await makeHttpRequest(`/api/usuarios/${targetUserId}`, tokenEditOnly, 'PUT', { additional_roles: [4] });
    const all5Blocked = [res5a, res5b, res5c, res5d].every(r => r.statusCode === 403);
    record(5, 'Alias alternativos de roles bloqueados estrictamente con HTTP 403',
      all5Blocked,
      `rol_principal_id: ${res5a.statusCode}, role_id: ${res5b.statusCode}, roles_adicionales: ${res5c.statusCode}, additional_roles: ${res5d.statusCode}`
    );

    // =========================================================================
    // Escenario 6: Usuario con puede_editar=true y puede_asignar=true puede modificar roles autorizados
    // =========================================================================
    const res6 = await makeHttpRequest(`/api/usuarios/${targetUserId}`, tokenEditAndAssign, 'PUT', {
      roleId: 6,
      roles_additional: [4]
    });
    const db6User = await client.query(`SELECT rol_principal_id FROM admin.usuario WHERE usuario_id = $1`, [targetUserId]);
    const db6Add = await client.query(`SELECT rol_funcional_id FROM admin.usuario_rol_adicional WHERE usuario_id = $1`, [targetUserId]);
    record(6, 'Usuario con puede_editar=true y puede_asignar=true modifica roles exitosamente',
      res6.statusCode === 200 && db6User.rows[0].rol_principal_id === 6 && db6Add.rows.length === 1 && db6Add.rows[0].rol_funcional_id === 4,
      `Status: ${res6.statusCode}, Rol en DB: ${db6User.rows[0].rol_principal_id}, Adicional en DB: ${db6Add.rows[0].rol_funcional_id}`
    );
    // Restaurar a rol 5 y adicional [3]
    await client.query(`UPDATE admin.usuario SET rol_principal_id = 5 WHERE usuario_id = $1`, [targetUserId]);
    await client.query(`DELETE FROM admin.usuario_rol_adicional WHERE usuario_id = $1`, [targetUserId]);
    await client.query(`INSERT INTO admin.usuario_rol_adicional (usuario_id, rol_funcional_id) VALUES ($1, 3)`, [targetUserId]);

    // =========================================================================
    // Escenario 7: Usuario con puede_crear=true, puede_asignar=false no puede crear usuarios asignando roles
    // =========================================================================
    const res7 = await makeHttpRequest('/api/usuarios', tokenCreateOnly, 'POST', {
      first_name: 'UsuarioSinAsignar',
      last_name: 'Test',
      email: `no_assign_create_${Date.now()}@testbikers.com`,
      companyId: 1,
      roleId: 5,
      tipo_usuario_id: 3,
      password: 'Password123!',
      confirm_password: 'Password123!'
    });
    record(7, 'Usuario con puede_crear=true, puede_asignar=false no puede crear usuarios con rol (HTTP 403)',
      res7.statusCode === 403,
      `Status: ${res7.statusCode}, Mensaje: ${res7.json?.message}`
    );

    // =========================================================================
    // Escenario 8: Usuario con ambos permisos (crear + asignar) puede crear usuarios con roles autorizados
    // =========================================================================
    const legitCreateEmail = `legit_assign_${Date.now()}@testbikers.com`;
    const res8 = await makeHttpRequest('/api/usuarios', tokenCreateAndAssign, 'POST', {
      first_name: 'UsuarioConAsignar',
      last_name: 'Test',
      email: legitCreateEmail,
      companyId: 1,
      roleId: 5,
      roles_additional: [3],
      tipo_usuario_id: 3,
      password: 'Password123!',
      confirm_password: 'Password123!'
    });
    const createdId8 = res8.json?.usuario_id || res8.json?.user_id;
    if (createdId8) createdUsers.push(createdId8);
    const db8 = createdId8 ? await client.query(`SELECT rol_principal_id FROM admin.usuario WHERE usuario_id = $1`, [createdId8]) : { rows: [] };
    record(8, 'Usuario con puede_crear=true y puede_asignar=true crea usuario con rol exitosamente (HTTP 200)',
      res8.statusCode === 200 && db8.rows.length > 0 && db8.rows[0].rol_principal_id === 5,
      `Status: ${res8.statusCode}, Usuario ID: ${createdId8}, Rol en DB: ${db8.rows[0]?.rol_principal_id}`
    );

    // =========================================================================
    // Escenario 9: Usuario no-SuperAdmin no puede asignar Rol 1 (ni principal ni adicional)
    // =========================================================================
    const res9a = await makeHttpRequest(`/api/usuarios/${targetUserId}`, tokenEditAndAssign, 'PUT', { roleId: 1 });
    const res9b = await makeHttpRequest(`/api/usuarios/${targetUserId}`, tokenEditAndAssign, 'PUT', { roles_additional: [1] });
    record(9, 'Usuario no-SuperAdmin no puede asignar Rol 1 institucional (HTTP 403)',
      res9a.statusCode === 403 && res9b.statusCode === 403,
      `roleId: 1 -> ${res9a.statusCode}, roles_additional: [1] -> ${res9b.statusCode}`
    );

    // =========================================================================
    // Escenario 10: Usuario SuperAdmin puede realizar asignaciones institucionales legítimas
    // =========================================================================
    const res10 = await makeHttpRequest(`/api/usuarios/${targetUserId}`, superAdminToken, 'PUT', {
      roleId: 1
    });
    const db10 = await client.query(`SELECT rol_principal_id FROM admin.usuario WHERE usuario_id = $1`, [targetUserId]);
    record(10, 'Usuario SuperAdmin realiza asignación institucional de Rol 1 con éxito (HTTP 200)',
      res10.statusCode === 200 && db10.rows[0].rol_principal_id === 1,
      `Status: ${res10.statusCode}, Rol en DB: ${db10.rows[0].rol_principal_id}`
    );
    // Restaurar inmediatamente el rol 5
    await client.query(`UPDATE admin.usuario SET rol_principal_id = 5 WHERE usuario_id = $1`, [targetUserId]);

    // =========================================================================
    // Escenario 11: Ningún usuario puede autoescalar privilegios
    // =========================================================================
    const res11SelfRole = await makeHttpRequest(`/api/usuarios/${userEditAndAssignId}`, tokenEditAndAssign, 'PUT', { roleId: 1 });
    const res11SelfAdd = await makeHttpRequest(`/api/usuarios/${userEditAndAssignId}`, tokenEditAndAssign, 'PUT', { roles_additional: [1] });
    record(11, 'Protección absoluta contra autoescalamiento de rol en cuenta propia (HTTP 403)',
      res11SelfRole.statusCode === 403 && res11SelfAdd.statusCode === 403,
      `Self Role: ${res11SelfRole.statusCode}, Self Additional: ${res11SelfAdd.statusCode}`
    );

    // =========================================================================
    // Escenario 12: No hay modificaciones parciales ante HTTP 403
    // =========================================================================
    const snapshotBefore = await client.query(`
      SELECT ui.nombre, u.rol_principal_id
      FROM admin.usuario u
      JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE u.usuario_id = $1
    `, [targetUserId]);
    const res12 = await makeHttpRequest(`/api/usuarios/${targetUserId}`, tokenEditOnly, 'PUT', {
      first_name: 'NombreNoDebeCambiar',
      roleId: 6
    });
    const snapshotAfter = await client.query(`
      SELECT ui.nombre, u.rol_principal_id
      FROM admin.usuario u
      JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE u.usuario_id = $1
    `, [targetUserId]);
    record(12, 'Atomicidad: Operación rechazada con HTTP 403 no realiza modificaciones parciales',
      res12.statusCode === 403 && snapshotBefore.rows[0].nombre === snapshotAfter.rows[0].nombre && snapshotBefore.rows[0].rol_principal_id === snapshotAfter.rows[0].rol_principal_id,
      `Status: ${res12.statusCode}, Nombre antes: '${snapshotBefore.rows[0].nombre}', después: '${snapshotAfter.rows[0].nombre}'`
    );

    // =========================================================================
    // Escenario 13: Aislamiento multiempresa estricto
    // =========================================================================
    const res13 = await makeHttpRequest(`/api/usuarios/${otherCompanyUserId}`, tokenEditAndAssign, 'PUT', {
      first_name: 'IntentoCrossCompany'
    });
    record(13, 'Aislamiento multiempresa: Rechazo de modificación sobre usuario de otra empresa (HTTP 403)',
      res13.statusCode === 403,
      `Status: ${res13.statusCode}, Mensaje: ${res13.json?.message}`
    );

    // =========================================================================
    // Escenario 14: Se conservan roles adicionales cuando el campo se omite en PUT
    // =========================================================================
    const res14 = await makeHttpRequest(`/api/usuarios/${targetUserId}`, tokenEditAndAssign, 'PUT', {
      phone: '8095558888'
    });
    const db14Add = await client.query(`SELECT rol_funcional_id FROM admin.usuario_rol_adicional WHERE usuario_id = $1`, [targetUserId]);
    record(14, 'Conservación estricta de roles adicionales al omitir campo en PUT',
      res14.statusCode === 200 && db14Add.rows.length === 1 && db14Add.rows[0].rol_funcional_id === 3,
      `Status: ${res14.statusCode}, Roles adicionales conservados: [${db14Add.rows.map(r => r.rol_funcional_id).join(', ')}]`
    );

    // =========================================================================
    // Escenario 15: Se permite vaciar roles adicionales mediante [] con autorización
    // =========================================================================
    const res15 = await makeHttpRequest(`/api/usuarios/${targetUserId}`, tokenEditAndAssign, 'PUT', {
      roles_additional: []
    });
    const db15Add = await client.query(`SELECT COUNT(*) FROM admin.usuario_rol_adicional WHERE usuario_id = $1`, [targetUserId]);
    record(15, 'Vaciado legítimo de roles adicionales mediante [] con puede_asignar (HTTP 200)',
      res15.statusCode === 200 && Number(db15Add.rows[0].count) === 0,
      `Status: ${res15.statusCode}, Conteo en DB tras vaciar: ${db15Add.rows[0].count}`
    );
    // Restaurar rol adicional [3]
    await client.query(`INSERT INTO admin.usuario_rol_adicional (usuario_id, rol_funcional_id) VALUES ($1, 3)`, [targetUserId]);

    // =========================================================================
    // Escenario 16: La revocación de puede_asignar se aplica inmediatamente en caliente
    // =========================================================================
    // Revocar puede_asignar en la matriz para roleEditAndAssignId
    await client.query(`UPDATE admin.matriz_acceso_rol SET puede_asignar = false WHERE rol_funcional_id = $1`, [roleEditAndAssignId]);
    await client.query(`UPDATE admin.matriz_acceso_pantalla SET puede_asignar = false WHERE rol_funcional_id = $1`, [roleEditAndAssignId]);

    const res16Revoked = await makeHttpRequest(`/api/usuarios/${targetUserId}`, tokenEditAndAssign, 'PUT', {
      roleId: 6
    });
    record(16, 'Revocación inmediata en caliente de puede_asignar sin relogin (HTTP 403)',
      res16Revoked.statusCode === 403,
      `Status tras revocación: ${res16Revoked.statusCode}, Mensaje: ${res16Revoked.json?.message}`
    );

    // =========================================================================
    // Escenario 17: Peticiones concurrentes no permiten eludir los controles
    // =========================================================================
    const concurrentRequests = Array.from({ length: 4 }, () =>
      makeHttpRequest(`/api/usuarios/${targetUserId}`, tokenEditOnly, 'PUT', { roleId: 6 })
    );
    const concurrentResults = await Promise.all(concurrentRequests);
    const allConcurrentBlocked = concurrentResults.every(r => r.statusCode === 403);
    const db17 = await client.query(`SELECT rol_principal_id FROM admin.usuario WHERE usuario_id = $1`, [targetUserId]);
    record(17, 'Peticiones concurrentes no eluden los controles: todas rechazadas con HTTP 403',
      allConcurrentBlocked && db17.rows[0].rol_principal_id === 5,
      `Códigos devueltos: [${concurrentResults.map(r => r.statusCode).join(', ')}], Rol en DB: ${db17.rows[0].rol_principal_id}`
    );

    // =========================================================================
    // Escenario 18: Rechazo de campos de rol no reconocidos
    // =========================================================================
    const res18 = await makeHttpRequest(`/api/usuarios/${targetUserId}`, tokenEditAndAssign, 'PUT', {
      custom_role_override: 2
    });
    record(18, 'Rechazo estricto de parámetros no reconocidos de asignación de roles (HTTP 400)',
      res18.statusCode === 400,
      `Status: ${res18.statusCode}, Mensaje: ${res18.json?.message}`
    );

    // -------------------------------------------------------------------------
    // ETAPAS 2 Y 3: VERIFICACIONES FUNCIONALES DE MÓDULOS Y MODELO B
    // -------------------------------------------------------------------------
    console.log('\n--- ETAPA 2 Y 3: VALIDACIÓN FUNCIONAL DE MÓDULOS OPERATIVOS ---');

    // Escenario 19: Facturación - POST requiere puede_crear
    const res19 = await makeHttpRequest('/api/facturacion/facturas', tokenEditOnly, 'POST', {
      tipo_factura_id: 1,
      lineas: [{ tipo_linea: 'PRODUCTO', producto_id: 1, cantidad: 1, precio_unitario: 100 }]
    });
    record(19, 'Facturación: POST /api/facturacion/facturas exige puede_crear (HTTP 403 sin permiso)',
      res19.statusCode === 403,
      `Status: ${res19.statusCode}`
    );

    // Escenario 20: Taller - Recepciones POST requiere puede_crear
    const res20 = await makeHttpRequest('/api/taller/recepciones', tokenEditOnly, 'POST', {
      cliente_id: 1,
      bicicleta_id: 1,
      diagnostico_preliminar: 'Prueba QA'
    });
    record(20, 'Taller: POST /api/taller/recepciones exige puede_crear (HTTP 403)',
      res20.statusCode === 403,
      `Status: ${res20.statusCode}`
    );

    // Escenario 21: Taller - Órdenes PUT exige puede_editar
    const existOrderRes = await client.query(`
      SELECT ot.orden_trabajo_id 
      FROM admin.ordenes_trabajo ot 
      JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id 
      JOIN admin.clientes c ON ot.cliente_id = c.cliente_id 
      WHERE c.empresa_id = 1 AND eot.codigo NOT IN ('ENTREGADA', 'CANCELADA') 
      LIMIT 1
    `);
    const validOrderId = existOrderRes.rows.length > 0 ? existOrderRes.rows[0].orden_trabajo_id : 464;
    const res21 = await makeHttpRequest(`/api/taller/ordenes/${validOrderId}`, tokenCreateOnly, 'PUT', {
      observacion_interna: 'Prueba QA sin permiso editar'
    });
    record(21, 'Taller: PUT /api/taller/ordenes/[id] exige puede_editar (HTTP 403 sin permiso)',
      res21.statusCode === 403,
      `Status: ${res21.statusCode}, Mensaje: ${res21.json?.message || res21.body}`
    );

    // Escenario 22: CRM - Niveles cliente GET emite cabeceras y POST exige puede_crear
    const res22Get = await makeHttpRequest('/api/crm/niveles-cliente', superAdminToken, 'GET');
    const res22Post = await makeHttpRequest('/api/crm/niveles-cliente', tokenEditOnly, 'POST', {
      nombre: 'Nivel Ilegal',
      porcentaje_descuento: 10
    });
    record(22, 'CRM: Cabeceras emitidas en GET y bloqueo HTTP 403 en POST sin puede_crear',
      res22Get.statusCode === 200 && res22Get.headers['x-perm-ver'] !== undefined && res22Post.statusCode === 403,
      `GET Status: ${res22Get.statusCode}, POST Status: ${res22Post.statusCode}`
    );

    // Escenario 23: Inventario - Transferencias exige puede_mover
    const res23 = await makeHttpRequest('/api/inventario/transferencias', tokenEditOnly, 'POST', {
      almacenOrigenId: 1,
      almacenDestinoId: 2,
      lineas: [{ productoId: 1, cantidad: 1 }]
    });
    record(23, 'Inventario: POST /api/inventario/transferencias exige puede_mover (HTTP 403)',
      res23.statusCode === 403,
      `Status: ${res23.statusCode}, Mensaje: ${res23.json?.message}`
    );

    // Escenario 24: Pantallas CONFIG_ no reciben bypass operativo indebido
    const configPageContent = fs.readFileSync('src/app/(dashboard)/inventory/initial/page.tsx', 'utf8');
    record(24, 'Pantallas CONFIG_ operativas protegidas con requiredAction en servidor',
      configPageContent.includes('CONFIG_INVENTARIO_INICIAL') && configPageContent.includes('requiredAction="puede_crear"'),
      `Declarado con requiredAction="puede_crear": ${configPageContent.includes('requiredAction="puede_crear"')}`
    );

    // Escenario 25: SuperAdmin preserva salvaguarda en Seguridad pero no bypass operativo
    const saSeg = await makeHttpRequest('/api/matriz-acceso-rol', superAdminToken, 'GET');
    record(25, 'Modelo B: SuperAdmin preserva salvaguarda en Seguridad (HTTP 200)',
      saSeg.statusCode === 200 && saSeg.headers['x-perm-editar'] === 'true',
      `Matriz status: ${saSeg.statusCode}, x-perm-editar: ${saSeg.headers['x-perm-editar']}`
    );

    console.log('\n' + '='.repeat(80));
    console.log(`RESUMEN FINAL FASE 6.4.14:`);
    console.log(`Total escenarios: ${testResults.length}`);
    console.log(`Exitosos: ${passedCount}`);
    console.log(`Fallidos: ${failedCount}`);
    console.log('='.repeat(80));

    if (failedCount > 0) {
      process.exitCode = 1;
    }

  } finally {
    console.log('\n🧹 Limpiando sesiones, usuarios y roles sintéticos generados...');
    try {
      if (createdSessions.length > 0) {
        await client.query(`DELETE FROM admin.usuario_sesion WHERE sesion_id = ANY($1::int[])`, [createdSessions]);
      }
      if (createdUsers.length > 0) {
        await client.query(`DELETE FROM admin.usuario_auditoria WHERE admin_id = ANY($1::int[]) OR usuario_id = ANY($1::int[])`, [createdUsers]);
        await client.query(`DELETE FROM admin.usuario_actividad WHERE usuario_id = ANY($1::int[])`, [createdUsers]);
        await client.query(`DELETE FROM admin.usuario_alcance WHERE usuario_id = ANY($1::int[])`, [createdUsers]);
        await client.query(`DELETE FROM admin.usuario_rol_adicional WHERE usuario_id = ANY($1::int[])`, [createdUsers]);
        await client.query(`DELETE FROM admin.usuario_seguridad WHERE usuario_id = ANY($1::int[])`, [createdUsers]);
        await client.query(`DELETE FROM admin.usuario_identidad WHERE usuario_id = ANY($1::int[])`, [createdUsers]);
        await client.query(`DELETE FROM admin.usuario WHERE usuario_id = ANY($1::int[])`, [createdUsers]);
      }
      if (createdRoles.length > 0) {
        await client.query(`DELETE FROM admin.matriz_acceso_pantalla WHERE rol_funcional_id = ANY($1::int[])`, [createdRoles]);
        await client.query(`DELETE FROM admin.matriz_acceso_rol WHERE rol_funcional_id = ANY($1::int[])`, [createdRoles]);
        await client.query(`DELETE FROM admin.rol_funcional WHERE rol_funcional_id = ANY($1::int[])`, [createdRoles]);
      }
    } catch (cleanupErr) {
      console.warn('Advertencia durante limpieza de pruebas:', cleanupErr);
    }
    client.release();
    await pool.end();
  }
}

runFase6414Tests().catch((err) => {
  console.error('FATAL ERROR en suite de pruebas 6.4.14:', err);
  process.exit(1);
});
