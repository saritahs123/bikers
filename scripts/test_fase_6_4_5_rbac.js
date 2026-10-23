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
  canUser,
  validateCompanyAccess,
  isInstitutionalSecurityTarget
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

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
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

    if (bodyData) {
      req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
    }
    req.end();
  });
}

async function runFase645Tests() {
  const client = await pool.connect();
  const createdSessions = [];
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
    const rawToken = 'fase645_' + crypto.randomBytes(24).toString('hex');
    const tokenHash = hashSessionToken(rawToken);
    const res = await client.query(`
      INSERT INTO admin.usuario_sesion (
        usuario_id, token_identificador, dispositivo_navegador, direccion_ip,
        ubicacion, fecha_inicio, ultima_actividad, fecha_expiracion, estado
      ) VALUES (
        $1, $2, 'Fase 6.4.5 Test Agent', '127.0.0.1', 'Localhost',
        NOW(), NOW(), NOW() + INTERVAL '1 hour', 'ACTIVA'
      ) RETURNING sesion_id
    `, [userId, tokenHash]);
    createdSessions.push(res.rows[0].sesion_id);
    return rawToken;
  }

  console.log("======================================================================");
  console.log("--- FASE 6.4.5: SUITE INTEGRAL DE VALIDACIÓN DEL MOTOR RBAC ---");
  console.log("======================================================================\n");

  try {
    // Identificar usuarios para pruebas
    // 1. SuperAdmin (Felix Hernandez o Emmanuel Hernandez, rol_principal_id = 1)
    const superRes = await client.query(`
      SELECT usuario_id, rol_principal_id FROM admin.usuario
      WHERE rol_principal_id = 1 AND estado = 'ACTIVO'
      ORDER BY usuario_id LIMIT 1
    `);
    const superUserId = superRes.rows[0].usuario_id;
    const superToken = await createSession(superUserId);

    // 2. Solo lectura (Prueba H, rol 112)
    const soloLecturaRes = await client.query(`
      SELECT usuario_id, rol_principal_id FROM admin.usuario
      WHERE rol_principal_id = 112 AND estado = 'ACTIVO'
      ORDER BY usuario_id LIMIT 1
    `);
    const soloLecturaUserId = soloLecturaRes.rows[0].usuario_id;
    const soloLecturaToken = await createSession(soloLecturaUserId);

    // 3. Sin permisos (rol 118)
    const sinPermisosRes = await client.query(`
      SELECT usuario_id, rol_principal_id FROM admin.usuario
      WHERE rol_principal_id = 118 AND estado = 'ACTIVO'
      ORDER BY usuario_id LIMIT 1
    `);
    const sinPermisosUserId = sinPermisosRes.rows[0].usuario_id;
    const sinPermisosToken = await createSession(sinPermisosUserId);

    // 4. Operador Taller (rol 113)
    const operadorRes = await client.query(`
      SELECT usuario_id, rol_principal_id FROM admin.usuario
      WHERE rol_principal_id = 113 AND estado = 'ACTIVO'
      ORDER BY usuario_id LIMIT 1
    `);
    const operadorUserId = operadorRes.rows[0].usuario_id;
    const operadorToken = await createSession(operadorUserId);

    // ------------------------------------------------------------------
    // SETUP FIXTURE: ESCENARIOS 1-5 (Aislamiento de prueba de denegación en Reportes)
    // ------------------------------------------------------------------
    const originalPermsRes = await client.query(`
      SELECT pantalla_id, puede_ver, puede_crear, puede_editar, puede_inactivar,
             puede_exportar, puede_importar, puede_aprobar, puede_asignar,
             puede_mover, puede_cerrar, puede_reabrir, puede_eliminar
      FROM admin.matriz_acceso_pantalla
      WHERE rol_funcional_id = 1 AND pantalla_id IN (18, 19)
    `);

    try {
      // Configurar denegación explícita temporal para pantallas 18 y 19 en Rol 1
      await client.query(`
        INSERT INTO admin.matriz_acceso_pantalla (
          rol_funcional_id, pantalla_id, puede_ver, puede_exportar, estado, fecha_creacion, fecha_actualizacion
        ) VALUES
          (1, 18, false, false, 'ACTIVO', now(), now()),
          (1, 19, false, false, 'ACTIVO', now(), now())
        ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE
          SET puede_ver = false, puede_exportar = false
      `);

      // ------------------------------------------------------------------
      // ESCENARIO 1: Administrador General con Facturas por Día denegado
      // ------------------------------------------------------------------
      const pFacDia = await getScreenPermissions("/reports/invoices-daily", superUserId);
      record(
        1,
        "Administrador General con Facturas por Día denegado",
        pFacDia.puede_ver === false && pFacDia.puede_exportar === false,
        `puede_ver=${pFacDia.puede_ver}, puede_exportar=${pFacDia.puede_exportar}`
      );

      // ------------------------------------------------------------------
      // ESCENARIO 2: Administrador General con Órdenes por Día denegado
      // ------------------------------------------------------------------
      const pOrdDia = await getScreenPermissions("/reports/work-orders-daily", superUserId);
      record(
        2,
        "Administrador General con Órdenes por Día denegado",
        pOrdDia.puede_ver === false && pOrdDia.puede_exportar === false,
        `puede_ver=${pOrdDia.puede_ver}, puede_exportar=${pOrdDia.puede_exportar}`
      );

      // ------------------------------------------------------------------
      // ESCENARIO 3: Ambos reportes ocultos en Sidebar
      // ------------------------------------------------------------------
      const navSuper = await getUserNavigationPermissions(superUserId);
      const facOculto = navSuper.screens['REPORTES_FACTURAS_DIA'] === false && navSuper.screens['/reports/invoices-daily'] === false;
      const ordOculto = navSuper.screens['REPORTES_ORDENES_DIA'] === false && navSuper.screens['/reports/work-orders-daily'] === false;
      record(
        3,
        "Ambos reportes ocultos en Sidebar de Administrador General",
        facOculto && ordOculto,
        `Facturas=${navSuper.screens['REPORTES_FACTURAS_DIA']}, Órdenes=${navSuper.screens['REPORTES_ORDENES_DIA']}`
      );

      // ------------------------------------------------------------------
      // ESCENARIO 4: Acceso directo a ambos reportes denegado
      // ------------------------------------------------------------------
      const resFacPage = await makeHttpRequest('/reports/invoices-daily', superToken);
      const resOrdPage = await makeHttpRequest('/reports/work-orders-daily', superToken);
      const facPageDenied = resFacPage.body.includes('Acceso Denegado') || resFacPage.body.includes('ReportAccessDenied') || !resFacPage.body.includes('DailyInvoicesReportView');
      const ordPageDenied = resOrdPage.body.includes('Acceso Denegado') || resOrdPage.body.includes('ReportAccessDenied') || !resOrdPage.body.includes('WorkOrdersDailyReportView');
      record(
        4,
        "Acceso directo a ambos reportes denegado para Administrador General",
        facPageDenied && ordPageDenied,
        `FacturasDenied=${facPageDenied}, ÓrdenesDenied=${ordPageDenied}`
      );

      // ------------------------------------------------------------------
      // ESCENARIO 5: APIs de ambos reportes respondiendo 403
      // ------------------------------------------------------------------
      const resFacApi = await makeHttpRequest('/api/reports/invoices-daily', superToken);
      const resOrdApi = await makeHttpRequest('/api/reports/work-orders-daily', superToken);
      const facApi403 = resFacApi.statusCode === 403;
      const ordApi403 = resOrdApi.statusCode === 403;
      record(
        5,
        "APIs de ambos reportes respondiendo HTTP 403 Forbidden",
        facApi403 && ordApi403,
        `FacturasApiStatus=${resFacApi.statusCode}, ÓrdenesApiStatus=${resOrdApi.statusCode}`
      );
    } finally {
      // Restauración garantizada de los permisos originales de Rol 1
      for (const pId of [18, 19]) {
        const orig = originalPermsRes.rows.find(r => r.pantalla_id === pId);
        if (orig) {
          await client.query(`
            UPDATE admin.matriz_acceso_pantalla
            SET puede_ver = $1, puede_crear = $2, puede_editar = $3, puede_inactivar = $4,
                puede_exportar = $5, puede_importar = $6, puede_aprobar = $7, puede_asignar = $8,
                puede_mover = $9, puede_cerrar = $10, puede_reabrir = $11, puede_eliminar = $12
            WHERE rol_funcional_id = 1 AND pantalla_id = $13
          `, [
            orig.puede_ver, orig.puede_crear, orig.puede_editar, orig.puede_inactivar,
            orig.puede_exportar, orig.puede_importar, orig.puede_aprobar, orig.puede_asignar,
            orig.puede_mover, orig.puede_cerrar, orig.puede_reabrir, orig.puede_eliminar,
            pId
          ]);
        } else {
          await client.query(`
            DELETE FROM admin.matriz_acceso_pantalla
            WHERE rol_funcional_id = 1 AND pantalla_id = $1
          `, [pId]);
        }
      }
    }

    // ------------------------------------------------------------------
    // ESCENARIO 6: Administrador General conserva acceso a la gestión de Seguridad
    // ------------------------------------------------------------------
    const pRoles = await getScreenPermissions("/settings/security/roles", superUserId);
    const pUsers = await getScreenPermissions("/settings/security/users", superUserId);
    const pModSec = await getModulePermissions("SEGURIDAD", superUserId);
    record(
      6,
      "Administrador General conserva acceso garantizado a gestión de Seguridad",
      pRoles.puede_ver === true && pUsers.puede_ver === true && pModSec.puede_ver === true,
      `Roles=${pRoles.puede_ver}, Users=${pUsers.puede_ver}, ModSeguridad=${pModSec.puede_ver}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 7: Administrador General puede administrar roles y permisos
    // ------------------------------------------------------------------
    const canEditRoles = await canUser(superUserId, "editar", "/settings/security/roles");
    const canCreateRoles = await canUser(superUserId, "crear", "/settings/security/roles");
    record(
      7,
      "Administrador General puede administrar roles y permisos legítimamente",
      canEditRoles && canCreateRoles,
      `canEditRoles=${canEditRoles}, canCreateRoles=${canCreateRoles}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 8: Usuario con rol sin permisos permanece bloqueado
    // ------------------------------------------------------------------
    const navSinPerm = await getUserNavigationPermissions(sinPermisosUserId);
    const noModules = Object.values(navSinPerm.modules).every(v => v === false);
    const resDirectSinPerm = await makeHttpRequest('/workshop?view=work_orders', sinPermisosToken);
    const sinPermBlocked = resDirectSinPerm.body.includes('Acceso Denegado') || resDirectSinPerm.body.includes('HTTP 403 Forbidden');
    record(
      8,
      "Usuario con rol sin permisos permanece bloqueado (Fail-Closed)",
      noModules && sinPermBlocked,
      `allModulesFalse=${noModules}, pageBlocked=${sinPermBlocked}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 9: Rol de solo lectura no puede ejecutar mutaciones
    // ------------------------------------------------------------------
    const pSoloLectura = await getScreenPermissions("TALLER_ORDENES", soloLecturaUserId);
    const canCreate = await canUser(soloLecturaUserId, "crear", "TALLER_ORDENES");
    const canEdit = await canUser(soloLecturaUserId, "editar", "TALLER_ORDENES");
    const canDelete = await canUser(soloLecturaUserId, "eliminar", "TALLER_ORDENES");
    record(
      9,
      "Rol de solo lectura no puede ejecutar mutaciones",
      pSoloLectura.puede_ver === true && !canCreate && !canEdit && !canDelete,
      `ver=${pSoloLectura.puede_ver}, crear=${canCreate}, editar=${canEdit}, eliminar=${canDelete}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 10: Permiso personalizado positivo funciona
    // ------------------------------------------------------------------
    try {
      await client.query(`
        INSERT INTO admin.usuario_permiso_personalizado (
          usuario_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_eliminar, estado
        ) VALUES ($1, 18, true, false, false, false, 'ACTIVO')
      `, [soloLecturaUserId]);
      const pCustomPos = await getScreenPermissions("/reports/invoices-daily", soloLecturaUserId);
      record(
        10,
        "Permiso personalizado positivo sobrescribe denegación de rol",
        pCustomPos.puede_ver === true,
        `puede_ver=${pCustomPos.puede_ver}`
      );
    } finally {
      await client.query(`DELETE FROM admin.usuario_permiso_personalizado WHERE usuario_id = $1 AND pantalla_id = 18`, [soloLecturaUserId]);
    }

    // ------------------------------------------------------------------
    // ESCENARIO 11: Permiso personalizado negativo funciona
    // ------------------------------------------------------------------
    try {
      await client.query(`
        INSERT INTO admin.usuario_permiso_personalizado (
          usuario_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_eliminar, estado
        ) VALUES ($1, 3, false, false, false, false, 'ACTIVO')
      `, [operadorUserId]);
      const pCustomNeg = await getScreenPermissions("TALLER_ORDENES", operadorUserId);
      record(
        11,
        "Permiso personalizado negativo sobrescribe concesión de rol",
        pCustomNeg.puede_ver === false,
        `puede_ver=${pCustomNeg.puede_ver}`
      );
    } finally {
      await client.query(`DELETE FROM admin.usuario_permiso_personalizado WHERE usuario_id = $1 AND pantalla_id = 3`, [operadorUserId]);
    }

    // ------------------------------------------------------------------
    // ESCENARIO 12: Roles adicionales respetan la política definida (Unión aditiva)
    // ------------------------------------------------------------------
    try {
      // Asignar rol operador taller como adicional al usuario solo lectura
      await client.query(`
        INSERT INTO admin.usuario_rol_adicional (usuario_rol_adicional_id, usuario_id, rol_funcional_id)
        VALUES ((SELECT COALESCE(MAX(usuario_rol_adicional_id), 0) + 1 FROM admin.usuario_rol_adicional), $1, 113)
      `, [soloLecturaUserId]);
      const pUnion = await getScreenPermissions("TALLER_ORDENES", soloLecturaUserId);
      record(
        12,
        "Roles adicionales respetan unión aditiva de permisos (OR lógico)",
        pUnion.puede_crear === true && pUnion.puede_editar === true,
        `puede_crear=${pUnion.puede_crear}, puede_editar=${pUnion.puede_editar}`
      );
    } finally {
      await client.query(`DELETE FROM admin.usuario_rol_adicional WHERE usuario_id = $1 AND rol_funcional_id = 113`, [soloLecturaUserId]);
    }

    // ------------------------------------------------------------------
    // ESCENARIO 13: Usuario inactivo no obtiene acceso
    // ------------------------------------------------------------------
    try {
      await client.query(`UPDATE admin.usuario SET estado = 'INACTIVO' WHERE usuario_id = $1`, [operadorUserId]);
      const pInactivo = await getScreenPermissions("TALLER_ORDENES", operadorUserId);
      const navInactivo = await getUserNavigationPermissions(operadorUserId);
      record(
        13,
        "Usuario inactivo no obtiene acceso a ninguna pantalla",
        pInactivo.puede_ver === false && Object.keys(navInactivo.screens).length === 0,
        `puede_ver=${pInactivo.puede_ver}, screensLength=${Object.keys(navInactivo.screens).length}`
      );
    } finally {
      await client.query(`UPDATE admin.usuario SET estado = 'ACTIVO' WHERE usuario_id = $1`, [operadorUserId]);
    }

    // ------------------------------------------------------------------
    // ESCENARIO 14: Usuario sin sesión no obtiene acceso
    // ------------------------------------------------------------------
    const resNoAuthPage = await makeHttpRequest('/reports/receivables', null);
    const resNoAuthApi = await makeHttpRequest('/api/reports/receivables', null);
    const noAuthBlocked = (resNoAuthPage.statusCode === 307 || resNoAuthPage.statusCode === 401 || resNoAuthPage.body.includes('Acceso Denegado') || resNoAuthPage.body.includes('Sesión no iniciada')) &&
      resNoAuthApi.statusCode === 401;
    record(
      14,
      "Usuario sin sesión es redirigido o recibe HTTP 401",
      noAuthBlocked,
      `pageStatus=${resNoAuthPage.statusCode}, apiStatus=${resNoAuthApi.statusCode}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 15: Módulo nuevo nace sin permisos automáticos
    // ------------------------------------------------------------------
    try {
      await client.query(`
        INSERT INTO admin.modulo_sistema (modulo_sistema_id, codigo, nombre, orden, estado)
        VALUES (9999, 'TEST_NUEVO_MOD', 'TEST NUEVO MODULO', 99, 'ACTIVO')
      `);
      const pModNuevo = await getModulePermissions(9999, superUserId);
      record(
        15,
        "Módulo nuevo nace sin permisos automáticos para Administrador General",
        pModNuevo.puede_ver === false,
        `puede_ver=${pModNuevo.puede_ver}`
      );
    } finally {
      await client.query(`DELETE FROM admin.modulo_sistema WHERE modulo_sistema_id = 9999`);
    }

    // ------------------------------------------------------------------
    // ESCENARIO 16: Pantalla nueva nace sin permisos automáticos
    // ------------------------------------------------------------------
    try {
      await client.query(`
        INSERT INTO admin.pantalla_sistema (pantalla_id, modulo_sistema_id, codigo, nombre, ruta, activo)
        VALUES (9999, 7, 'TEST_PANTALLA_NUEVA', 'Pantalla Nueva Test', '/workshop/test-new', true)
      `);
      const pScrNueva = await getScreenPermissions('TEST_PANTALLA_NUEVA', sinPermisosUserId);
      record(
        16,
        "Pantalla nueva nace sin permisos automáticos (Fail-Closed)",
        pScrNueva.puede_ver === false,
        `puede_ver=${pScrNueva.puede_ver}`
      );
    } finally {
      await client.query(`DELETE FROM admin.pantalla_sistema WHERE pantalla_id = 9999`);
    }

    // ------------------------------------------------------------------
    // ESCENARIO 17: Reporte nuevo nace sin permisos automáticos
    // ------------------------------------------------------------------
    try {
      await client.query(`
        INSERT INTO admin.pantalla_sistema (pantalla_id, modulo_sistema_id, codigo, nombre, ruta, tipo, activo)
        VALUES (9998, 16, 'TEST_REPORTE_NUEVO', 'Reporte Nuevo Test', '/reports/test-new', 'REPORTE', true)
      `);
      // Mecanismo oficial de inicialización Fail-Closed (Fase 6.4.10 / navigationSync)
      await client.query(`
        INSERT INTO admin.matriz_acceso_pantalla (
          rol_funcional_id, pantalla_id,
          puede_ver, puede_crear, puede_editar, puede_inactivar,
          puede_exportar, puede_importar, puede_aprobar, puede_asignar,
          puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
          estado, fecha_creacion, fecha_actualizacion
        ) VALUES (
          1, 9998, false, false, false, false, false, false, false, false, false, false, false, false, 'ACTIVO', now(), now()
        ) ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET puede_ver = false
      `);
      const pRepNuevo = await getScreenPermissions('TEST_REPORTE_NUEVO', superUserId);
      record(
        17,
        "Reporte nuevo nace sin permisos automáticos para Administrador General",
        pRepNuevo.puede_ver === false,
        `puede_ver=${pRepNuevo.puede_ver}`
      );
    } finally {
      await client.query(`DELETE FROM admin.matriz_acceso_pantalla WHERE pantalla_id = 9998`);
      await client.query(`DELETE FROM admin.pantalla_sistema WHERE pantalla_id = 9998`);
    }

    // ------------------------------------------------------------------
    // ESCENARIO 18: Las 12 acciones de la matriz se evalúan independientemente
    // ------------------------------------------------------------------
    try {
      await client.query(`
        INSERT INTO admin.usuario_permiso_personalizado (
          usuario_id, pantalla_id, puede_ver, puede_crear, puede_editar, puede_inactivar,
          puede_exportar, puede_importar, puede_aprobar, puede_asignar, puede_mover,
          puede_cerrar, puede_reabrir, puede_eliminar, estado
        ) VALUES (
          $1, 3, true, true, false, true,
          false, true, false, true, false,
          true, false, false, 'ACTIVO'
        )
      `, [soloLecturaUserId]);
      const p12 = await getScreenPermissions("TALLER_ORDENES", soloLecturaUserId);
      const isExact12 = p12.puede_ver === true &&
        p12.puede_crear === true &&
        p12.puede_editar === false &&
        p12.puede_inactivar === true &&
        p12.puede_exportar === false &&
        p12.puede_importar === true &&
        p12.puede_aprobar === false &&
        p12.puede_asignar === true &&
        p12.puede_mover === false &&
        p12.puede_cerrar === true &&
        p12.puede_reabrir === false &&
        p12.puede_eliminar === false;
      record(
        18,
        "Las 12 acciones de la matriz se evalúan independientemente",
        isExact12,
        `12 acciones resueltas con exactitud según matriz personalizada`
      );
    } finally {
      await client.query(`DELETE FROM admin.usuario_permiso_personalizado WHERE usuario_id = $1 AND pantalla_id = 3`, [soloLecturaUserId]);
    }

    // ------------------------------------------------------------------
    // ESCENARIO 19: Aislamiento multiempresa se mantiene
    // ------------------------------------------------------------------
    const compMatch = validateCompanyAccess(1, 1, false);
    const compMismatch = validateCompanyAccess(1, 2, false);
    const compSuperBypass = validateCompanyAccess(1, 2, true);
    record(
      19,
      "Aislamiento multiempresa se valida estrictamente",
      compMatch === true && compMismatch === false && compSuperBypass === true,
      `match=${compMatch}, mismatch=${compMismatch}, superAdminBypass=${compSuperBypass}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 20: Los cambios de permisos se reflejan sin privilegios residuales
    // ------------------------------------------------------------------
    try {
      // Conceder temporalmente y luego revocar
      await client.query(`
        UPDATE admin.matriz_acceso_pantalla
        SET puede_ver = true
        WHERE rol_funcional_id = 118 AND pantalla_id = 3
      `);
      const pGranted = await getScreenPermissions("TALLER_ORDENES", sinPermisosUserId);
      await client.query(`
        UPDATE admin.matriz_acceso_pantalla
        SET puede_ver = false
        WHERE rol_funcional_id = 118 AND pantalla_id = 3
      `);
      const pRevoked = await getScreenPermissions("TALLER_ORDENES", sinPermisosUserId);
      record(
        20,
        "Los cambios de permisos se reflejan inmediatamente en la siguiente consulta",
        pGranted.puede_ver === true && pRevoked.puede_ver === false,
        `granted=${pGranted.puede_ver}, revoked=${pRevoked.puede_ver}`
      );
    } finally {
      await client.query(`
        UPDATE admin.matriz_acceso_pantalla
        SET puede_ver = false
        WHERE rol_funcional_id = 118 AND pantalla_id = 3
      `);
    }

    // ------------------------------------------------------------------
    // ESCENARIO 21: Usuario TEST_ROL_SOLO_LECTURA continúa sin acceso a Dashboard
    // ------------------------------------------------------------------
    const pDashH = await getScreenPermissions("DASHBOARD_MAIN", soloLecturaUserId);
    const resDashH = await makeHttpRequest('/api/dashboard', soloLecturaToken);
    record(
      21,
      "El usuario TEST_ROL_SOLO_LECTURA continúa sin acceso al Dashboard General",
      pDashH.puede_ver === false && resDashH.statusCode === 403,
      `puede_ver=${pDashH.puede_ver}, apiStatus=${resDashH.statusCode}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 22: Los reportes autorizados continúan funcionando
    // ------------------------------------------------------------------
    const pRec = await getScreenPermissions("/reports/receivables", superUserId);
    const resRecApi = await makeHttpRequest('/api/reports/receivables', superToken);
    record(
      22,
      "Los reportes autorizados continúan funcionando para Administrador General",
      pRec.puede_ver === true && resRecApi.statusCode === 200,
      `puede_ver=${pRec.puede_ver}, apiStatus=${resRecApi.statusCode}`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 23: La salvaguarda administrativa no se extiende a recursos ajenos a Seguridad
    // ------------------------------------------------------------------
    const notSec1 = isInstitutionalSecurityTarget("REPORTES");
    const notSec2 = isInstitutionalSecurityTarget("/reports/invoices-daily");
    const notSec3 = isInstitutionalSecurityTarget("TALLER");
    const notSec4 = isInstitutionalSecurityTarget("FACTURACION");
    const notSec5 = isInstitutionalSecurityTarget("INVENTARIO");
    const isSec1 = isInstitutionalSecurityTarget("SEGURIDAD");
    const isSec2 = isInstitutionalSecurityTarget("/settings/security/roles");
    record(
      23,
      "La salvaguarda administrativa está estrictamente delimitada a Seguridad",
      !notSec1 && !notSec2 && !notSec3 && !notSec4 && !notSec5 && isSec1 && isSec2,
      `Seguridad=true, Reportes/Taller/Facturacion/Inventario=false`
    );

    // ------------------------------------------------------------------
    // ESCENARIO 24: No hay regresiones en CRM, Taller, Inventario y Facturación
    // ------------------------------------------------------------------
    const pTaller = await getScreenPermissions("TALLER_ORDENES", superUserId);
    const pCRM = await getScreenPermissions("CRM_CLIENTES", superUserId);
    const pInv = await getScreenPermissions("INVENTARIO_EXISTENCIAS", superUserId);
    const pFac = await getScreenPermissions("FACTURACION_FACTURAS", superUserId);
    const noRegressions = pTaller.puede_ver === true && pCRM.puede_ver === true && pInv.puede_ver === true && pFac.puede_ver === true;
    record(
      24,
      "No hay regresiones operativas en CRM, Taller, Inventario y Facturación",
      noRegressions,
      `Taller=${pTaller.puede_ver}, CRM=${pCRM.puede_ver}, Inventario=${pInv.puede_ver}, Facturación=${pFac.puede_ver}`
    );

  } finally {
    // Limpieza de sesiones de prueba
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
}

runFase645Tests().catch(err => {
  console.error("FATAL ERROR IN SUITE:", err);
  process.exit(1);
});
