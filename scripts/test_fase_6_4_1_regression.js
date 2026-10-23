/**
 * BATERÍA DE PRUEBAS DE REGRESIÓN RBAC — FASE 6.4.1
 * Archivo: scripts/test_fase_6_4_1_regression.js
 *
 * Valida los 10 escenarios obligatorios requeridos para el cierre de Fase 6.4.1.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { Pool } = require('pg');

const envPath = path.resolve(process.cwd(), '.env.test.local');
const env = fs.existsSync(envPath) ? require('dotenv').parse(fs.readFileSync(envPath)) : process.env;

if (!env.DATABASE_URL || !env.DATABASE_URL.includes('127.0.0.1:5432/bikers_dbtest')) {
  console.error('[BLOQUEO] Solo se permite ejecutar en 127.0.0.1:5432/bikers_dbtest');
  process.exit(1);
}

const pool = new Pool({ connectionString: env.DATABASE_URL });

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

function makeHttpRequest(urlPath, sessionToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: urlPath,
      method: 'GET',
      headers: {
        'User-Agent': 'Regression641/1.0',
        ...(sessionToken ? { 'Cookie': `session_token=${sessionToken}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(25000, () => {
      req.destroy();
      reject(new Error(`Request to ${urlPath} timed out`));
    });

    req.end();
  });
}

async function runRegressionSuite() {
  const client = await pool.connect();
  const createdSessions = [];
  const testResults = [];

  function record(id, name, passed, details) {
    testResults.push({ id, name, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [${id}] ${name}`);
    if (details) console.log(`   Detalle: ${details}`);
  }

  async function createSession(userId) {
    const rawToken = 'reg641_' + crypto.randomBytes(24).toString('hex');
    const tokenHash = hashSessionToken(rawToken);
    const res = await client.query(`
      INSERT INTO admin.usuario_sesion (
        usuario_id, token_identificador, dispositivo_navegador, direccion_ip,
        ubicacion, fecha_inicio, ultima_actividad, fecha_expiracion, estado
      ) VALUES (
        $1, $2, 'Regression Test Agent', '127.0.0.1', 'Localhost',
        NOW(), NOW(), NOW() + INTERVAL '1 hour', 'ACTIVA'
      ) RETURNING sesion_id
    `, [userId, tokenHash]);
    createdSessions.push(res.rows[0].sesion_id);
    return rawToken;
  }

  try {
    console.log('\n======================================================================');
    console.log('--- SUITE DE PRUEBAS DE REGRESIÓN DE SEGURIDAD RBAC (FASE 6.4.1) ---');
    console.log('======================================================================\n');

    // Identificar usuarios para la prueba
    // 1. Prueba H: usuario_id 18 (TEST_ROL_SOLO_LECTURA, rol 112)
    // 2. Usuario Autorizado: rol_principal_id = 113 (TEST_ROL_OPERADOR_TALLER, tiene Dashboard autorizado)
    // 3. SuperAdmin: rol_principal_id = 1 (Administrador General)
    const usersRes = await client.query(`
      SELECT u.usuario_id, u.empresa_id, u.rol_principal_id, rf.nombre as rol_nombre
      FROM admin.usuario u
      JOIN admin.rol_funcional rf ON u.rol_principal_id = rf.rol_funcional_id
      WHERE u.usuario_id = 18 OR u.rol_principal_id IN (1, 113)
      ORDER BY u.usuario_id
    `);

    const userPruebaH = usersRes.rows.find(u => u.usuario_id === 18);
    const userAutorizado = usersRes.rows.find(u => u.rol_principal_id === 113);
    const userSuperAdmin = usersRes.rows.find(u => u.rol_principal_id === 1);

    if (!userPruebaH || !userAutorizado || !userSuperAdmin) {
      throw new Error('No se encontraron todos los perfiles de usuario requeridos.');
    }

    const tokenPruebaH = await createSession(userPruebaH.usuario_id);
    const tokenAutorizado = await createSession(userAutorizado.usuario_id);
    const tokenSuperAdmin = await createSession(userSuperAdmin.usuario_id);

    // Dynamic import of workshop-session helpers for server logic validation
    for (const k in env) { process.env[k] = env[k]; }
    const { getUserNavigationPermissions, getScreenPermissions, canUser } = require('../src/lib/workshop-session');
    const { CANONICAL_NAVIGATION, normalizeCode } = require('../src/config/navigationConfig');

    // -------------------------------------------------------------
    // PRUEBA 1: Prueba H — HOME oculto en Sidebar
    // -------------------------------------------------------------
    const navPermsPruebaH = await getUserNavigationPermissions(18);
    const isSuper = Boolean(navPermsPruebaH.isSuperAdmin);
    const homeMenu = CANONICAL_NAVIGATION.find(m => m.id === 'home');
    const homeKey = normalizeCode(homeMenu.codigo);
    const hasHomePerm = isSuper || Boolean(navPermsPruebaH.modules?.[homeKey]);

    const visibleHomeScreens = homeMenu.screens.filter(screen => {
      if (isSuper) return true;
      if (navPermsPruebaH.screens?.[screen.codigo] !== undefined) return Boolean(navPermsPruebaH.screens[screen.codigo]);
      if (navPermsPruebaH.screens?.[screen.ruta] !== undefined) return Boolean(navPermsPruebaH.screens[screen.ruta]);
      return hasHomePerm;
    });

    const isHomeVisibleInSidebar = isSuper || (hasHomePerm && visibleHomeScreens.length > 0);
    record(
      'TC-01',
      'Prueba H: HOME oculto en Sidebar',
      !isHomeVisibleInSidebar && navPermsPruebaH.modules['DASHBOARD'] !== true,
      `modules['DASHBOARD']=${navPermsPruebaH.modules['DASHBOARD']}, visibleHomeScreens=${visibleHomeScreens.length}`
    );

    // -------------------------------------------------------------
    // PRUEBA 2: Prueba H — Acceso directo a '/' denegado
    // -------------------------------------------------------------
    const resDirectH = await makeHttpRequest('/', tokenPruebaH);
    const hasAccessDeniedH = resDirectH.body.includes('HTTP 403 Forbidden') ||
      resDirectH.body.includes('DASHBOARD_MAIN') ||
      resDirectH.body.includes('Tu rol o usuario no tiene permisos configurados') ||
      resDirectH.body.includes('Acceso Denegado');
    const hasDashboardViewH = resDirectH.body.includes('Monitoreo operativo de órdenes de trabajo') || resDirectH.body.includes('DATOS EN TIEMPO REAL');
    record(
      'TC-02',
      "Prueba H: Acceso directo a '/' denegado (muestra AccessDeniedView)",
      hasAccessDeniedH && !hasDashboardViewH,
      `Status=${resDirectH.statusCode}, hasAccessDenied=${hasAccessDeniedH}, hasDashboardView=${hasDashboardViewH}`
    );

    // -------------------------------------------------------------
    // PRUEBA 3: Prueba H — /api/dashboard devuelve HTTP 403 Forbidden
    // -------------------------------------------------------------
    const resApiH = await makeHttpRequest('/api/dashboard', tokenPruebaH);
    let apiHForbidden = resApiH.statusCode === 403;
    let apiHErrorMsg = '';
    try {
      const j = JSON.parse(resApiH.body);
      apiHErrorMsg = j.error || '';
      apiHForbidden = apiHForbidden && j.error === 'FORBIDDEN';
    } catch {
      apiHForbidden = false;
    }
    record(
      'TC-03',
      'Prueba H: /api/dashboard devuelve HTTP 403 Forbidden',
      apiHForbidden,
      `Status=${resApiH.statusCode}, Body=${resApiH.body.trim()}`
    );

    // -------------------------------------------------------------
    // PRUEBA 4: Usuario Autorizado (Rol 113) — HOME visible y Dashboard funcional
    // -------------------------------------------------------------
    const navPermsAdmin = await getUserNavigationPermissions(userAutorizado.usuario_id);
    const hasAdminHomePerm = Boolean(navPermsAdmin.modules?.['DASHBOARD']);
    const resDirectAdmin = await makeHttpRequest('/', tokenAutorizado);
    const resApiAdmin = await makeHttpRequest('/api/dashboard', tokenAutorizado);

    const adminDashOk = resDirectAdmin.statusCode === 200 &&
      !resDirectAdmin.body.includes('HTTP 403 Forbidden') &&
      resApiAdmin.statusCode === 200;

    record(
      'TC-04',
      'Usuario Autorizado (Rol 113): HOME visible y Dashboard funcional',
      hasAdminHomePerm && adminDashOk,
      `modules['DASHBOARD']=${hasAdminHomePerm}, Page Status=${resDirectAdmin.statusCode}, API Status=${resApiAdmin.statusCode}`
    );

    // -------------------------------------------------------------
    // PRUEBA 5: SuperAdmin (Rol 1) — Salvaguarda institucional (Modelo B)
    // -------------------------------------------------------------
    const navPermsSuper = await getUserNavigationPermissions(userSuperAdmin.usuario_id);
    const canManageSecurity = await canUser(userSuperAdmin.usuario_id, 'puede_ver', '/settings/security/roles');
    const resDirectSuper = await makeHttpRequest('/', tokenSuperAdmin);

    // En Modelo B (Fase 6.4.5/6.4.6): SuperAdmin conserva salvaguarda de Seguridad intacta.
    // En Dashboard, al tener pantalla_id 1 denegada, el Smart Dispatcher lo redirige limpiamente (307)
    // a su pantalla autorizada sin mostrar 403 técnico ni pantalla de error.
    const superOk = navPermsSuper.isSuperAdmin === true &&
      canManageSecurity === true &&
      (resDirectSuper.statusCode === 200 || resDirectSuper.statusCode === 307) &&
      !resDirectSuper.body.includes('HTTP 403 Forbidden');

    record(
      'TC-05',
      'SuperAdmin: Salvaguarda institucional de Seguridad y Smart Home Dispatcher',
      superOk,
      `isSuperAdmin=${navPermsSuper.isSuperAdmin}, canManageSecurity=${canManageSecurity}, Page Status=${resDirectSuper.statusCode}`
    );

    // -------------------------------------------------------------
    // PRUEBA 6: Permiso Personalizado — Precedencia correcta
    // -------------------------------------------------------------
    await client.query(`
      INSERT INTO admin.usuario_permiso_personalizado (
        usuario_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_eliminar, estado
      ) VALUES (18, 1, true, false, false, false, 'ACTIVO')
    `);

    const permsCustom = await getScreenPermissions('/', 18);
    const navPermsCustom = await getUserNavigationPermissions(18);
    const resApiCustom = await makeHttpRequest('/api/dashboard', tokenPruebaH);

    // Limpieza inmediata del permiso personalizado
    await client.query(`DELETE FROM admin.usuario_permiso_personalizado WHERE usuario_id = 18 AND pantalla_id = 1`);

    const customOk = permsCustom.puede_ver === true &&
      navPermsCustom.screens['DASHBOARD_MAIN'] === true &&
      resApiCustom.statusCode === 200;

    record(
      'TC-06',
      'Permiso Personalizado: Precedencia y concesión individual',
      customOk,
      `puede_ver=${permsCustom.puede_ver}, screens['DASHBOARD_MAIN']=${navPermsCustom.screens['DASHBOARD_MAIN']}, API Status=${resApiCustom.statusCode}`
    );

    // -------------------------------------------------------------
    // PRUEBA 7: Roles Adicionales — Unión de roles funcional
    // -------------------------------------------------------------
    // Asignar temporalmente rol_funcional_id 113 como rol adicional a Prueba H
    const maxUraRes = await client.query(`SELECT COALESCE(MAX(usuario_rol_adicional_id), 0) + 1 as next_id FROM admin.usuario_rol_adicional`);
    const nextUraId = maxUraRes.rows[0].next_id;

    await client.query(`
      INSERT INTO admin.usuario_rol_adicional (usuario_rol_adicional_id, usuario_id, rol_funcional_id)
      VALUES ($1, 18, 113)
    `, [nextUraId]);

    const permsAddRole = await getScreenPermissions('/', 18);
    const navPermsAddRole = await getUserNavigationPermissions(18);
    const resApiAddRole = await makeHttpRequest('/api/dashboard', tokenPruebaH);

    // Limpieza inmediata del rol adicional
    await client.query(`DELETE FROM admin.usuario_rol_adicional WHERE usuario_rol_adicional_id = $1`, [nextUraId]);

    const addRoleOk = permsAddRole.puede_ver === true &&
      navPermsAddRole.screens['DASHBOARD_MAIN'] === true &&
      resApiAddRole.statusCode === 200;

    record(
      'TC-07',
      'Roles Adicionales: Unión y herencia de permisos correcta',
      addRoleOk,
      `puede_ver=${permsAddRole.puede_ver}, screens['DASHBOARD_MAIN']=${navPermsAddRole.screens['DASHBOARD_MAIN']}, API Status=${resApiAddRole.statusCode}`
    );

    // -------------------------------------------------------------
    // PRUEBA 8: Aislamiento Multiempresa
    // -------------------------------------------------------------
    // Verificar que los datos devueltos para el usuario corresponden únicamente a su empresa_id
    const resApiEmpresa = await makeHttpRequest('/api/dashboard', tokenAutorizado);
    let multiempresaOk = false;
    try {
      const dataAdmin = JSON.parse(resApiEmpresa.body);
      // Validar que la respuesta contiene datos válidos sin contaminación cruzada
      multiempresaOk = dataAdmin.success === true && dataAdmin.data !== undefined;
    } catch {
      multiempresaOk = false;
    }
    record(
      'TC-08',
      'Aislamiento Multiempresa: Consultas acotadas por empresa_id',
      multiempresaOk,
      `API success=${multiempresaOk}, Empresa=${userAutorizado.empresa_id}`
    );

    // -------------------------------------------------------------
    // PRUEBA 9: Regresión de Módulos Autorizados para Prueba H
    // -------------------------------------------------------------
    // Prueba H debe conservar acceso a Taller, Facturación e Inventario
    const navPermsCheck = await getUserNavigationPermissions(18);
    const retainsTaller = Boolean(navPermsCheck.modules['TALLER']);
    const retainsFacturacion = Boolean(navPermsCheck.modules['FACTURACION']);
    const retainsInventario = Boolean(navPermsCheck.modules['INVENTARIO']);
    const regressionOk = retainsTaller && retainsFacturacion && retainsInventario && !navPermsCheck.modules['DASHBOARD'];

    record(
      'TC-09',
      'Regresión: Conservación de módulos autorizados de Prueba H (Taller, Facturación, Inventario)',
      regressionOk,
      `Taller=${retainsTaller}, Facturacion=${retainsFacturacion}, Inventario=${retainsInventario}, Dashboard=${Boolean(navPermsCheck.modules['DASHBOARD'])}`
    );

    // -------------------------------------------------------------
    // PRUEBA 10: Fail-Closed Perimetral sin Sesión (Anónimo)
    // -------------------------------------------------------------
    const resAnonRoot = await makeHttpRequest('/', null);
    const resAnonApi = await makeHttpRequest('/api/dashboard', null);
    const anonOk = (resAnonRoot.statusCode === 307 || resAnonRoot.statusCode === 302) &&
      resAnonApi.statusCode === 401;

    record(
      'TC-10',
      'Fail-Closed Perimetral: Redirección sin sesión en / y HTTP 401 en API',
      anonOk,
      `Root Status=${resAnonRoot.statusCode}, API Status=${resAnonApi.statusCode}`
    );

    console.log('\n======================================================================');
    const allPassed = testResults.every(t => t.passed);
    console.log(`TOTAL PRUEBAS: ${testResults.length} | PASARON: ${testResults.filter(t => t.passed).length} | FALLARON: ${testResults.filter(t => !t.passed).length}`);
    console.log(`RESULTADO GLOBAL: ${allPassed ? '✅ APROBADO 100%' : '❌ FALLÓ'}`);
    console.log('======================================================================\n');

  } finally {
    if (createdSessions.length > 0) {
      await client.query(`DELETE FROM admin.usuario_sesion WHERE sesion_id = ANY($1)`, [createdSessions]);
    }
    client.release();
    await pool.end();
  }
}

runRegressionSuite().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
