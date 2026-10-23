/**
 * RIDE LAB — FASE 6.4.8: SUITE DE PRUEBAS DE SEGURIDAD RBAC
 * Blindaje de Privilegios Administrativos y Prevención de Escalamiento RBAC
 * 
 * Cobertura obligatoria: 22 escenarios de seguridad.
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

async function runFase648SecurityTests() {
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
    console.log(`${icon} [Escenario ${num}] ${name}`);
    if (details) console.log(`   Detalle: ${details}`);
    testResults.push({ num, name, status, details });
  }

  async function createSession(userId) {
    const rawToken = 'fase648_' + crypto.randomBytes(24).toString('hex');
    const tokenHash = hashSessionToken(rawToken);
    const res = await client.query(`
      INSERT INTO admin.usuario_sesion (
        usuario_id, token_identificador, dispositivo_navegador, direccion_ip,
        ubicacion, fecha_inicio, ultima_actividad, fecha_expiracion, estado
      ) VALUES (
        $1, $2, 'Fase 6.4.8 Security Test Agent', '127.0.0.1', 'Localhost',
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
  console.log("--- FASE 6.4.8: BLINDAJE DE PRIVILEGIOS ADMINISTRATIVOS Y PREVENCIÓN RBAC ---");
  console.log("======================================================================\n");

  try {
    // 0. Base snapshot check
    const countBeforeRes = await client.query(`SELECT COUNT(*) FROM admin.usuario`);
    const userCountBefore = Number(countBeforeRes.rows[0].count);
    console.log(`[INIT] Conteo inicial de usuarios en bikers_dbtest: ${userCountBefore}`);

    // Ensure company 2 exists for multi-tenant isolation tests
    const comp2Check = await client.query(`SELECT empresa_id FROM admin.empresa WHERE empresa_id = 2`);
    if (comp2Check.rows.length === 0) {
      await client.query(`INSERT INTO admin.empresa (empresa_id, nombre_comercial, razon_social, estado) VALUES (2, 'Empresa Test 2', 'Empresa Test 2 SAS', 'ACTIVO')`);
    }

    // 1. Identificar o crear usuarios sintéticos
    // SuperAdmin (rol_principal_id = 1)
    const superAdminUser = await createSyntheticUser({ companyId: 1, roleId: 1, emailPrefix: 'synth_super' });
    const superToken = await createSession(superAdminUser.userId);

    // Administrador Delegado (rol_principal_id = 2, tiene puede_editar/puede_crear en SEGURIDAD)
    const delegatedAdminUser = await createSyntheticUser({ companyId: 1, roleId: 2, emailPrefix: 'synth_delegated' });
    const delegatedToken = await createSession(delegatedAdminUser.userId);

    // Usuario Ordinario (rol_principal_id = 118 o 4, sin permisos en SEGURIDAD)
    const ordinaryUser = await createSyntheticUser({ companyId: 1, roleId: 118, emailPrefix: 'synth_ordinary' });
    const ordinaryToken = await createSession(ordinaryUser.userId);

    // Usuario Objetivo de prueba (rol_principal_id = 5, Operador)
    const targetUser = await createSyntheticUser({ companyId: 1, roleId: 5, emailPrefix: 'synth_target' });

    // Usuario de Otra Empresa (empresa_id = 2)
    const otherCompanyUser = await createSyntheticUser({ companyId: 2, roleId: 5, emailPrefix: 'synth_othercomp' });

    console.log(`[SETUP] Usuarios sintéticos creados:`);
    console.log(`  - SuperAdmin: ID ${superAdminUser.userId} (Rol 1)`);
    console.log(`  - Admin Delegado: ID ${delegatedAdminUser.userId} (Rol 2)`);
    console.log(`  - Usuario Ordinario: ID ${ordinaryUser.userId} (Rol 118)`);
    console.log(`  - Usuario Objetivo: ID ${targetUser.userId} (Rol 5)`);
    console.log(`  - Usuario Otra Empresa: ID ${otherCompanyUser.userId} (Empresa 2)\n`);

    // ==================================================================
    // ESCENARIO 1: Usuario ordinario intenta asignar rol 1
    // ==================================================================
    const res1 = await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, ordinaryToken, 'PUT', { roleId: 1 });
    const dbCheck1 = await client.query(`SELECT rol_principal_id FROM admin.usuario WHERE usuario_id = $1`, [targetUser.userId]);
    record(1, "Usuario ordinario intenta asignar rol 1",
      res1.statusCode === 403 && dbCheck1.rows[0].rol_principal_id === 5,
      `HTTP ${res1.statusCode} — Rol actual en DB: ${dbCheck1.rows[0].rol_principal_id}`
    );

    // ==================================================================
    // ESCENARIO 2: Administrador delegado intenta asignar rol 1
    // ==================================================================
    const res2 = await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, delegatedToken, 'PUT', { roleId: 1 });
    const dbCheck2 = await client.query(`SELECT rol_principal_id FROM admin.usuario WHERE usuario_id = $1`, [targetUser.userId]);
    record(2, "Administrador delegado intenta asignar rol 1",
      res2.statusCode === 403 && dbCheck2.rows[0].rol_principal_id === 5,
      `HTTP ${res2.statusCode} — Error: ${res2.json?.message || res2.json?.error}`
    );

    // ==================================================================
    // ESCENARIO 3: Administrador delegado intenta crear usuario con rol 1
    // ==================================================================
    const res3 = await makeHttpRequest('/api/usuarios', delegatedToken, 'POST', {
      first_name: "Illegal",
      last_name: "SuperAdmin",
      email: "illegal_super_create@test.com",
      roleId: 1,
      companyId: 1,
      tipo_usuario_id: 3,
      password: "Password123!",
      confirm_password: "Password123!"
    });
    const dbCheck3 = await client.query(`SELECT 1 FROM admin.usuario_identidad WHERE correo_electronico = 'illegal_super_create@test.com'`);
    record(3, "Administrador delegado intenta crear usuario con rol 1",
      res3.statusCode === 403 && dbCheck3.rows.length === 0,
      `HTTP ${res3.statusCode} — Usuario no insertado en DB`
    );

    // ==================================================================
    // ESCENARIO 4: Administrador delegado intenta utilizar roles_additional: [1]
    // ==================================================================
    const res4Post = await makeHttpRequest('/api/usuarios', delegatedToken, 'POST', {
      first_name: "Illegal",
      last_name: "AddRole",
      email: "illegal_add_role@test.com",
      roleId: 2,
      roles_additional: [1],
      companyId: 1,
      tipo_usuario_id: 3,
      password: "Password123!",
      confirm_password: "Password123!"
    });
    const res4Put = await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, delegatedToken, 'PUT', {
      roles_additional: [1]
    });
    const dbCheck4 = await client.query(`SELECT 1 FROM admin.usuario_rol_adicional WHERE usuario_id = $1 AND rol_funcional_id = 1`, [targetUser.userId]);
    record(4, "Administrador delegado intenta utilizar roles_additional: [1]",
      res4Post.statusCode === 403 && res4Put.statusCode === 403 && dbCheck4.rows.length === 0,
      `POST HTTP ${res4Post.statusCode}, PUT HTTP ${res4Put.statusCode} — DB limpio de rol 1 adicional`
    );

    // ==================================================================
    // ESCENARIO 5: Administrador delegado intenta promoverse
    // ==================================================================
    const res5 = await makeHttpRequest(`/api/usuarios/${delegatedAdminUser.userId}`, delegatedToken, 'PUT', { roleId: 1 });
    const dbCheck5 = await client.query(`SELECT rol_principal_id FROM admin.usuario WHERE usuario_id = $1`, [delegatedAdminUser.userId]);
    record(5, "Administrador delegado intenta promoverse a sí mismo",
      res5.statusCode === 403 && dbCheck5.rows[0].rol_principal_id === 2,
      `HTTP ${res5.statusCode} — Rol del admin delegado permanece en ${dbCheck5.rows[0].rol_principal_id}`
    );

    // ==================================================================
    // ESCENARIO 6: Administrador delegado intenta modificar su empresa
    // ==================================================================
    const res6 = await makeHttpRequest(`/api/usuarios/${delegatedAdminUser.userId}`, delegatedToken, 'PUT', { companyId: 2 });
    const dbCheck6 = await client.query(`SELECT empresa_id FROM admin.usuario WHERE usuario_id = $1`, [delegatedAdminUser.userId]);
    record(6, "Administrador delegado intenta modificar su propia empresa",
      res6.statusCode === 403 && dbCheck6.rows[0].empresa_id === 1,
      `HTTP ${res6.statusCode} — Empresa permanece en ${dbCheck6.rows[0].empresa_id}`
    );

    // ==================================================================
    // ESCENARIO 7: Administrador delegado intenta modificar su estado
    // ==================================================================
    const res7 = await makeHttpRequest(`/api/usuarios/${delegatedAdminUser.userId}`, delegatedToken, 'PUT', { status: "INACTIVO" });
    const dbCheck7 = await client.query(`SELECT estado FROM admin.usuario WHERE usuario_id = $1`, [delegatedAdminUser.userId]);
    record(7, "Administrador delegado intenta modificar su propio estado",
      res7.statusCode === 403 && dbCheck7.rows[0].estado === 'ACTIVO',
      `HTTP ${res7.statusCode} — Estado permanece en ${dbCheck7.rows[0].estado}`
    );

    // ==================================================================
    // ESCENARIO 8: Usuario intenta modificar sus propios roles
    // ==================================================================
    const res8 = await makeHttpRequest(`/api/usuarios/${ordinaryUser.userId}`, ordinaryToken, 'PUT', { roleId: 2 });
    const dbCheck8 = await client.query(`SELECT rol_principal_id FROM admin.usuario WHERE usuario_id = $1`, [ordinaryUser.userId]);
    record(8, "Usuario intenta modificar sus propios roles",
      res8.statusCode === 403 && dbCheck8.rows[0].rol_principal_id === 118,
      `HTTP ${res8.statusCode} — Rol permanece en ${dbCheck8.rows[0].rol_principal_id}`
    );

    // ==================================================================
    // ESCENARIO 9: SuperAdmin puede asignar rol 1 a otro usuario
    // ==================================================================
    const res9 = await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, superToken, 'PUT', { roleId: 1 });
    const dbCheck9 = await client.query(`SELECT rol_principal_id FROM admin.usuario WHERE usuario_id = $1`, [targetUser.userId]);
    // Restaurar inmediatamente el rol 5 para las pruebas posteriores
    await client.query(`UPDATE admin.usuario SET rol_principal_id = 5 WHERE usuario_id = $1`, [targetUser.userId]);
    record(9, "SuperAdmin puede asignar rol 1 a otro usuario",
      res9.statusCode === 200 && dbCheck9.rows[0].rol_principal_id === 1,
      `HTTP ${res9.statusCode} — Rol asignado exitosamente a 1`
    );

    // ==================================================================
    // ESCENARIO 10: SuperAdmin puede gestionar roles ordinarios de terceros
    // ==================================================================
    const res10 = await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, superToken, 'PUT', { roleId: 6 });
    const dbCheck10 = await client.query(`SELECT rol_principal_id FROM admin.usuario WHERE usuario_id = $1`, [targetUser.userId]);
    await client.query(`UPDATE admin.usuario SET rol_principal_id = 5 WHERE usuario_id = $1`, [targetUser.userId]);
    record(10, "SuperAdmin puede gestionar roles ordinarios de terceros",
      res10.statusCode === 200 && dbCheck10.rows[0].rol_principal_id === 6,
      `HTTP ${res10.statusCode} — Rol asignado a 6 (Auditor)`
    );

    // ==================================================================
    // ESCENARIO 11: SuperAdmin no puede modificar sus propios campos privilegiados mediante el endpoint ordinario
    // ==================================================================
    const res11Role = await makeHttpRequest(`/api/usuarios/${superAdminUser.userId}`, superToken, 'PUT', { roleId: 2 });
    const res11Status = await makeHttpRequest(`/api/usuarios/${superAdminUser.userId}`, superToken, 'PUT', { status: 'INACTIVO' });
    const res11Company = await makeHttpRequest(`/api/usuarios/${superAdminUser.userId}`, superToken, 'PUT', { companyId: 2 });
    const dbCheck11 = await client.query(`SELECT rol_principal_id, estado, empresa_id FROM admin.usuario WHERE usuario_id = $1`, [superAdminUser.userId]);
    record(11, "SuperAdmin no puede modificar sus propios campos privilegiados mediante endpoint ordinario",
      res11Role.statusCode === 403 && res11Status.statusCode === 403 && res11Company.statusCode === 403 &&
      dbCheck11.rows[0].rol_principal_id === 1 && dbCheck11.rows[0].estado === 'ACTIVO' && dbCheck11.rows[0].empresa_id === 1,
      `Role: HTTP ${res11Role.statusCode}, Status: HTTP ${res11Status.statusCode}, Company: HTTP ${res11Company.statusCode}`
    );

    // ==================================================================
    // ESCENARIO 12: Un usuario puede modificar datos personales permitidos
    // ==================================================================
    const res12 = await makeHttpRequest(`/api/usuarios/${ordinaryUser.userId}`, ordinaryToken, 'PUT', {
      first_name: "NombreActualizado",
      phone: "8095551234",
      idioma_preferido: "es",
      zona_horaria: "America/Santo_Domingo"
    });
    const dbCheck12 = await client.query(`SELECT nombre, telefono FROM admin.usuario_identidad WHERE usuario_id = $1`, [ordinaryUser.userId]);
    record(12, "Un usuario puede modificar datos personales permitidos",
      res12.statusCode === 200 && dbCheck12.rows[0].nombre === 'NombreActualizado' && dbCheck12.rows[0].telefono === '8095551234',
      `HTTP ${res12.statusCode} — Nombre en DB: ${dbCheck12.rows[0].nombre}, Tel: ${dbCheck12.rows[0].telefono}`
    );

    // ==================================================================
    // ESCENARIO 13: Payloads parciales no omiten validaciones
    // ==================================================================
    const res13 = await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, delegatedToken, 'PUT', {
      roleId: 1
    });
    record(13, "Payloads parciales no omiten validaciones",
      res13.statusCode === 403,
      `HTTP ${res13.statusCode} rechazado sin omitir validaciones`
    );

    // ==================================================================
    // ESCENARIO 14: Payloads con campos alternativos no omiten validaciones
    // ==================================================================
    const res14a = await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, delegatedToken, 'PUT', { rol_principal_id: 1 });
    const res14b = await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, delegatedToken, 'PUT', { role_id: 1 });
    const res14c = await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, delegatedToken, 'PUT', { role: "Administrador General" });
    const res14d = await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, delegatedToken, 'PUT', { roles_adicionales: [1] });
    const res14e = await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, delegatedToken, 'PUT', { additional_roles: [1] });
    const allAliasesBlocked = [res14a, res14b, res14c, res14d, res14e].every(r => r.statusCode === 403);
    record(14, "Payloads con campos alternativos no omiten validaciones",
      allAliasesBlocked,
      `rol_principal_id: ${res14a.statusCode}, role_id: ${res14b.statusCode}, role name: ${res14c.statusCode}, roles_adicionales: ${res14d.statusCode}, additional_roles: ${res14e.statusCode}`
    );

    // ==================================================================
    // ESCENARIO 15: Roles inactivos o inválidos no pueden asignarse
    // ==================================================================
    const res15Inactive = await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, superToken, 'PUT', { roleId: 11 }); // Rol 11 'FELIX' es INACTIVO
    const res15Invalid = await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, superToken, 'PUT', { roleId: 99999 }); // Inexistente
    record(15, "Roles inactivos o inexistentes no pueden asignarse indebidamente",
      res15Inactive.statusCode === 400 && res15Invalid.statusCode === 400,
      `Rol inactivo: HTTP ${res15Inactive.statusCode}, Rol inexistente: HTTP ${res15Invalid.statusCode}`
    );

    // ==================================================================
    // ESCENARIO 16: Las operaciones denegadas no realizan cambios parciales
    // ==================================================================
    const targetSnapshotBefore = await client.query(`
      SELECT u.rol_principal_id, ui.nombre
      FROM admin.usuario u
      JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE u.usuario_id = $1
    `, [targetUser.userId]);

    const res16 = await makeHttpRequest(`/api/usuarios/${targetUser.userId}`, delegatedToken, 'PUT', {
      first_name: "IntentoMalicioso",
      roleId: 1
    });

    const targetSnapshotAfter = await client.query(`
      SELECT u.rol_principal_id, ui.nombre
      FROM admin.usuario u
      JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE u.usuario_id = $1
    `, [targetUser.userId]);

    const noPartialChanges = targetSnapshotBefore.rows[0].nombre === targetSnapshotAfter.rows[0].nombre &&
                             targetSnapshotBefore.rows[0].rol_principal_id === targetSnapshotAfter.rows[0].rol_principal_id;
    record(16, "Las operaciones denegadas no realizan cambios parciales",
      res16.statusCode === 403 && noPartialChanges,
      `HTTP ${res16.statusCode} — Nombre antes: "${targetSnapshotBefore.rows[0].nombre}", después: "${targetSnapshotAfter.rows[0].nombre}"`
    );

    // ==================================================================
    // ESCENARIO 17: Los errores de autorización responden HTTP 403
    // ==================================================================
    record(17, "Los errores de autorización responden estrictamente HTTP 403",
      res1.statusCode === 403 && res2.statusCode === 403 && res3.statusCode === 403 && res5.statusCode === 403,
      `Verificado código de estado HTTP 403 FORBIDDEN en todas las violaciones de autorización`
    );

    // ==================================================================
    // ESCENARIO 18: El Administrador General conserva acceso a Seguridad
    // ==================================================================
    const res18Users = await makeHttpRequest('/api/usuarios', superToken, 'GET');
    const res18Matrix = await makeHttpRequest('/api/matriz-acceso-rol', superToken, 'GET');
    record(18, "El Administrador General conserva acceso garantizado a Seguridad (Modelo B)",
      res18Users.statusCode === 200 && res18Matrix.statusCode === 200,
      `GET /api/usuarios: HTTP ${res18Users.statusCode}, GET /api/matriz-acceso-rol: HTTP ${res18Matrix.statusCode}`
    );

    // ==================================================================
    // ESCENARIO 19: Los usuarios ordinarios conservan sus permisos legítimos
    // ==================================================================
    const res19OwnProfile = await makeHttpRequest(`/api/usuarios/${ordinaryUser.userId}`, ordinaryToken, 'GET');
    record(19, "Los usuarios ordinarios conservan consulta legítima a su propio perfil",
      res19OwnProfile.statusCode === 200,
      `GET /api/usuarios/${ordinaryUser.userId}: HTTP ${res19OwnProfile.statusCode}`
    );

    // ==================================================================
    // ESCENARIO 20: El Smart Home Dispatcher continúa funcionando
    // ==================================================================
    const res20SuperHome = await makeHttpRequest('/', superToken, 'GET');
    const res20OrdHome = await makeHttpRequest('/', ordinaryToken, 'GET');
    record(20, "El Smart Home Dispatcher continúa operando sin errores técnicos",
      (res20SuperHome.statusCode === 200 || res20SuperHome.statusCode === 307 || res20SuperHome.statusCode === 308) &&
      (res20OrdHome.statusCode === 200 || res20OrdHome.statusCode === 307 || res20OrdHome.statusCode === 308),
      `SuperAdmin home HTTP ${res20SuperHome.statusCode}, Ordinary home HTTP ${res20OrdHome.statusCode}`
    );

    // ==================================================================
    // ESCENARIO 21: El aislamiento multiempresa se mantiene
    // ==================================================================
    const res21 = await makeHttpRequest(`/api/usuarios/${otherCompanyUser.userId}`, delegatedToken, 'PUT', {
      first_name: "CrossCompanyChange"
    });
    record(21, "El aislamiento multiempresa se mantiene (rechazo de modificación inter-empresa)",
      res21.statusCode === 403,
      `HTTP ${res21.statusCode} — Error: ${res21.json?.message || res21.json?.error}`
    );

    // ==================================================================
    // ESCENARIO 22: No existen regresiones en la administración normal de usuarios
    // ==================================================================
    // SuperAdmin crea un usuario ordinario legítimo, lo actualiza y luego lo elimina
    const legitEmail = `legit_user_${Date.now()}@testbikers.com`;
    const res22Create = await makeHttpRequest('/api/usuarios', superToken, 'POST', {
      first_name: "Usuario",
      last_name: "Legitimo",
      email: legitEmail,
      roleId: 5,
      companyId: 1,
      tipo_usuario_id: 3,
      password: "Password123!",
      confirm_password: "Password123!"
    });
    const createdLegitId = res22Create.json?.usuario_id || res22Create.json?.user_id;

    let res22Update = { statusCode: 0 };
    let res22Delete = { statusCode: 0 };
    if (createdLegitId) {
      createdUsers.push(createdLegitId);
      res22Update = await makeHttpRequest(`/api/usuarios/${createdLegitId}`, superToken, 'PUT', {
        phone: "8095557777"
      });
      res22Delete = await makeHttpRequest(`/api/usuarios/${createdLegitId}`, superToken, 'DELETE');
    }

    record(22, "No existen regresiones en la administración legítima de usuarios",
      res22Create.statusCode === 200 && res22Update.statusCode === 200 && res22Delete.statusCode === 200,
      `Creación HTTP ${res22Create.statusCode}, Actualización HTTP ${res22Update.statusCode}, Eliminación HTTP ${res22Delete.statusCode}`
    );

    // ==================================================================
    // RESUMEN FINAL DE LA SUITE
    // ==================================================================
    console.log("\n======================================================================");
    console.log(`--- RESUMEN FINAL: ${passedCount}/22 ESCENARIOS SUPERADOS (${failedCount} FALLOS) ---`);
    console.log("======================================================================");

    if (failedCount === 0) {
      console.log("🎉 ÉXITO TOTAL: 100% de los vectores de escalamiento blindados satisfactoriamente.\n");
    } else {
      console.error(`⚠️ ATENCIÓN: ${failedCount} escenarios fallaron en la suite de seguridad.\n`);
    }

  } finally {
    // LIMPIEZA RIGUROSA DE REGISTROS SINTÉTICOS DE PRUEBA
    console.log("[CLEANUP] Limpiando sesiones y usuarios sintéticos generados durante la prueba...");
    if (createdSessions.length > 0) {
      await client.query(`DELETE FROM admin.usuario_sesion WHERE sesion_id = ANY($1::int[])`, [createdSessions]);
    }
    for (const uid of createdUsers) {
      try {
        await client.query(`DELETE FROM admin.usuario_alcance_detalle WHERE usuario_alcance_id IN (SELECT usuario_alcance_id FROM admin.usuario_alcance WHERE usuario_id = $1)`, [uid]);
        await client.query(`DELETE FROM admin.usuario_alcance WHERE usuario_id = $1`, [uid]);
        await client.query(`DELETE FROM admin.usuario_rol_adicional WHERE usuario_id = $1`, [uid]);
        await client.query(`DELETE FROM admin.usuario_permiso_personalizado WHERE usuario_id = $1`, [uid]);
        await client.query(`DELETE FROM admin.usuario_sesion WHERE usuario_id = $1`, [uid]);
        await client.query(`DELETE FROM admin.usuario_actividad WHERE usuario_id = $1`, [uid]);
        await client.query(`DELETE FROM admin.usuario_auditoria WHERE usuario_id = $1 OR admin_id = $1`, [uid]);
        await client.query(`DELETE FROM admin.usuario_seguridad WHERE usuario_id = $1`, [uid]);
        await client.query(`DELETE FROM admin.usuario_identidad WHERE usuario_id = $1`, [uid]);
        await client.query(`DELETE FROM admin.usuario WHERE usuario_id = $1`, [uid]);
      } catch (err) {
        console.warn(`Error limpiando usuario ${uid}:`, err.message);
      }
    }

    const countAfterRes = await client.query(`SELECT COUNT(*) FROM admin.usuario`);
    const userCountAfter = Number(countAfterRes.rows[0].count);
    console.log(`[CLEANUP] Conteo final de usuarios en bikers_dbtest: ${userCountAfter}`);

    client.release();
    await pool.end();
  }

  return { passedCount, failedCount, total: testResults.length };
}

runFase648SecurityTests()
  .then(({ passedCount, failedCount }) => {
    process.exit(failedCount === 0 ? 0 : 1);
  })
  .catch((err) => {
    console.error("FATAL ERROR ejecutando suite Fase 6.4.8:", err);
    process.exit(1);
  });
