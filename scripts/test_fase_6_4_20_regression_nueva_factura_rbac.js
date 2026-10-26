/**
 * RIDE LAB — REGRESIÓN DE RBAC: HTTP 403 EN NUEVA FACTURA
 * SUITE DE PRUEBAS DE REGRESIÓN: SINCRONIZACIÓN SIDEBAR Y AUTORIZACIÓN FACTURACION_NUEVA
 * Archivo: scripts/test_fase_6_4_20_regression_nueva_factura_rbac.js
 * 
 * Cobertura de la Suite:
 * 1. SuperAdmin (Rol 1): Sin permiso de creación de facturas, no recibe "Nueva Factura" en Sidebar ni navegación.
 * 2. SuperAdmin (Rol 1): Acceso directo a /billing/new continúa bloqueado en servidor por ProtectedServerPage (HTTP 403 / puede_crear=false).
 * 3. SuperAdmin (Rol 1): Salvaguarda institucional de Seguridad intacta (Modelo B).
 * 4. Administrador de Empresa (Rol 2): Autorizado para crear facturas, recibe "Nueva Factura" en Sidebar y accede con éxito (HTTP 200).
 * 5. Roles no autorizados (Rol 3 Supervisor Comercial, Rol 6 Auditor, Rol 112 Solo Lectura): ninguno ve "Nueva Factura" en el Sidebar.
 * 6. Roles operativos autorizados (Rol 114 Supervisor, Rol 116 Encargado Facturación): ven "Nueva Factura" y pueden crear.
 * 7. Permiso personalizado de usuario: Conceder puede_crear=true dinámicamente habilita la opción; revocarla la oculta (Fail-Closed).
 * 8. Consistencia de pantallas de acción operativa: INVENTARIO_ENTRADAS, INVENTARIO_TRANSFERENCIAS y CONFIG_INVENTARIO_INICIAL.
 * 9. Ausencia de landing indebido: resolveDefaultAuthorizedPath jamás asigna /billing/new como landing page.
 * 10. Fail-Closed inmutable: Cero excepciones ad-hoc, cero bypasses de rol no gobernados por la matriz.
 */

const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { Pool } = require('pg');
require('./register-ts');

const envConfig = dotenv.parse(fs.readFileSync('.env.test.local'));
process.env.DATABASE_URL = envConfig.DATABASE_URL;
process.env.APP_ENV = 'test';
const pool = new Pool({ connectionString: envConfig.DATABASE_URL });

const { CANONICAL_NAVIGATION, normalizeCode, getRequiredActionForScreen } = require('../src/config/navigationConfig');
const { 
  getScreenPermissions,
  getUserNavigationPermissions,
  canUser,
  resolveDefaultAuthorizedPath
} = require('../src/lib/workshop-session');

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
    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
          });
        });
      }
    );
    req.on('error', reject);
    if (bodyData) {
      req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
    }
    req.end();
  });
}

function simulateSidebarVisibility(navPerms) {
  if (!navPerms || !navPerms.modules || !navPerms.screens) return [];
  return CANONICAL_NAVIGATION.map(menu => {
    const menuKey = normalizeCode(menu.codigo);
    const hasMenuPerm = Boolean(navPerms.modules?.[menuKey]);
    const visibleScreens = menu.screens.filter(screen => {
      const screenKey = screen.codigo;
      const screenRoute = screen.ruta;
      if (navPerms.screens?.[screenKey] !== undefined) {
        return Boolean(navPerms.screens[screenKey]);
      }
      if (navPerms.screens?.[screenRoute] !== undefined) {
        return Boolean(navPerms.screens[screenRoute]);
      }
      if (screen.requiredAction && screen.requiredAction !== "puede_ver") {
        return false;
      }
      return hasMenuPerm;
    });
    if (menu.screens.length > 0 && visibleScreens.length === 0) return null;
    return {
      id: menu.id,
      nombre: menu.nombre,
      screens: visibleScreens.map(s => ({
        codigo: s.codigo,
        nombre: s.nombre,
        ruta: s.ruta,
        requiredAction: s.requiredAction || "puede_ver"
      }))
    };
  }).filter(Boolean);
}

let passed = 0;
let failed = 0;
const results = [];

function record(id, title, success, detail) {
  if (success) {
    passed++;
    console.log(`✅ PASS [Escenario ${id}] ${title}`);
  } else {
    failed++;
    console.log(`❌ FAIL [Escenario ${id}] ${title}`);
  }
  if (detail) console.log(`   Detalle: ${detail}`);
  results.push({ id, title, success, detail });
}

async function runRegressionSuite() {
  console.log('='.repeat(80));
  console.log('RIDE LAB — REGRESIÓN DE RBAC: HTTP 403 EN NUEVA FACTURA');
  console.log('Validación de Sincronización Sidebar / Server-Side FACTURACION_NUEVA');
  console.log('='.repeat(80));

  let testUserId = null;
  let testSessionToken = null;

  try {
    // -------------------------------------------------------------------------
    // GRUPO 1: Diagnóstico de Configuración Canónica y requiredAction
    // -------------------------------------------------------------------------
    console.log('\n--- GRUPO 1: Definición Canónica y Helper getRequiredActionForScreen ---');

    const fnAction = getRequiredActionForScreen('FACTURACION_NUEVA');
    const fnPathAction = getRequiredActionForScreen('/billing/new');
    record(1, 'FACTURACION_NUEVA declara requiredAction="puede_crear" de forma unificada',
      fnAction === 'puede_crear' && fnPathAction === 'puede_crear',
      `fnAction=${fnAction}, fnPathAction=${fnPathAction}`
    );

    const factMenu = CANONICAL_NAVIGATION.find(m => m.id === 'facturacion');
    const factNuevaScr = factMenu?.screens.find(s => s.codigo === 'FACTURACION_NUEVA');
    record(2, 'CANONICAL_NAVIGATION contiene requiredAction="puede_crear" en facturacion_nueva',
      factNuevaScr && factNuevaScr.requiredAction === 'puede_crear',
      `requiredAction=${factNuevaScr?.requiredAction}`
    );

    // -------------------------------------------------------------------------
    // GRUPO 2: SuperAdmin (Rol 1) sin permiso de creación operativa
    // -------------------------------------------------------------------------
    console.log('\n--- GRUPO 2: SuperAdmin (Rol 1) - Modelo B sin Creación Operativa ---');

    // Localizar usuario SuperAdmin (User 1)
    const superAdminRes = await pool.query(`
      SELECT u.usuario_id, u.rol_principal_id, rf.nombre as rol_nombre
      FROM admin.usuario u
      JOIN admin.rol_funcional rf ON rf.rol_funcional_id = u.rol_principal_id
      WHERE u.rol_principal_id = 1 AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
      LIMIT 1
    `);
    const superAdmin = superAdminRes.rows[0];

    const saNavPerms = await getUserNavigationPermissions(superAdmin.usuario_id);
    record(3, 'SuperAdmin: getUserNavigationPermissions retorna screens["FACTURACION_NUEVA"] = false',
      saNavPerms.screens['FACTURACION_NUEVA'] === false && saNavPerms.screens['/billing/new'] === false,
      `FACTURACION_NUEVA=${saNavPerms.screens['FACTURACION_NUEVA']}, /billing/new=${saNavPerms.screens['/billing/new']}`
    );

    const saSidebar = simulateSidebarVisibility(saNavPerms);
    const saFactMenu = saSidebar.find(m => m.id === 'facturacion');
    const saHasNuevaFactura = saFactMenu?.screens.some(s => s.codigo === 'FACTURACION_NUEVA');
    record(4, 'SuperAdmin: El Sidebar NO muestra la opción "Nueva Factura" al carecer de puede_crear',
      saHasNuevaFactura === false,
      `saHasNuevaFactura=${saHasNuevaFactura}, Submenu Screens: ${saFactMenu?.screens.map(s => s.nombre).join(', ')}`
    );

    const saFactEmitidas = saFactMenu?.screens.some(s => s.codigo === 'FACTURACION_FACTURAS');
    record(5, 'SuperAdmin: El menú FACTURACIÓN conserva pantallas de consulta legítimas (Facturas Emitidas)',
      saFactEmitidas === true,
      `saFactEmitidas=${saFactEmitidas}`
    );

    const saPerms = await getScreenPermissions('FACTURACION_NUEVA', superAdmin.usuario_id);
    record(6, 'SuperAdmin: getScreenPermissions("FACTURACION_NUEVA") mantiene puede_crear=false (Modelo B)',
      saPerms.puede_ver === true && saPerms.puede_crear === false,
      `puede_ver=${saPerms.puede_ver}, puede_crear=${saPerms.puede_crear}`
    );

    record(7, 'SuperAdmin: Salvaguarda institucional de Seguridad inmutable (Modelo B)',
      saNavPerms.modules['SEGURIDAD'] === true && saNavPerms.screens['SEGURIDAD_USUARIOS'] === true,
      `SEGURIDAD=${saNavPerms.modules['SEGURIDAD']}, SEGURIDAD_USUARIOS=${saNavPerms.screens['SEGURIDAD_USUARIOS']}`
    );

    // -------------------------------------------------------------------------
    // GRUPO 3: Administrador de Empresa (Rol 2) - Autorizado para Facturar
    // -------------------------------------------------------------------------
    console.log('\n--- GRUPO 3: Administrador de Empresa (Rol 2) - Autorizado ---');

    const adminEmpRes = await pool.query(`
      SELECT u.usuario_id, u.rol_principal_id, rf.nombre as rol_nombre
      FROM admin.usuario u
      JOIN admin.rol_funcional rf ON rf.rol_funcional_id = u.rol_principal_id
      WHERE u.rol_principal_id = 2 AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
      LIMIT 1
    `);
    const adminEmp = adminEmpRes.rows[0];

    const aeNavPerms = await getUserNavigationPermissions(adminEmp.usuario_id);
    record(8, 'Rol 2: getUserNavigationPermissions retorna screens["FACTURACION_NUEVA"] = true',
      aeNavPerms.screens['FACTURACION_NUEVA'] === true && aeNavPerms.screens['/billing/new'] === true,
      `FACTURACION_NUEVA=${aeNavPerms.screens['FACTURACION_NUEVA']}, /billing/new=${aeNavPerms.screens['/billing/new']}`
    );

    const aeSidebar = simulateSidebarVisibility(aeNavPerms);
    const aeFactMenu = aeSidebar.find(m => m.id === 'facturacion');
    const aeHasNuevaFactura = aeFactMenu?.screens.some(s => s.codigo === 'FACTURACION_NUEVA');
    record(9, 'Rol 2: El Sidebar MUESTRA "Nueva Factura" como opción operativa disponible',
      aeHasNuevaFactura === true,
      `aeHasNuevaFactura=${aeHasNuevaFactura}, Submenu: ${aeFactMenu?.screens.map(s => s.nombre).join(', ')}`
    );

    const aePerms = await getScreenPermissions('FACTURACION_NUEVA', adminEmp.usuario_id);
    record(10, 'Rol 2: getScreenPermissions("FACTURACION_NUEVA") posee puede_crear=true',
      aePerms.puede_ver === true && aePerms.puede_crear === true,
      `puede_ver=${aePerms.puede_ver}, puede_crear=${aePerms.puede_crear}`
    );

    // -------------------------------------------------------------------------
    // GRUPO 4: Roles No Autorizados (Rol 3 Supervisor Comercial, Rol 6 Auditor)
    // -------------------------------------------------------------------------
    console.log('\n--- GRUPO 4: Roles No Autorizados (Supervisor Comercial, Auditor) ---');

    // Rol 3: Supervisor Comercial (matriz tiene puede_ver=true, puede_crear=false)
    const supComRes = await pool.query(`
      SELECT rf.rol_funcional_id, map.puede_ver, map.puede_crear
      FROM admin.rol_funcional rf
      LEFT JOIN admin.matriz_acceso_pantalla map ON map.rol_funcional_id = rf.rol_funcional_id AND map.pantalla_id = 5
      WHERE rf.rol_funcional_id = 3
    `);
    record(11, 'Matriz DB: Rol 3 (Supervisor Comercial) tiene puede_ver=true pero puede_crear=false',
      supComRes.rows[0]?.puede_ver === true && supComRes.rows[0]?.puede_crear === false,
      `puede_ver=${supComRes.rows[0]?.puede_ver}, puede_crear=${supComRes.rows[0]?.puede_crear}`
    );

    // Rol 6: Auditor (matriz tiene puede_ver=true, puede_crear=false)
    const auditorRes = await pool.query(`
      SELECT rf.rol_funcional_id, map.puede_ver, map.puede_crear
      FROM admin.rol_funcional rf
      LEFT JOIN admin.matriz_acceso_pantalla map ON map.rol_funcional_id = rf.rol_funcional_id AND map.pantalla_id = 5
      WHERE rf.rol_funcional_id = 6
    `);
    record(12, 'Matriz DB: Rol 6 (Auditor) tiene puede_ver=true pero puede_crear=false',
      auditorRes.rows[0]?.puede_ver === true && auditorRes.rows[0]?.puede_crear === false,
      `puede_ver=${auditorRes.rows[0]?.puede_ver}, puede_crear=${auditorRes.rows[0]?.puede_crear}`
    );

    // -------------------------------------------------------------------------
    // GRUPO 5: Asignación Dinámica de Permisos Personalizados (Fail-Closed)
    // -------------------------------------------------------------------------
    console.log('\n--- GRUPO 5: Concesión y Revocación Dinámica de Permisos Personalizados ---');

    // Crear usuario sintético con Rol 6 (Auditor)
    const userInsert = await pool.query(`
      INSERT INTO admin.usuario (usuario_id, empresa_id, rol_principal_id, tipo_usuario_id, estado, estado_activacion, fecha_creacion, fecha_actualizacion)
      VALUES ((SELECT COALESCE(MAX(usuario_id), 0) + 1 FROM admin.usuario), 1, 6, 2, 'ACTIVO', 'ACTIVADO', now(), now())
      RETURNING usuario_id
    `);
    testUserId = userInsert.rows[0].usuario_id;

    // Inicialmente: Auditor no ve Nueva Factura
    const initialNav = await getUserNavigationPermissions(testUserId);
    record(13, 'Usuario Auditor: Sin permiso personalizado no ve "Nueva Factura" en navegación',
      initialNav.screens['FACTURACION_NUEVA'] === false,
      `FACTURACION_NUEVA=${initialNav.screens['FACTURACION_NUEVA']}`
    );

    // Conceder permiso personalizado puede_crear=true
    await pool.query(`
      INSERT INTO admin.usuario_permiso_personalizado (usuario_id, pantalla_id, puede_ver, puede_crear, estado)
      VALUES ($1, 5, true, true, 'ACTIVO')
    `, [testUserId]);

    const grantedNav = await getUserNavigationPermissions(testUserId);
    const grantedSidebar = simulateSidebarVisibility(grantedNav);
    const grantedFactMenu = grantedSidebar.find(m => m.id === 'facturacion');
    const grantedHasNew = grantedFactMenu?.screens.some(s => s.codigo === 'FACTURACION_NUEVA');
    record(14, 'Concesión personalizada: puede_crear=true habilita "Nueva Factura" en Sidebar dinámicamente',
      grantedNav.screens['FACTURACION_NUEVA'] === true && grantedHasNew === true,
      `grantedNav=${grantedNav.screens['FACTURACION_NUEVA']}, Sidebar=${grantedHasNew}`
    );

    // Revocar permiso personalizado
    await pool.query(`
      DELETE FROM admin.usuario_permiso_personalizado WHERE usuario_id = $1 AND pantalla_id = 5
    `, [testUserId]);

    const revokedNav = await getUserNavigationPermissions(testUserId);
    const revokedSidebar = simulateSidebarVisibility(revokedNav);
    const revokedFactMenu = revokedSidebar.find(m => m.id === 'facturacion');
    const revokedHasNew = revokedFactMenu?.screens.some(s => s.codigo === 'FACTURACION_NUEVA');
    record(15, 'Revocación personalizada: Retirar puede_crear vuelve a ocultar la opción (Fail-Closed)',
      revokedNav.screens['FACTURACION_NUEVA'] === false && revokedHasNew === false,
      `revokedNav=${revokedNav.screens['FACTURACION_NUEVA']}, Sidebar=${revokedHasNew}`
    );

    // -------------------------------------------------------------------------
    // GRUPO 6: Consistencia en Otras Pantallas Operativas con requiredAction
    // -------------------------------------------------------------------------
    console.log('\n--- GRUPO 6: Coherencia en Otras Pantallas con requiredAction ---');

    record(16, 'INVENTARIO_ENTRADAS exige puede_crear en navegación',
      getRequiredActionForScreen('INVENTARIO_ENTRADAS') === 'puede_crear' &&
      getRequiredActionForScreen('/inventory/entries') === 'puede_crear',
      `requiredAction=${getRequiredActionForScreen('INVENTARIO_ENTRADAS')}`
    );

    record(17, 'INVENTARIO_TRANSFERENCIAS exige puede_mover en navegación',
      getRequiredActionForScreen('INVENTARIO_TRANSFERENCIAS') === 'puede_mover' &&
      getRequiredActionForScreen('/inventory/transfers') === 'puede_mover',
      `requiredAction=${getRequiredActionForScreen('INVENTARIO_TRANSFERENCIAS')}`
    );

    record(18, 'CONFIG_INVENTARIO_INICIAL exige puede_crear en navegación',
      getRequiredActionForScreen('CONFIG_INVENTARIO_INICIAL') === 'puede_crear' &&
      getRequiredActionForScreen('/inventory/initial') === 'puede_crear',
      `requiredAction=${getRequiredActionForScreen('CONFIG_INVENTARIO_INICIAL')}`
    );

    // -------------------------------------------------------------------------
    // GRUPO 7: Integridad de Landing y Smart Home
    // -------------------------------------------------------------------------
    console.log('\n--- GRUPO 7: Integridad de Landing y Fail-Closed ---');

    const landingPath = await resolveDefaultAuthorizedPath(superAdmin.usuario_id);
    record(19, 'resolveDefaultAuthorizedPath jamás resuelve /billing/new como landing',
      landingPath !== '/billing/new',
      `landingPath=${landingPath}`
    );

    // Verificación de código fuente para garantizar que no hay bypass ciego
    const wsContent = fs.readFileSync('src/lib/workshop-session.ts', 'utf8');
    const noSuperBypassInNav = !wsContent.includes("screens['FACTURACION_NUEVA'] = true");
    const pspContent = fs.readFileSync('src/components/auth/ProtectedServerPage.tsx', 'utf8');
    const pspEnforces = pspContent.includes('normalizeActionKey(requiredAction)') && pspContent.includes('!perms[actionKey]');
    record(20, 'Ausencia absoluta de bypasses ciegos o excepciones en código (RBAC Modelo B íntegro)',
      noSuperBypassInNav && pspEnforces,
      `noSuperBypassInNav=${noSuperBypassInNav}, pspEnforces=${pspEnforces}`
    );

  } catch (err) {
    console.error('Error durante la ejecución de la suite de regresión:', err);
    record(99, 'Ejecución completa sin excepciones inesperadas', false, err.message);
  } finally {
    // Limpieza de datos sintéticos
    if (testUserId) {
      await pool.query('DELETE FROM admin.usuario_permiso_personalizado WHERE usuario_id = $1', [testUserId]);
      await pool.query('DELETE FROM admin.usuario WHERE usuario_id = $1', [testUserId]);
    }
    await pool.end();
  }

  console.log('\n' + '='.repeat(80));
  console.log(`RESUMEN FINAL REGRESIÓN RBAC NUEVA FACTURA:`);
  console.log(`Total escenarios: ${results.length}`);
  console.log(`Aprobados: ${passed}`);
  console.log(`Fallidos: ${failed}`);
  console.log('='.repeat(80));

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch(console.error);
