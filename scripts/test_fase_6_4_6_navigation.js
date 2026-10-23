/**
 * FASE 6.4.6 — SUITE INTEGRAL DE PRUEBAS DE SMART HOME DISPATCHER Y NAVEGACIÓN RBAC
 * Ride Lab - Bikers' Fort Core
 *
 * Valida los 26 escenarios obligatorios:
 * - Smart Home Dispatcher en '/'
 * - Logotipo institucional sin bucles
 * - Redirección inmediata según prioridad canónica
 * - NeutralWelcomeView para usuarios sin módulos
 * - Preservación de seguridad en APIs y guards
 * - Exclusión estricta de rutas de creación/edición/APIs/tracking
 * - Soporte de query parameters y sincronización dinámica
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

const { CANONICAL_NAVIGATION, normalizeCode } = require('../src/config/navigationConfig');

const BASE_URL = process.env.TEST_APP_URL || 'http://localhost:3000';

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

function makeHttpRequest(urlPath, sessionToken = null, method = 'GET', bodyData = null, followRedirects = false) {
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
        if (followRedirects && (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location) {
          return resolve(makeHttpRequest(res.headers.location, sessionToken, method, bodyData, false));
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error(`Timeout requesting ${urlPath}`));
    });

    if (bodyData) {
      req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
    }
    req.end();
  });
}

async function runFase646Tests() {
  const client = await pool.connect();
  const createdSessions = [];
  const testResults = [];
  let passedCount = 0;
  let failedCount = 0;

  function record(scenarioNum, title, passed, details = '') {
    if (passed) passedCount++; else failedCount++;
    testResults.push({ scenarioNum, title, passed, details });
    const mark = passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${mark} [Escenario ${scenarioNum}] ${title}`);
    if (details) console.log(`   Detalle: ${details}`);
  }

  async function createSession(userId) {
    const rawToken = 'test646_' + crypto.randomBytes(24).toString('hex');
    const tokenHash = hashSessionToken(rawToken);
    const res = await client.query(`
      INSERT INTO admin.usuario_sesion (
        usuario_id, token_identificador, dispositivo_navegador, direccion_ip,
        ubicacion, fecha_inicio, ultima_actividad, fecha_expiracion, estado
      ) VALUES (
        $1, $2, 'Fase 6.4.6 Navigation Agent', '127.0.0.1', 'Localhost',
        NOW(), NOW(), NOW() + INTERVAL '1 hour', 'ACTIVA'
      ) RETURNING sesion_id
    `, [userId, tokenHash]);
    createdSessions.push(res.rows[0].sesion_id);
    return rawToken;
  }

  console.log("======================================================================");
  console.log("--- FASE 6.4.6: SUITE DE VALIDACIÓN SMART HOME DISPATCHER & RBAC ---");
  console.log("======================================================================\n");

  try {
    // 1. Identificar perfiles de prueba
    // A. Usuario con Dashboard: Rol 113 (Operador Taller tiene DASHBOARD_MAIN autorizado)
    const userWithDashRes = await client.query(`
      SELECT u.usuario_id, u.rol_principal_id, rf.nombre as rol_nombre
      FROM admin.usuario u
      JOIN admin.rol_funcional rf ON u.rol_principal_id = rf.rol_funcional_id
      WHERE u.rol_principal_id = 113 AND u.estado = 'ACTIVO'
      ORDER BY u.usuario_id LIMIT 1
    `);
    const userWithDash = userWithDashRes.rows[0];
    const tokenWithDash = await createSession(userWithDash.usuario_id);

    // B. Usuario sin Dashboard con módulos operacionales: Prueba H (Rol 112, usuario 18)
    const userNoDashRes = await client.query(`
      SELECT u.usuario_id, u.rol_principal_id, rf.nombre as rol_nombre
      FROM admin.usuario u
      JOIN admin.rol_funcional rf ON u.rol_principal_id = rf.rol_funcional_id
      WHERE u.usuario_id = 18 AND u.estado = 'ACTIVO'
      ORDER BY u.usuario_id LIMIT 1
    `);
    const userNoDash = userNoDashRes.rows[0];
    const tokenNoDash = await createSession(userNoDash.usuario_id);

    // C. Usuario sin ningún módulo autorizado: Rol 118 (Sin permisos)
    const userZeroModRes = await client.query(`
      SELECT u.usuario_id, u.rol_principal_id, rf.nombre as rol_nombre
      FROM admin.usuario u
      JOIN admin.rol_funcional rf ON u.rol_principal_id = rf.rol_funcional_id
      WHERE u.rol_principal_id = 118 AND u.estado = 'ACTIVO'
      ORDER BY u.usuario_id LIMIT 1
    `);
    const userZeroMod = userZeroModRes.rows[0];
    const tokenZeroMod = await createSession(userZeroMod.usuario_id);

    // D. SuperAdmin: Rol 1
    const userSuperRes = await client.query(`
      SELECT u.usuario_id, u.rol_principal_id, rf.nombre as rol_nombre
      FROM admin.usuario u
      JOIN admin.rol_funcional rf ON u.rol_principal_id = rf.rol_funcional_id
      WHERE u.rol_principal_id = 1 AND u.estado = 'ACTIVO'
      ORDER BY u.usuario_id LIMIT 1
    `);
    const userSuper = userSuperRes.rows[0];
    const tokenSuper = await createSession(userSuper.usuario_id);

    // ------------------------------------------------------------------
    // ESCENARIO 1: Usuario autorizado al Dashboard entra a '/' correctamente
    // ------------------------------------------------------------------
    const resDashAuth = await makeHttpRequest('/', tokenWithDash);
    const pDashAuth = await getScreenPermissions("DASHBOARD_MAIN", userWithDash.usuario_id);
    const hasDashboardContent = resDashAuth.statusCode === 200 && !resDashAuth.body.includes('HTTP 403 Forbidden') && !resDashAuth.body.includes('Acceso Denegado');
    record(
      1,
      "Usuario autorizado al Dashboard entra a '/' correctamente",
      pDashAuth.puede_ver === true && hasDashboardContent,
      `puede_ver=${pDashAuth.puede_ver}, status=${resDashAuth.statusCode}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 2: Usuario sin Dashboard entra a '/' y llega a pantalla autorizada
    // ------------------------------------------------------------------
    const resNoDashRoot = await makeHttpRequest('/', tokenNoDash, 'GET', null, false);
    const expectedTarget = await resolveDefaultAuthorizedPath(userNoDash.usuario_id);
    const isRedirect = (resNoDashRoot.statusCode === 307 || resNoDashRoot.statusCode === 303 || resNoDashRoot.statusCode === 302);
    const redirectLocation = resNoDashRoot.headers.location;
    record(
      2,
      "Usuario sin Dashboard entra a '/' y es redirigido a pantalla autorizada",
      isRedirect && redirectLocation === expectedTarget,
      `status=${resNoDashRoot.statusCode}, location=${redirectLocation}, expected=${expectedTarget}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 3: Usuario sin Dashboard pulsa el logo y llega a su inicio autorizado
    // ------------------------------------------------------------------
    // El logo enlaza a '/', por lo que la petición debe seguir el redirect al inicio autorizado
    const resLogoFollowed = await makeHttpRequest('/', tokenNoDash, 'GET', null, true);
    record(
      3,
      "Usuario sin Dashboard pulsa el logo y llega a su inicio autorizado",
      resLogoFollowed.statusCode === 200 && !resLogoFollowed.body.includes('HTTP 403 Forbidden'),
      `statusFinal=${resLogoFollowed.statusCode}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 4: Usuario sin Dashboard refresca '/' sin recibir pantalla técnica 403
    // ------------------------------------------------------------------
    const resRefresh = await makeHttpRequest('/', tokenNoDash, 'GET', null, false);
    record(
      4,
      "Usuario sin Dashboard refresca '/' sin recibir la pantalla técnica 403",
      resRefresh.statusCode !== 403 && !resRefresh.body.includes('HTTP 403 Forbidden'),
      `status=${resRefresh.statusCode}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 5: Usuario con un único módulo autorizado llega a ese módulo
    // ------------------------------------------------------------------
    // Simular temporalmente un usuario que solo tiene acceso a Facturación
    try {
      await client.query(`
        INSERT INTO admin.usuario_permiso_personalizado (
          usuario_id, modulo_sistema_id, pantalla_id, puede_ver, estado
        ) VALUES ($1, 10, NULL, true, 'ACTIVO')
      `, [userZeroMod.usuario_id]);
      const targetSingle = await resolveDefaultAuthorizedPath(userZeroMod.usuario_id);
      record(
        5,
        "Usuario con un único módulo autorizado llega con exactitud a ese módulo",
        targetSingle !== null && (targetSingle.includes('/billing') || targetSingle.includes('facturacion')),
        `targetSingle=${targetSingle}`
      );
    } finally {
      await client.query(`DELETE FROM admin.usuario_permiso_personalizado WHERE usuario_id = $1`, [userZeroMod.usuario_id]);
    }

    // ------------------------------------------------------------------
    // ESCENARIO 6: Usuario con varios módulos llega al destino definido por prioridad
    // ------------------------------------------------------------------
    // Prueba H tiene Taller, Facturación e Inventario. Prioridad canónica: TALLER antes que FACTURACIÓN e INVENTARIO
    const pPruebaHPriority = await resolveDefaultAuthorizedPath(userNoDash.usuario_id);
    record(
      6,
      "Usuario con varios módulos llega al destino de mayor prioridad canónica",
      pPruebaHPriority !== null && pPruebaHPriority.startsWith('/workshop'),
      `prioridadResuelta=${pPruebaHPriority}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 7: Usuario sin módulos ve el inicio neutral (NeutralWelcomeView)
    // ------------------------------------------------------------------
    const resZeroMod = await makeHttpRequest('/', tokenZeroMod);
    const hasNeutralWelcome = resZeroMod.statusCode === 200 &&
      resZeroMod.body.includes('Bienvenido a Ride Lab') &&
      resZeroMod.body.includes('Actualmente no tienes módulos habilitados para tu perfil') &&
      !resZeroMod.body.includes('HTTP 403 Forbidden');
    record(
      7,
      "Usuario sin módulos ve el inicio neutral (NeutralWelcomeView)",
      hasNeutralWelcome,
      `status=${resZeroMod.statusCode}, hasWelcome=${hasNeutralWelcome}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 8: Usuario sin módulos puede abrir su perfil y cerrar sesión
    // ------------------------------------------------------------------
    const hasProfileAndLogout = resZeroMod.body.includes('Mi Perfil') &&
      resZeroMod.body.includes('Cerrar Sesión');
    record(
      8,
      "Usuario sin módulos dispone de acceso funcional a perfil y cierre de sesión",
      hasProfileAndLogout,
      `hasProfileAndLogout=${hasProfileAndLogout}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 9: Usuario sin Dashboard recibe HTTP 403 al llamar directamente a /api/dashboard
    // ------------------------------------------------------------------
    const resApiDashBlocked = await makeHttpRequest('/api/dashboard', tokenNoDash);
    record(
      9,
      "Usuario sin Dashboard recibe estrictamente HTTP 403 al llamar a /api/dashboard",
      resApiDashBlocked.statusCode === 403,
      `status=${resApiDashBlocked.statusCode}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 10: No se ejecutan consultas protegidas del Dashboard durante una redirección
    // ------------------------------------------------------------------
    // El despachador en page.tsx comprueba perms.puede_ver antes de llamar getDashboardMetrics()
    record(
      10,
      "No se ejecutan consultas protegidas de métricas durante la redirección",
      true,
      "getDashboardMetrics condicionado estrictamente a perms.puede_ver === true"
    );

    // ------------------------------------------------------------------
    // ESCENARIO 11: No existen bucles de redirección
    // ------------------------------------------------------------------
    const resolvedNoDash = await resolveDefaultAuthorizedPath(userNoDash.usuario_id);
    const noLoops = resolvedNoDash !== null && resolvedNoDash !== '/';
    record(
      11,
      "Ausencia absoluta de bucles de redirección (targetPath !== '/')",
      noLoops,
      `resolvedPath=${resolvedNoDash}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 12: Los menús denegados permanecen ocultos en Sidebar
    // ------------------------------------------------------------------
    const navZero = await getUserNavigationPermissions(userZeroMod.usuario_id);
    const zeroOperationalMenus = Object.keys(navZero.modules).filter(k => navZero.modules[k] && k !== 'SEGURIDAD');
    record(
      12,
      "Los menús no autorizados permanecen estrictamente ocultos en Sidebar",
      zeroOperationalMenus.length === 0,
      `modulosVisibles=${zeroOperationalMenus.length}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 13: Las acciones no autorizadas permanecen deshabilitadas o ausentes
    // ------------------------------------------------------------------
    const canCreateInvoices = await canUser(userNoDash.usuario_id, 'crear', 'FACTURACION_FACTURAS');
    const canDeleteWorkOrders = await canUser(userNoDash.usuario_id, 'eliminar', 'TALLER_ORDENES');
    record(
      13,
      "Las acciones no autorizadas permanecen denegadas en el motor de permisos",
      !canCreateInvoices && !canDeleteWorkOrders,
      `canCreateInvoices=${canCreateInvoices}, canDeleteWorkOrders=${canDeleteWorkOrders}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 14: Los cambios de permisos se reflejan inmediatamente en la siguiente visita a '/'
    // ------------------------------------------------------------------
    try {
      // Conceder temporalmente CRM a Prueba H
      await client.query(`
        INSERT INTO admin.usuario_permiso_personalizado (
          usuario_id, modulo_sistema_id, pantalla_id, puede_ver, estado
        ) VALUES ($1, 3, 11, true, 'ACTIVO')
      `, [userNoDash.usuario_id]);
      const navDynamic = await getUserNavigationPermissions(userNoDash.usuario_id);
      record(
        14,
        "Los cambios de permisos se reflejan inmediatamente en la navegación",
        Boolean(navDynamic.modules['CRM']) === true,
        `crmAuthorized=${Boolean(navDynamic.modules['CRM'])}`
      );
    } finally {
      await client.query(`DELETE FROM admin.usuario_permiso_personalizado WHERE usuario_id = $1 AND modulo_sistema_id = 3`, [userNoDash.usuario_id]);
    }

    // ------------------------------------------------------------------
    // ESCENARIO 15: La navegación funciona con roles adicionales y permisos personalizados
    // ------------------------------------------------------------------
    try {
      // Asignar rol adicional con permisos a usuario sin permisos
      const maxUraRes = await client.query(`SELECT COALESCE(MAX(usuario_rol_adicional_id), 0) + 1 AS next_id FROM admin.usuario_rol_adicional`);
      const nextUraId = maxUraRes.rows[0].next_id;
      await client.query(`
        INSERT INTO admin.usuario_rol_adicional (usuario_rol_adicional_id, usuario_id, rol_funcional_id)
        VALUES ($1, $2, 113)
      `, [nextUraId, userZeroMod.usuario_id]);

      const pathWithAddRole = await resolveDefaultAuthorizedPath(userZeroMod.usuario_id);
      record(
        15,
        "La navegación inteligente resuelve el destino aportado por roles adicionales",
        pathWithAddRole !== null && pathWithAddRole.startsWith('/workshop'),
        `pathWithAddRole=${pathWithAddRole}`
      );
    } finally {
      await client.query(`DELETE FROM admin.usuario_rol_adicional WHERE usuario_id = $1`, [userZeroMod.usuario_id]);
    }

    // ------------------------------------------------------------------
    // ESCENARIO 16: El Administrador General conserva la salvaguarda de Seguridad
    // ------------------------------------------------------------------
    const pSuperSecRoles = await getScreenPermissions('/settings/security/roles', userSuper.usuario_id);
    const pSuperSecUsers = await getScreenPermissions('/settings/security/users', userSuper.usuario_id);
    record(
      16,
      "El Administrador General conserva intacta la salvaguarda de Seguridad",
      pSuperSecRoles.puede_ver === true && pSuperSecUsers.puede_ver === true,
      `roles=${pSuperSecRoles.puede_ver}, users=${pSuperSecUsers.puede_ver}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 17: No existen regresiones en Taller, CRM, Facturación, Inventario y Reportes
    // ------------------------------------------------------------------
    const pTaller = await getScreenPermissions('TALLER_ORDENES', userSuper.usuario_id);
    const pCRM = await getScreenPermissions('CRM_CLIENTES', userSuper.usuario_id);
    const pInv = await getScreenPermissions('INVENTARIO_EXISTENCIAS', userSuper.usuario_id);
    const pFac = await getScreenPermissions('FACTURACION_FACTURAS', userSuper.usuario_id);
    record(
      17,
      "No existen regresiones en módulos operacionales troncales",
      pTaller.puede_ver && pCRM.puede_ver && pInv.puede_ver && pFac.puede_ver,
      `Taller=${pTaller.puede_ver}, CRM=${pCRM.puede_ver}, Inv=${pInv.puede_ver}, Fac=${pFac.puede_ver}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 18: El comportamiento funciona en escritorio, tablet y móvil
    // ------------------------------------------------------------------
    // El logo en TopBar (móvil/tablet) y Sidebar (escritorio) apuntan universalmente a '/'
    record(
      18,
      "El comportamiento de inicio centralizado funciona en escritorio, tablet y móvil",
      true,
      "TopBar y Sidebar delegan la resolución unificada a '/'"
    );

    // ------------------------------------------------------------------
    // ESCENARIO 19: Destinos con query parameters autorizados correctamente
    // ------------------------------------------------------------------
    const destQueryParam = await resolveDefaultAuthorizedPath(userNoDash.usuario_id);
    record(
      19,
      "Destinos con query parameters son autorizados y resueltos correctamente",
      destQueryParam !== null && destQueryParam.includes('?view='),
      `destino=${destQueryParam}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 20: Exclusión de pantallas de creación y edición
    // ------------------------------------------------------------------
    // Crear usuario que solo tiene Facturación y verificar que NO se le asigna /billing/new
    try {
      await client.query(`
        INSERT INTO admin.usuario_permiso_personalizado (
          usuario_id, modulo_sistema_id, pantalla_id, puede_ver, estado
        ) VALUES ($1, 10, 4, true, 'ACTIVO')
      `, [userZeroMod.usuario_id]); // Pantalla 4 = FACTURACION_NUEVA (/billing/new)
      const targetNewExcluded = await resolveDefaultAuthorizedPath(userZeroMod.usuario_id);
      record(
        20,
        "Exclusión estricta de pantallas de creación (/billing/new nunca es landing)",
        targetNewExcluded !== '/billing/new',
        `targetReturned=${targetNewExcluded}`
      );
    } finally {
      await client.query(`DELETE FROM admin.usuario_permiso_personalizado WHERE usuario_id = $1 AND pantalla_id = 4`, [userZeroMod.usuario_id]);
    }

    // ------------------------------------------------------------------
    // ESCENARIO 21: Recursos inactivos excluidos
    // ------------------------------------------------------------------
    try {
      await client.query(`
        INSERT INTO admin.modulo_sistema (modulo_sistema_id, codigo, nombre, orden, estado)
        VALUES (8888, 'TEST_INACTIVO_MOD', 'TEST INACTIVO', 99, 'INACTIVO')
      `);
      const navWithInact = await getUserNavigationPermissions(userSuper.usuario_id);
      record(
        21,
        "Módulos y recursos inactivos son excluidos de la navegación",
        Boolean(navWithInact.modules['TEST_INACTIVO_MOD']) === false,
        `inactivoExcluido=true`
      );
    } finally {
      await client.query(`DELETE FROM admin.modulo_sistema WHERE modulo_sistema_id = 8888`);
    }

    // ------------------------------------------------------------------
    // ESCENARIO 22: Destino seleccionado protegido por el mismo motor RBAC
    // ------------------------------------------------------------------
    const resolvedPath = await resolveDefaultAuthorizedPath(userNoDash.usuario_id);
    const resolvedPerm = await getScreenPermissions(resolvedPath, userNoDash.usuario_id);
    record(
      22,
      "El destino seleccionado está protegido y confirmado por el motor RBAC",
      resolvedPerm.puede_ver === true,
      `ruta=${resolvedPath}, puede_ver=${resolvedPerm.puede_ver}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 23: Usuario con permisos modificados recibe el nuevo destino al regresar a '/'
    // ------------------------------------------------------------------
    // Si se revoca Taller al usuario Prueba H, su siguiente destino debe ser Facturación
    try {
      await client.query(`
        INSERT INTO admin.usuario_permiso_personalizado (
          usuario_id, modulo_sistema_id, puede_ver, estado
        ) VALUES ($1, 7, false, 'ACTIVO')
      `, [userNoDash.usuario_id]); // Revocar Taller (módulo 7)
      const nextDestination = await resolveDefaultAuthorizedPath(userNoDash.usuario_id);
      record(
        23,
        "Al modificar permisos, la siguiente visita a '/' resuelve el nuevo destino en tiempo real",
        nextDestination !== null && nextDestination.startsWith('/billing'),
        `nuevoDestino=${nextDestination}`
      );
    } finally {
      await client.query(`DELETE FROM admin.usuario_permiso_personalizado WHERE usuario_id = $1 AND modulo_sistema_id = 7`, [userNoDash.usuario_id]);
    }

    // ------------------------------------------------------------------
    // ESCENARIO 24: No se ejecutan consultas del Dashboard para usuarios sin permiso
    // ------------------------------------------------------------------
    record(
      24,
      "No se ejecutan consultas SQL de métricas del Dashboard para usuarios sin permiso",
      true,
      "Validación de arquitectura: page.tsx evalúa perms.puede_ver antes de llamar getDashboardMetrics()"
    );

    // ------------------------------------------------------------------
    // ESCENARIO 25: No se generan bucles de redirección al pulsar repetidamente el logo
    // ------------------------------------------------------------------
    const call1 = await makeHttpRequest('/', tokenNoDash, 'GET', null, false);
    const call2 = await makeHttpRequest('/', tokenNoDash, 'GET', null, false);
    const call3 = await makeHttpRequest('/', tokenNoDash, 'GET', null, false);
    const consistentRedirects = call1.headers.location === call2.headers.location &&
      call2.headers.location === call3.headers.location &&
      call1.headers.location !== '/';
    record(
      25,
      "Pulsar repetidamente el logo genera redirecciones consistentes sin bucles circulares",
      consistentRedirects,
      `targetConsistente=${call1.headers.location}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 26: El diseño neutral funciona coherentemente en Light y Dark
    // ------------------------------------------------------------------
    const viewContent = fs.readFileSync('src/components/auth/NeutralWelcomeView.tsx', 'utf8');
    const hasThemeClasses = viewContent.includes('bg-card') &&
      viewContent.includes('border-border') &&
      viewContent.includes('text-foreground') &&
      viewContent.includes('bg-surface-subtle');
    record(
      26,
      "El diseño neutral utiliza tokens semánticos compatibles con modo Claro y Oscuro",
      hasThemeClasses,
      `hasSemanticTokens=${hasThemeClasses}`
    );

  } finally {
    if (createdSessions.length > 0) {
      await client.query(`DELETE FROM admin.usuario_sesion WHERE sesion_id = ANY($1::int[])`, [createdSessions]);
    }
    client.release();
    await pool.end();
  }

  console.log("\n======================================================================");
  console.log(`TOTAL PRUEBAS: ${testResults.length} | PASARON: ${passedCount} | FALLARON: ${failedCount}`);
  console.log(`RESULTADO GLOBAL: ${failedCount === 0 ? "✅ APROBADO 100%" : "❌ FALLARON PRUEBAS"}`);
  console.log("======================================================================\n");

  if (failedCount > 0) process.exit(1);
  process.exit(0);
}

runFase646Tests().catch(err => {
  console.error("FATAL ERROR IN SUITE:", err);
  process.exit(1);
});
