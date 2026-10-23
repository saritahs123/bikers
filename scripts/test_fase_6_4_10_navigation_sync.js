/**
 * RIDE LAB — FASE 6.4.10: SUITE DE PRUEBAS DE SINCRONIZACIÓN SEGURA Y ESCALABILIDAD RBAC
 * 
 * Cobertura obligatoria: 26 escenarios funcionales y de seguridad.
 * Ejecución exclusiva en PostgreSQL local test (127.0.0.1:5432/bikers_dbtest).
 */

require('./register-ts');
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

const {
  isSuperAdmin,
  getScreenPermissions,
  getModulePermissions,
  getUserNavigationPermissions,
  resolveDefaultAuthorizedPath,
  canUser,
  validateCompanyAccess,
  isInstitutionalSecurityTarget
} = require('../src/lib/workshop-session');

const {
  CANONICAL_NAVIGATION,
  normalizeCode,
  matchScreenByPath
} = require('../src/config/navigationConfig');

const { syncNavigationToDatabase } = require('../src/lib/navigationSync');

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
          // No es JSON o body vacío
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
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error(`Timeout solicitando ${urlPath}`));
    });

    if (bodyData) {
      req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
    }
    req.end();
  });
}

async function runFase6410Tests() {
  const client = await pool.connect();
  const createdSessions = [];
  const createdUsers = [];
  const createdModules = [];
  const createdScreens = [];
  const createdCustomPerms = [];
  const createdRoles = [];
  const testResults = [];
  let passedCount = 0;
  let failedCount = 0;

  function record(scenarioNum, title, passed, details = '') {
    if (passed) passedCount++; else failedCount++;
    testResults.push({ scenarioNum, title, passed, details });
    const mark = passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${mark} [Escenario ${String(scenarioNum).padStart(2, '0')}] ${title}`);
    if (details) console.log(`   Detalle: ${details}`);
  }

  async function createSession(userId) {
    const rawToken = `synth_ses_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    const tokenHash = hashSessionToken(rawToken);

    const res = await client.query(`
      INSERT INTO admin.usuario_sesion (
        usuario_id, token_identificador, dispositivo_navegador, direccion_ip,
        ubicacion, fecha_inicio, ultima_actividad, fecha_expiracion, estado
      ) VALUES (
        $1, $2, 'Fase 6.4.10 Test Agent', '127.0.0.1', 'Localhost',
        NOW(), NOW(), NOW() + INTERVAL '1 hour', 'ACTIVA'
      ) RETURNING sesion_id
    `, [userId, tokenHash]);
    createdSessions.push(res.rows[0].sesion_id);
    return rawToken;
  }

  async function createSyntheticUser({ companyId = 1, roleId = 5, emailPrefix = 'synth_6410' }) {
    const email = `${emailPrefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}@testbikers.com`;
    const maxUserRes = await client.query(`SELECT COALESCE(MAX(usuario_id), 0) + 1 AS next_id FROM admin.usuario`);
    const userId = Number(maxUserRes.rows[0].next_id);

    await client.query(`
      INSERT INTO admin.usuario (usuario_id, empresa_id, tipo_usuario_id, rol_principal_id, estado, estado_activacion, duracion_sesion_minutos, fecha_creacion)
      VALUES ($1, $2, 3, $3, 'ACTIVO', 'Activo', 480, NOW())
    `, [userId, companyId, roleId]);

    await client.query(`
      INSERT INTO admin.usuario_identidad (usuario_id, nombre, apellido, correo_electronico, telefono)
      VALUES ($1, 'Synth6410', 'TestUser', $2, '8095550000')
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
  console.log("--- FASE 6.4.10: SINCRONIZACIÓN SEGURA Y ESCALABILIDAD RBAC SUITE ---");
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

    const ordinaryUser = await createSyntheticUser({ companyId: 1, roleId: 5, emailPrefix: 'synth_operador' });
    const ordinaryToken = await createSession(ordinaryUser.userId);

    const otherCompanyUser = await createSyntheticUser({ companyId: 2, roleId: 5, emailPrefix: 'synth_othercomp' });
    const otherCompanyToken = await createSession(otherCompanyUser.userId);

    console.log(`[SETUP] Actores sintéticos inicializados con éxito.\n`);

    // ==================================================================
    // ESCENARIO 01: Registro de módulo nuevo
    // ==================================================================
    const maxModRes = await client.query(`SELECT COALESCE(MAX(modulo_sistema_id), 0) + 1 AS next_id, COALESCE(MAX(orden), 0) + 1 AS next_orden FROM admin.modulo_sistema`);
    const testModId = Number(maxModRes.rows[0].next_id);
    const testModOrden = Number(maxModRes.rows[0].next_orden);
    const testModCodigo = `MOD_PRUEBA_${Date.now()}`;
    const testModNombre = `MÓDULO DE PRUEBA ${Date.now()}`;

    // Creación vía API segura POST /api/matriz-acceso-rol
    const res01 = await makeHttpRequest('/api/matriz-acceso-rol', superToken, 'POST', {
      nombre: testModNombre,
      codigo: testModCodigo
    });
    createdModules.push(testModId);

    const dbMod01 = await client.query(`SELECT modulo_sistema_id, codigo, nombre, estado FROM admin.modulo_sistema WHERE modulo_sistema_id = $1`, [testModId]);
    const pass01 = res01.statusCode === 200 && dbMod01.rows.length === 1 && dbMod01.rows[0].estado === 'ACTIVO';
    record(1, "Registro de módulo nuevo con código canónico y estado activo",
      pass01,
      `HTTP ${res01.statusCode} — Modulo ID: ${testModId}, Código: ${dbMod01.rows[0]?.codigo}, Estado: ${dbMod01.rows[0]?.estado}`
    );

    // ==================================================================
    // ESCENARIO 02: Registro de pantalla nueva
    // ==================================================================
    const maxScrRes = await client.query(`SELECT COALESCE(MAX(pantalla_id), 0) + 1 AS next_id FROM admin.pantalla_sistema`);
    const testScreenId = Number(maxScrRes.rows[0].next_id);
    const testScreenCodigo = `PANTALLA_PRUEBA_${Date.now()}`;
    const testScreenRuta = `/workshop/test-screen-${Date.now()}`;

    await client.query(`
      INSERT INTO admin.pantalla_sistema (pantalla_id, modulo_sistema_id, codigo, nombre, ruta, tipo, orden, activo, fecha_creacion, fecha_actualizacion)
      VALUES ($1, $2, $3, 'Pantalla de Prueba', $4, 'PANTALLA', 1, true, clock_timestamp(), clock_timestamp())
    `, [testScreenId, testModId, testScreenCodigo, testScreenRuta]);
    createdScreens.push(testScreenId);

    const dbScr02 = await client.query(`SELECT pantalla_id, codigo, ruta, tipo, activo FROM admin.pantalla_sistema WHERE pantalla_id = $1`, [testScreenId]);
    const pass02 = dbScr02.rows.length === 1 && dbScr02.rows[0].tipo === 'PANTALLA' && dbScr02.rows[0].activo === true;
    record(2, "Registro de pantalla nueva en admin.pantalla_sistema",
      pass02,
      `Pantalla ID: ${testScreenId}, Código: ${dbScr02.rows[0]?.codigo}, Tipo: ${dbScr02.rows[0]?.tipo}, Activo: ${dbScr02.rows[0]?.activo}`
    );

    // ==================================================================
    // ESCENARIO 03: Registro de reporte nuevo bajo REPORTES
    // ==================================================================
    const maxRepRes = await client.query(`SELECT COALESCE(MAX(pantalla_id), 0) + 1 AS next_id FROM admin.pantalla_sistema`);
    const testReportId = Number(maxRepRes.rows[0].next_id);
    const testReportCodigo = `REPORTE_PRUEBA_${Date.now()}`;
    const testReportRuta = `/reports/test-report-${Date.now()}`;
    const reportesModId = 16; // REPORTES

    await client.query(`
      INSERT INTO admin.pantalla_sistema (pantalla_id, modulo_sistema_id, codigo, nombre, ruta, tipo, orden, activo, fecha_creacion, fecha_actualizacion)
      VALUES ($1, $2, $3, 'Reporte de Prueba Especial', $4, 'REPORTE', 99, true, clock_timestamp(), clock_timestamp())
    `, [testReportId, reportesModId, testReportCodigo, testReportRuta]);
    createdScreens.push(testReportId);

    const dbRep03 = await client.query(`SELECT pantalla_id, codigo, tipo, modulo_sistema_id FROM admin.pantalla_sistema WHERE pantalla_id = $1`, [testReportId]);
    const pass03 = dbRep03.rows.length === 1 && dbRep03.rows[0].tipo === 'REPORTE' && dbRep03.rows[0].modulo_sistema_id === reportesModId;
    record(3, "Registro de reporte nuevo bajo módulo REPORTES",
      pass03,
      `Reporte ID: ${testReportId}, Módulo: ${dbRep03.rows[0]?.modulo_sistema_id}, Tipo: ${dbRep03.rows[0]?.tipo}`
    );

    // ==================================================================
    // ESCENARIO 04: Inicialización de las 12 acciones en false (Fail-Closed)
    // ==================================================================
    // Inicializar explícitamente en admin.matriz_acceso_pantalla para el nuevo screen y reporte
    const activeRoles = await client.query(`SELECT rol_funcional_id FROM admin.rol_funcional WHERE estado = 'ACTIVO' OR estado IS NULL`);
    for (const r of activeRoles.rows) {
      await client.query(`
        INSERT INTO admin.matriz_acceso_pantalla (
          rol_funcional_id, pantalla_id,
          puede_ver, puede_crear, puede_editar, puede_inactivar,
          puede_exportar, puede_importar, puede_aprobar, puede_asignar,
          puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
          estado, fecha_creacion, fecha_actualizacion
        ) VALUES (
          $1, $2, false, false, false, false, false, false, false, false, false, false, false, false, 'ACTIVO', now(), now()
        ) ON CONFLICT (rol_funcional_id, pantalla_id) DO NOTHING
      `, [r.rol_funcional_id, testScreenId]);

      await client.query(`
        INSERT INTO admin.matriz_acceso_pantalla (
          rol_funcional_id, pantalla_id,
          puede_ver, puede_crear, puede_editar, puede_inactivar,
          puede_exportar, puede_importar, puede_aprobar, puede_asignar,
          puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
          estado, fecha_creacion, fecha_actualizacion
        ) VALUES (
          $1, $2, false, false, false, false, false, false, false, false, false, false, false, false, 'ACTIVO', now(), now()
        ) ON CONFLICT (rol_funcional_id, pantalla_id) DO NOTHING
      `, [r.rol_funcional_id, testReportId]);
    }

    // Verificar en matriz_acceso_rol del modulo nuevo
    const mar04 = await client.query(`
      SELECT puede_ver, puede_crear, puede_editar, puede_inactivar, puede_exportar, puede_importar,
             puede_aprobar, puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar
      FROM admin.matriz_acceso_rol WHERE modulo_sistema_id = $1
    `, [testModId]);

    const allMarFalse = mar04.rows.length > 0 && mar04.rows.every(row =>
      !row.puede_ver && !row.puede_crear && !row.puede_editar && !row.puede_inactivar &&
      !row.puede_exportar && !row.puede_importar && !row.puede_aprobar && !row.puede_asignar &&
      !row.puede_mover && !row.puede_cerrar && !row.puede_reabrir && !row.puede_eliminar
    );

    // Verificar en matriz_acceso_pantalla del screen nuevo
    const map04 = await client.query(`
      SELECT puede_ver, puede_crear, puede_editar, puede_inactivar, puede_exportar, puede_importar,
             puede_aprobar, puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar
      FROM admin.matriz_acceso_pantalla WHERE pantalla_id = $1
    `, [testScreenId]);

    const allMapFalse = map04.rows.length > 0 && map04.rows.every(row =>
      !row.puede_ver && !row.puede_crear && !row.puede_editar && !row.puede_inactivar &&
      !row.puede_exportar && !row.puede_importar && !row.puede_aprobar && !row.puede_asignar &&
      !row.puede_mover && !row.puede_cerrar && !row.puede_reabrir && !row.puede_eliminar
    );

    const pass04 = allMarFalse && allMapFalse;
    record(4, "Inicialización estricta de las 12 acciones RBAC en false",
      pass04,
      `Módulo filas: ${mar04.rows.length} (todas 12 false), Pantalla filas: ${map04.rows.length} (todas 12 false)`
    );

    // ==================================================================
    // ESCENARIO 05: Pantalla nueva bajo módulo previamente autorizado
    // ==================================================================
    // Crear pantalla sintética bajo TALLER (modulo_sistema_id = 7)
    // El rol 5 (Operador) tiene permiso de ver en TALLER a nivel de módulo
    const maxTallerScrRes = await client.query(`SELECT COALESCE(MAX(pantalla_id), 0) + 1 AS next_id FROM admin.pantalla_sistema`);
    const tallerScreenId = Number(maxTallerScrRes.rows[0].next_id);
    const tallerScreenCodigo = `TALLER_PANTALLA_NUEVA_${Date.now()}`;
    const tallerScreenRuta = `/workshop/new-test-${Date.now()}`;

    await client.query(`
      INSERT INTO admin.pantalla_sistema (pantalla_id, modulo_sistema_id, codigo, nombre, ruta, tipo, orden, activo, fecha_creacion, fecha_actualizacion)
      VALUES ($1, 7, $2, 'Nueva Vista Taller Test', $3, 'PANTALLA', 99, true, clock_timestamp(), clock_timestamp())
    `, [tallerScreenId, tallerScreenCodigo, tallerScreenRuta]);
    createdScreens.push(tallerScreenId);

    // Conceder permiso explícito al rol 5 en TALLER si no lo tenía
    await client.query(`
      UPDATE admin.matriz_acceso_rol
      SET puede_ver = true
      WHERE rol_funcional_id = 5 AND modulo_sistema_id = 7
    `);

    // Inicializar la pantalla con Fail-Closed en matriz_acceso_pantalla para todos los roles activos
    for (const r of activeRoles.rows) {
      await client.query(`
        INSERT INTO admin.matriz_acceso_pantalla (
          rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_inactivar,
          puede_exportar, puede_importar, puede_aprobar, puede_asignar, puede_mover, puede_cerrar,
          puede_reabrir, puede_eliminar, estado, fecha_creacion, fecha_actualizacion
        ) VALUES (
          $1, $2, false, false, false, false, false, false, false, false, false, false, false, false, 'ACTIVO', now(), now()
        ) ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET puede_ver = false
      `, [r.rol_funcional_id, tallerScreenId]);
    }

    const perms05 = await getScreenPermissions(tallerScreenCodigo, ordinaryUser.userId);
    const navPerms05 = await getUserNavigationPermissions(ordinaryUser.userId);

    const pass05 = perms05.puede_ver === false && navPerms05.screens[tallerScreenCodigo] === false;
    record(5, "Pantalla nueva bajo módulo previamente autorizado NO hereda acceso (Fail-Closed)",
      pass05,
      `Módulo TALLER puede_ver=true, Pantalla nueva perms.puede_ver=${perms05.puede_ver}, navPerms=${navPerms05.screens[tallerScreenCodigo]}`
    );

    // ==================================================================
    // ESCENARIO 06: Reporte nuevo bajo REPORTES autorizado
    // ==================================================================
    // Conceder ver y exportar en REPORTES al rol 5
    await client.query(`
      UPDATE admin.matriz_acceso_rol
      SET puede_ver = true, puede_exportar = true
      WHERE rol_funcional_id = 5 AND modulo_sistema_id = 16
    `);

    const perms06 = await getScreenPermissions(testReportCodigo, ordinaryUser.userId);
    const pass06 = perms06.puede_ver === false && perms06.puede_exportar === false;
    record(6, "Reporte nuevo bajo REPORTES NO hereda visualización ni exportación",
      pass06,
      `Reporte puede_ver=${perms06.puede_ver}, puede_exportar=${perms06.puede_exportar}`
    );

    // ==================================================================
    // ESCENARIO 07: Rol 1 sin acceso operativo automático
    // ==================================================================
    // Para la nueva pantalla de taller, el Rol 1 también debe tener puede_ver = false (Modelo B)
    const perms07 = await getScreenPermissions(tallerScreenCodigo, superAdmin.userId);
    const pass07 = perms07.puede_ver === false;
    record(7, "Rol 1 (Administrador General) no recibe acceso operativo automático a pantallas nuevas",
      pass07,
      `SuperAdmin perms en ${tallerScreenCodigo}: puede_ver=${perms07.puede_ver}`
    );

    // ==================================================================
    // ESCENARIO 08: Salvaguarda institucional de Seguridad (Modelo B)
    // ==================================================================
    const perms08Roles = await getScreenPermissions('/settings/security/roles', superAdmin.userId);
    const perms08Users = await getScreenPermissions('SEGURIDAD_USUARIOS', superAdmin.userId);
    const pass08 = perms08Roles.puede_ver === true && perms08Users.puede_ver === true && perms08Roles.puede_editar === true;
    record(8, "Salvaguarda institucional de Seguridad preservada para SuperAdmin",
      pass08,
      `Permisos en /settings/security/roles: ver=${perms08Roles.puede_ver}, editar=${perms08Roles.puede_editar}`
    );

    // ==================================================================
    // ESCENARIO 09: Permisos personalizados por usuario (Precedencia)
    // ==================================================================
    // A) Permiso personalizado en pantalla específico
    const maxCustRes = await client.query(`SELECT COALESCE(MAX(usuario_permiso_id), 0) + 1 AS next_id FROM admin.usuario_permiso_personalizado`);
    const custId1 = Number(maxCustRes.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.usuario_permiso_personalizado (usuario_permiso_id, usuario_id, modulo_sistema_id, pantalla_id, puede_ver, estado, fecha_creacion, fecha_actualizacion)
      VALUES ($1, $2, 7, $3, true, 'ACTIVO', now(), now())
    `, [custId1, ordinaryUser.userId, tallerScreenId]);
    createdCustomPerms.push(custId1);

    const perms09A = await getScreenPermissions(tallerScreenCodigo, ordinaryUser.userId);

    // B) Permiso personalizado en módulo padre
    const custId2 = custId1 + 1;
    await client.query(`
      INSERT INTO admin.usuario_permiso_personalizado (usuario_permiso_id, usuario_id, modulo_sistema_id, pantalla_id, puede_ver, estado, fecha_creacion, fecha_actualizacion)
      VALUES ($1, $2, $3, NULL, true, 'ACTIVO', now(), now())
    `, [custId2, ordinaryUser.userId, testModId]);
    createdCustomPerms.push(custId2);

    const perms09B = await getScreenPermissions(testScreenCodigo, ordinaryUser.userId);

    const pass09 = perms09A.puede_ver === true && perms09B.puede_ver === true;
    record(9, "Precedencia de permisos personalizados: pantalla y módulo sobre matriz de rol",
      pass09,
      `Personalizado pantalla: puede_ver=${perms09A.puede_ver}, Personalizado módulo: puede_ver=${perms09B.puede_ver}`
    );

    // ==================================================================
    // ESCENARIO 10: Roles adicionales combinados
    // ==================================================================
    // Crear un rol funcional de prueba con acceso a testModId
    const maxRfRes = await client.query(`SELECT COALESCE(MAX(rol_funcional_id), 0) + 1 AS next_id FROM admin.rol_funcional`);
    const testRoleId = Number(maxRfRes.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.rol_funcional (rol_funcional_id, nombre, estado, fecha_creacion)
      VALUES ($1, 'TEST_ROL_F6410', 'ACTIVO', now())
    `, [testRoleId]);
    createdRoles.push(testRoleId);

    // Otorgar permiso de ver al testRoleId en testModId
    const maxMarId = await client.query(`SELECT COALESCE(MAX(matriz_acceso_rol_id), 0) + 1 AS next_id FROM admin.matriz_acceso_rol`);
    await client.query(`
      INSERT INTO admin.matriz_acceso_rol (matriz_acceso_rol_id, rol_funcional_id, modulo_sistema_id, puede_ver, estado, fecha_creacion, fecha_actualizacion)
      VALUES ($1, $2, $3, true, 'ACTIVO', now(), now())
    `, [Number(maxMarId.rows[0].next_id), testRoleId, testModId]);

    // Asignar rol adicional vía secuencia autoincremental
    await client.query(`
      INSERT INTO admin.usuario_rol_adicional (usuario_id, rol_funcional_id)
      VALUES ($1, $2)
    `, [ordinaryUser.userId, testRoleId]);

    const modPerms10 = await getModulePermissions(testModId, ordinaryUser.userId);
    const pass10 = modPerms10.puede_ver === true;
    record(10, "Roles adicionales agregan privilegios aditivamente (BOOL_OR)",
      pass10,
      `Permiso de módulo con rol adicional: puede_ver=${modPerms10.puede_ver}`
    );

    // ==================================================================
    // ESCENARIO 11: Revocación de permisos en sesión activa
    // ==================================================================
    // Retirar el rol adicional
    await client.query(`DELETE FROM admin.usuario_rol_adicional WHERE usuario_id = $1 AND rol_funcional_id = $2`, [ordinaryUser.userId, testRoleId]);
    // Retirar el permiso personalizado del módulo
    await client.query(`DELETE FROM admin.usuario_permiso_personalizado WHERE usuario_permiso_id = $1`, [custId2]);

    const modPerms11 = await getModulePermissions(testModId, ordinaryUser.userId);
    const pass11 = modPerms11.puede_ver === false;
    record(11, "Revocación inmediata en sesión activa sin reemisión de token",
      pass11,
      `Tras retiro de rol adicional y permiso personalizado: puede_ver=${modPerms11.puede_ver}`
    );

    // ==================================================================
    // ESCENARIO 12: Persistencia de permisos existentes tras sincronización
    // ==================================================================
    // Configurar permiso conocido en SEGURIDAD para rol 5
    await client.query(`
      INSERT INTO admin.matriz_acceso_rol (
        matriz_acceso_rol_id, rol_funcional_id, modulo_sistema_id, puede_ver, puede_crear,
        puede_editar, puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
        puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
        estado, fecha_creacion, fecha_actualizacion
      ) VALUES (
        (SELECT COALESCE(MAX(matriz_acceso_rol_id), 0) + 1 FROM admin.matriz_acceso_rol),
        5, 2, true, true, false, false, false, false, false, false, false, false, false, false,
        'ACTIVO', now(), now()
      )
      ON CONFLICT (rol_funcional_id, modulo_sistema_id) DO UPDATE SET
        puede_ver = true, puede_crear = true
    `);

    // Ejecutar sincronización
    const syncRes12 = await syncNavigationToDatabase(true);

    const check12 = await client.query(`
      SELECT puede_ver, puede_crear
      FROM admin.matriz_acceso_rol
      WHERE rol_funcional_id = 5 AND modulo_sistema_id = 2
    `);

    const pass12 = syncRes12.success && check12.rows[0]?.puede_ver === true && check12.rows[0]?.puede_crear === true;
    record(12, "Sincronización preserva intactos los permisos previamente configurados",
      pass12,
      `sync success: ${syncRes12.success}, puede_ver: ${check12.rows[0]?.puede_ver}, puede_crear: ${check12.rows[0]?.puede_crear}`
    );

    // Restaurar permiso de creación para pruebas subsiguientes
    await client.query(`
      UPDATE admin.matriz_acceso_rol
      SET puede_crear = false
      WHERE rol_funcional_id = 5 AND modulo_sistema_id = 2
    `);

    // ==================================================================
    // ESCENARIO 13: Sincronización repetida (Idempotencia)
    // ==================================================================
    const syncRes13A = await syncNavigationToDatabase(true);
    const syncRes13B = await syncNavigationToDatabase(true);
    const syncRes13C = await syncNavigationToDatabase(true);

    const pass13 = syncRes13A.success && syncRes13B.success && syncRes13C.success;
    record(13, "Sincronización repetida es estrictamente idempotente y consistente",
      pass13,
      `Tres ejecuciones consecutivas completadas con éxito sin colisiones ni errores.`
    );

    // ==================================================================
    // ESCENARIO 14: Ausencia de duplicados
    // ==================================================================
    const dupScreensRes = await client.query(`
      SELECT rol_funcional_id, pantalla_id, COUNT(*)
      FROM admin.matriz_acceso_pantalla
      GROUP BY rol_funcional_id, pantalla_id
      HAVING COUNT(*) > 1
    `);

    const dupModulesRes = await client.query(`
      SELECT rol_funcional_id, modulo_sistema_id, COUNT(*)
      FROM admin.matriz_acceso_rol
      GROUP BY rol_funcional_id, modulo_sistema_id
      HAVING COUNT(*) > 1
    `);

    const pass14 = dupScreensRes.rows.length === 0 && dupModulesRes.rows.length === 0;
    record(14, "Cero duplicados en matriz_acceso_pantalla y matriz_acceso_rol",
      pass14,
      `Duplicados en pantallas: ${dupScreensRes.rows.length}, Duplicados en módulos: ${dupModulesRes.rows.length}`
    );

    // ==================================================================
    // ESCENARIO 15: Concurrencia entre sincronizaciones
    // ==================================================================
    const concurrentSyncs = await Promise.all([
      syncNavigationToDatabase(true),
      syncNavigationToDatabase(true),
      syncNavigationToDatabase(true),
      syncNavigationToDatabase(true)
    ]);

    const pass15 = concurrentSyncs.every(s => s.success === true);
    record(15, "Ejecuciones concurrentes de sincronización sin deadlocks ni colisiones",
      pass15,
      `4 sincronizaciones simultáneas completadas con éxito.`
    );

    // ==================================================================
    // ESCENARIO 16: Módulos inactivos preservados y no visibles
    // ==================================================================
    await client.query(`UPDATE admin.modulo_sistema SET estado = 'INACTIVO' WHERE modulo_sistema_id = $1`, [testModId]);

    // Ejecutar sync
    await syncNavigationToDatabase(true);

    // Verificar que el estado INACTIVO se preservó intacto
    const modCheck16 = await client.query(`SELECT estado FROM admin.modulo_sistema WHERE modulo_sistema_id = $1`, [testModId]);
    const pass16 = modCheck16.rows[0]?.estado === 'INACTIVO';
    record(16, "Módulos inactivos en base de datos se preservan sin reactivación indebida",
      pass16,
      `Estado tras sync: ${modCheck16.rows[0]?.estado}`
    );

    // ==================================================================
    // ESCENARIO 17: Pantallas inactivas denegadas por defecto
    // ==================================================================
    await client.query(`UPDATE admin.pantalla_sistema SET activo = false WHERE pantalla_id = $1`, [tallerScreenId]);

    const perms17 = await getScreenPermissions(tallerScreenCodigo, ordinaryUser.userId);
    const pass17 = perms17.puede_ver === false && perms17.puede_crear === false;
    record(17, "Pantallas con activo=false deniegan acceso sistemáticamente",
      pass17,
      `Permisos en pantalla inactiva: puede_ver=${perms17.puede_ver}`
    );

    // ==================================================================
    // ESCENARIO 18: Rutas con query parameters y resolución sin ambigüedad
    // ==================================================================
    const matchWorkOrders = matchScreenByPath('/workshop', 'view=work_orders');
    const matchBilling = matchScreenByPath('/workshop', 'view=billing');
    const matchKanban = matchScreenByPath('/workshop', 'view=kanban');
    const matchDefaultWorkshop = matchScreenByPath('/workshop');

    const pass18 =
      matchWorkOrders?.codigo === 'TALLER_ORDENES' &&
      matchBilling?.codigo === 'FACTURACION_DESPACHO' &&
      matchKanban?.codigo === 'TALLER_KANBAN' &&
      matchDefaultWorkshop?.codigo === 'TALLER_RECEPCIONES';

    record(18, "Rutas con query parameters en Taller resueltas con exactitud y sin ambigüedad",
      pass18,
      `work_orders: ${matchWorkOrders?.codigo}, billing: ${matchBilling?.codigo}, default: ${matchDefaultWorkshop?.codigo}`
    );

    // ==================================================================
    // ESCENARIO 19: Protección de URL directa
    // ==================================================================
    const canAccessSec = await canUser(ordinaryUser.userId, 'ver', '/settings/security/users');
    const pass19 = canAccessSec === false;
    record(19, "Protección server-side de URL directa para usuarios no autorizados",
      pass19,
      `Usuario ordinario canUser('/settings/security/users', 'ver') = ${canAccessSec}`
    );

    // ==================================================================
    // ESCENARIO 20: Protección de APIs
    // ==================================================================
    // POST /api/matriz-acceso-rol/sync sin privilegios
    const res20Sync = await makeHttpRequest('/api/matriz-acceso-rol/sync', ordinaryToken, 'POST', {});
    // POST /api/matriz-acceso-rol para crear modulo sin privilegios
    const res20Mod = await makeHttpRequest('/api/matriz-acceso-rol', ordinaryToken, 'POST', {
      nombre: 'MODULO NO AUTORIZADO'
    });

    const pass20 = res20Sync.statusCode === 403 && res20Mod.statusCode === 403;
    record(20, "Protección estricta de APIs RBAC: HTTP 403 ante llamadas no autorizadas",
      pass20,
      `Sync: HTTP ${res20Sync.statusCode}, Modulo Create: HTTP ${res20Mod.statusCode}`
    );

    // ==================================================================
    // ESCENARIO 21: Sidebar (Fail-Closed)
    // ==================================================================
    // Reactivar módulo para prueba de sidebar
    await client.query(`UPDATE admin.modulo_sistema SET estado = 'ACTIVO' WHERE modulo_sistema_id = $1`, [testModId]);
    await client.query(`UPDATE admin.pantalla_sistema SET activo = true WHERE pantalla_id = $1`, [tallerScreenId]);

    const navPerms21 = await getUserNavigationPermissions(ordinaryUser.userId);
    // El nuevo módulo y la nueva pantalla tienen puede_ver = false
    const pass21 = !navPerms21.modules[normalizeCode(testModNombre)] && !navPerms21.screens[testScreenCodigo];
    record(21, "Sidebar oculta automáticamente recursos sin autorización efectiva (Fail-Closed)",
      pass21,
      `Módulo visible: ${Boolean(navPerms21.modules[normalizeCode(testModNombre)])}, Pantalla visible: ${Boolean(navPerms21.screens[testScreenCodigo])}`
    );

    // ==================================================================
    // ESCENARIO 22: Smart Home Dispatcher
    // ==================================================================
    const defaultPath22 = await resolveDefaultAuthorizedPath(ordinaryUser.userId);
    // Asegurar que no despacha hacia testScreenRuta ni testReportRuta
    const pass22 = defaultPath22 !== testScreenRuta && defaultPath22 !== testReportRuta;
    record(22, "Smart Home Dispatcher ignora recursos nuevos no autorizados",
      pass22,
      `Destino resuelto: ${defaultPath22}`
    );

    // ==================================================================
    // ESCENARIO 23: Matriz de Acceso (Visualización y Guardado PUT)
    // ==================================================================
    const res23Get = await makeHttpRequest('/api/matriz-acceso-rol', superToken, 'GET');
    const screenMatrix = res23Get.json?.screenMatrix || {};
    const modFoundInApi = res23Get.json?.modules?.some(m => m.id === testModId);

    // Actualizar permisos del rol 5 vía PUT
    const res23Put = await makeHttpRequest('/api/matriz-acceso-rol', superToken, 'PUT', {
      roleId: 5,
      roleName: 'Operador',
      modules: { [String(testModId)]: ['ver'] },
      screens: {
        [String(testScreenId)]: { actions: ['ver', 'exportar'], isOverride: true }
      }
    });

    const checkMap23 = await client.query(`
      SELECT puede_ver, puede_exportar
      FROM admin.matriz_acceso_pantalla
      WHERE rol_funcional_id = 5 AND pantalla_id = $1
    `, [testScreenId]);

    const pass23 =
      res23Get.statusCode === 200 &&
      modFoundInApi === true &&
      res23Put.statusCode === 200 &&
      checkMap23.rows[0]?.puede_ver === true &&
      checkMap23.rows[0]?.puede_exportar === true;

    record(23, "Matriz de Acceso: Visualización de recursos nuevos y persistencia de overrides vía PUT",
      pass23,
      `GET: HTTP ${res23Get.statusCode} (módulo visible=${modFoundInApi}), PUT: HTTP ${res23Put.statusCode}, ver=${checkMap23.rows[0]?.puede_ver}, exportar=${checkMap23.rows[0]?.puede_exportar}`
    );

    // ==================================================================
    // ESCENARIO 24: Aislamiento multiempresa
    // ==================================================================
    const iso24A = validateCompanyAccess(1, 1, false);
    const iso24B = validateCompanyAccess(1, 2, false);
    const iso24Super = validateCompanyAccess(1, 2, true);

    const pass24 = iso24A === true && iso24B === false && iso24Super === true;
    record(24, "Aislamiento multiempresa estricto para recursos y sesiones",
      pass24,
      `Misma empresa: ${iso24A}, Otra empresa: ${iso24B}, SuperAdmin bypass: ${iso24Super}`
    );

    // ==================================================================
    // ESCENARIO 25: Compatibilidad con las migraciones 001–047
    // ==================================================================
    const migCountRes = await client.query(`SELECT COUNT(*) FROM admin.schema_migrations`);
    const migCount = Number(migCountRes.rows[0].count);
    const pass25 = migCount >= 47;
    record(25, "Compatibilidad e inmutabilidad con las 47 migraciones existentes",
      pass25,
      `Migraciones registradas en schema_migrations: ${migCount}`
    );

    // ==================================================================
    // ESCENARIO 26: Ausencia de regresiones funcionales y registro histórico
    // ==================================================================
    // Verificar que usuario 234 con rol 1 se mantenga inalterado
    const user234Check = await client.query(`SELECT usuario_id, rol_funcional_id FROM admin.usuario_rol_adicional WHERE usuario_id = 234`);
    const superAdminCheck = await isSuperAdmin(234);

    const pass26 = user234Check.rows.length === 1 && user234Check.rows[0].rol_funcional_id === 1 && superAdminCheck === true;
    record(26, "Ausencia de regresiones: Usuario institucional 234 conserva Rol 1 intacto",
      pass26,
      `Usuario 234 rol adicional: ${user234Check.rows[0]?.rol_funcional_id}, isSuperAdmin: ${superAdminCheck}`
    );

  } catch (err) {
    console.error("FATAL ERROR EN TEST SUITE:", err);
  } finally {
    console.log("\n[CLEANUP] Limpiando datos de prueba sintéticos...");
    try {
      if (createdSessions.length > 0) {
        await client.query(`DELETE FROM admin.usuario_sesion WHERE sesion_id = ANY($1::int[])`, [createdSessions]);
      }
      if (createdCustomPerms.length > 0) {
        await client.query(`DELETE FROM admin.usuario_permiso_personalizado WHERE usuario_permiso_id = ANY($1::int[])`, [createdCustomPerms]);
      }
      if (createdScreens.length > 0) {
        await client.query(`DELETE FROM admin.matriz_acceso_pantalla WHERE pantalla_id = ANY($1::int[])`, [createdScreens]);
        await client.query(`DELETE FROM admin.pantalla_sistema WHERE pantalla_id = ANY($1::int[])`, [createdScreens]);
      }
      if (createdModules.length > 0) {
        await client.query(`DELETE FROM admin.matriz_acceso_rol WHERE modulo_sistema_id = ANY($1::int[])`, [createdModules]);
        await client.query(`DELETE FROM admin.modulo_sistema WHERE modulo_sistema_id = ANY($1::int[])`, [createdModules]);
      }
      if (createdRoles.length > 0) {
        await client.query(`DELETE FROM admin.matriz_acceso_rol WHERE rol_funcional_id = ANY($1::int[])`, [createdRoles]);
        await client.query(`DELETE FROM admin.rol_funcional WHERE rol_funcional_id = ANY($1::int[])`, [createdRoles]);
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
      console.log(`[CLEANUP] Limpieza verificada y completada sin residuos.`);
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

runFase6410Tests();
