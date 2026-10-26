/**
 * RIDE LAB — AJUSTE DE NAVEGACIÓN
 * SUITE DE VALIDACIÓN: REUBICAR NIVELES DE CLIENTES EN CONFIGURACIONES
 * 
 * Verifica exhaustivamente:
 * 1. Estructura canónica del Sidebar (CANONICAL_NAVIGATION).
 * 2. Catálogo de base de datos (admin.pantalla_sistema).
 * 3. Matriz de permisos RBAC por rol funcional (admin.matriz_acceso_pantalla).
 * 4. Visibilidad y filtrado Fail-Closed en Sidebar por rol (Sidebar logic simulation).
 * 5. Protección server-side de acceso directo a la ruta (/crm/client-levels).
 * 6. Integridad de API y selectores (/api/crm/niveles-cliente).
 * 7. Registro de migración 049 en admin.schema_migrations.
 */

const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { Pool } = require('pg');
require('./register-ts');

const envConfig = dotenv.parse(fs.readFileSync('.env.test.local'));
process.env.DATABASE_URL = envConfig.DATABASE_URL;
const pool = new Pool({ connectionString: envConfig.DATABASE_URL });

const { CANONICAL_NAVIGATION, normalizeCode } = require('../src/config/navigationConfig');
const { 
  getWorkshopSession,
  getModulePermissions,
  getScreenPermissions,
  getUserNavigationPermissions,
  canUser
} = require('../src/lib/workshop-session');

const BASE_URL = 'http://127.0.0.1:3000';

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function makeHttpRequest(urlPath, sessionToken = null, method = 'GET', bodyData = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const headers = { 'User-Agent': 'TestNavRelocate/1.0' };
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
        try { json = JSON.parse(data); } catch {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error(`Timeout requesting ${urlPath}`));
    });

    if (bodyData) {
      req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
    }
    req.end();
  });
}

/**
 * Simula el renderizado exacto del Sidebar tal como lo implementa Sidebar.tsx
 */
function simulateSidebarMenu(navPerms) {
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
      return hasMenuPerm;
    });

    if (menu.screens.length > 0 && visibleScreens.length === 0) {
      return null;
    }
    if (menu.screens.length === 0 && !hasMenuPerm) {
      return null;
    }

    return {
      id: menu.id,
      nombre: menu.nombre,
      codigo: menu.codigo,
      screens: visibleScreens.map(s => ({
        id: s.id,
        codigo: s.codigo,
        nombre: s.nombre,
        ruta: s.ruta
      }))
    };
  }).filter(Boolean);
}

async function runTestSuite() {
  console.log('======================================================================');
  console.log('--- VALIDACIÓN DE AJUSTE DE NAVEGACIÓN: NIVELES DE CLIENTES ---');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function record(num, name, condition, details = '') {
    if (condition) {
      passed++;
      console.log(`✅ PASS [Validación ${String(num).padStart(2, '0')}] ${name}`);
    } else {
      failed++;
      console.log(`❌ FAIL [Validación ${String(num).padStart(2, '0')}] ${name}`);
    }
    if (details) console.log(`   Detalle: ${details}`);
  }

  const client = await pool.connect();
  const createdSessions = [];

  async function createTestSession(userId) {
    const rawToken = 'testnav_' + crypto.randomBytes(24).toString('hex');
    const tokenHash = hashSessionToken(rawToken);
    const res = await client.query(`
      INSERT INTO admin.usuario_sesion (
        usuario_id, token_identificador, dispositivo_navegador, direccion_ip,
        ubicacion, fecha_inicio, ultima_actividad, fecha_expiracion, estado
      ) VALUES (
        $1, $2, 'TestNav Agent', '127.0.0.1', 'Localhost',
        NOW(), NOW(), NOW() + INTERVAL '1 hour', 'ACTIVA'
      ) RETURNING sesion_id
    `, [userId, tokenHash]);
    createdSessions.push(res.rows[0].sesion_id);
    return rawToken;
  }

  try {
    // ------------------------------------------------------------------
    // 1. CANONICAL_NAVIGATION: Aparece exactamente 1 vez y en Configuraciones
    // ------------------------------------------------------------------
    const allMatches = [];
    for (const menu of CANONICAL_NAVIGATION) {
      for (const scr of menu.screens) {
        if (
          scr.codigo.includes('NIVELES_CLIENTES') ||
          scr.ruta === '/crm/client-levels' ||
          scr.nombre.toLowerCase().includes('niveles de clientes')
        ) {
          allMatches.push({ menuId: menu.id, ...scr });
        }
      }
    }

    const crmMenu = CANONICAL_NAVIGATION.find(m => m.id === 'crm');
    const configMenu = CANONICAL_NAVIGATION.find(m => m.id === 'configuracion');

    const inCrm = crmMenu?.screens.some(s => s.ruta === '/crm/client-levels' || s.codigo.includes('NIVELES'));
    const inConfig = configMenu?.screens.some(s => s.ruta === '/crm/client-levels' && s.codigo === 'CONFIG_NIVELES_CLIENTES');
    const configItem = configMenu?.screens.find(s => s.codigo === 'CONFIG_NIVELES_CLIENTES');

    record(
      1,
      "Niveles de Clientes aparece exclusivamente en menú CONFIGURACIÓN (1 sola vez)",
      allMatches.length === 1 && !inCrm && inConfig,
      `Total apariciones: ${allMatches.length}, En CRM: ${inCrm}, En Configuración: ${inConfig}`
    );

    record(
      2,
      "Orden, ruta y código canónico respetados en menú CONFIGURACIÓN",
      configItem && configItem.orden === 10 && configItem.ruta === '/crm/client-levels' && configItem.codigo === 'CONFIG_NIVELES_CLIENTES',
      `orden: ${configItem?.orden}, ruta: '${configItem?.ruta}', codigo: '${configItem?.codigo}'`
    );

    // ------------------------------------------------------------------
    // 2. Base de datos: admin.pantalla_sistema
    // ------------------------------------------------------------------
    const dbScreensRes = await client.query(`
      SELECT ps.pantalla_id, ps.codigo, ps.nombre, ps.ruta, ps.orden, ps.activo, ms.nombre as modulo_nombre
      FROM admin.pantalla_sistema ps
      JOIN admin.modulo_sistema ms ON ps.modulo_sistema_id = ms.modulo_sistema_id
      WHERE ps.codigo = 'CONFIG_NIVELES_CLIENTES'
    `);
    const dbConfigScreen = dbScreensRes.rows[0];

    record(
      3,
      "admin.pantalla_sistema registra CONFIG_NIVELES_CLIENTES activo bajo CONFIGURACIÓN",
      dbConfigScreen && dbConfigScreen.activo === true && dbConfigScreen.modulo_nombre.toUpperCase().includes('CONFIGURACI'),
      `pantalla_id: ${dbConfigScreen?.pantalla_id}, módulo: '${dbConfigScreen?.modulo_nombre}', activo: ${dbConfigScreen?.activo}`
    );

    // ------------------------------------------------------------------
    // 3. Matriz RBAC en admin.matriz_acceso_pantalla
    // ------------------------------------------------------------------
    const rbacRes = await client.query(`
      SELECT 
        rf.rol_funcional_id, rf.nombre as rol_nombre,
        map.puede_ver, map.puede_crear, map.puede_editar, map.puede_exportar
      FROM admin.matriz_acceso_pantalla map
      JOIN admin.rol_funcional rf ON map.rol_funcional_id = rf.rol_funcional_id
      WHERE map.pantalla_id = $1
      ORDER BY rf.rol_funcional_id
    `, [dbConfigScreen.pantalla_id]);

    const permsByRole = {};
    rbacRes.rows.forEach(r => { permsByRole[r.rol_funcional_id] = r; });

    const rol1Ok = permsByRole[1]?.puede_ver === true && permsByRole[1]?.puede_crear === true;
    const rol2Ok = permsByRole[2]?.puede_ver === true && permsByRole[2]?.puede_crear === true && permsByRole[2]?.puede_editar === true;
    const rol3Ok = permsByRole[3]?.puede_ver === true && permsByRole[3]?.puede_crear === true && permsByRole[3]?.puede_editar === true;
    const rol6Ok = permsByRole[6]?.puede_ver === true && permsByRole[6]?.puede_crear === false;
    const rol7Ok = permsByRole[7]?.puede_ver === true && permsByRole[7]?.puede_crear === false;
    const rol4Ok = permsByRole[4]?.puede_ver === false;
    const rol8Ok = permsByRole[8]?.puede_ver === false;
    const rol9Ok = permsByRole[9]?.puede_ver === false;

    record(
      4,
      "Roles legítimos (1, 2, 3, 6, 7) conservan permisos de visualización sin pérdida",
      rol1Ok && rol2Ok && rol3Ok && rol6Ok && rol7Ok,
      `Rol 1: ${permsByRole[1]?.puede_ver}, Rol 2: ${permsByRole[2]?.puede_ver}, Rol 3: ${permsByRole[3]?.puede_ver}, Rol 6: ${permsByRole[6]?.puede_ver}, Rol 7: ${permsByRole[7]?.puede_ver}`
    );

    record(
      5,
      "Roles no autorizados (4, 8, 9) no reciben privilegios indebidos (Fail-Closed)",
      rol4Ok && rol8Ok && rol9Ok,
      `Rol 4 (Ruta): ${permsByRole[4]?.puede_ver}, Rol 8 (Consulta): ${permsByRole[8]?.puede_ver}, Rol 9 (Soporte): ${permsByRole[9]?.puede_ver}`
    );

    // ------------------------------------------------------------------
    // 4. Sidebar dinámico para usuarios por rol
    // ------------------------------------------------------------------
    // Crear un usuario sintético de prueba y probar navegación para cada rol
    const maxUserIdRes = await client.query("SELECT COALESCE(MAX(usuario_id), 0) + 1 AS next_id FROM admin.usuario");
    const testUserId = maxUserIdRes.rows[0].next_id;

    await client.query(`
      INSERT INTO admin.usuario (usuario_id, empresa_id, rol_principal_id, tipo_usuario_id, estado, fecha_creacion, fecha_actualizacion)
      VALUES ($1, 1, 2, 1, 'ACTIVO', clock_timestamp(), clock_timestamp())
    `, [testUserId]);

    // Test con Rol 2 (Admin Empresa)
    const navRol2 = await getUserNavigationPermissions(testUserId);
    const sidebarRol2 = simulateSidebarMenu(navRol2);
    const crmRol2 = sidebarRol2.find(m => m.id === 'crm');
    const configRol2 = sidebarRol2.find(m => m.id === 'configuracion');
    const levelsInConfigRol2 = configRol2?.screens.some(s => s.codigo === 'CONFIG_NIVELES_CLIENTES');
    const levelsInCrmRol2 = crmRol2?.screens.some(s => s.ruta === '/crm/client-levels');

    record(
      6,
      "Sidebar de Administrador (Rol 2) muestra Niveles en Configuración y no en CRM",
      levelsInConfigRol2 && !levelsInCrmRol2,
      `En Config: ${levelsInConfigRol2}, En CRM: ${levelsInCrmRol2}`
    );

    // Test con Rol 7 (Analista Comercial): Solo tiene Niveles en Configuración (no otras pantallas de Config)
    await client.query("UPDATE admin.usuario SET rol_principal_id = 7 WHERE usuario_id = $1", [testUserId]);
    const navRol7 = await getUserNavigationPermissions(testUserId);
    const sidebarRol7 = simulateSidebarMenu(navRol7);
    const configRol7 = sidebarRol7.find(m => m.id === 'configuracion');
    const crmRol7 = sidebarRol7.find(m => m.id === 'crm');
    const levelsInConfigRol7 = configRol7?.screens.some(s => s.codigo === 'CONFIG_NIVELES_CLIENTES');
    const levelsInCrmRol7 = crmRol7?.screens.some(s => s.ruta === '/crm/client-levels');

    record(
      7,
      "Analista Comercial (Rol 7) ve expandible Configuración exclusivamente por Niveles de Clientes",
      configRol7 !== undefined && levelsInConfigRol7 && !levelsInCrmRol7 && configRol7.screens.length === 1,
      `Menu Config visible: ${Boolean(configRol7)}, Pantallas en Config: ${configRol7?.screens.length}, En CRM: ${levelsInCrmRol7}`
    );

    // Test con Rol 9 (Soporte Técnico): No debe ver Niveles de Clientes
    await client.query("UPDATE admin.usuario SET rol_principal_id = 9 WHERE usuario_id = $1", [testUserId]);
    const navRol9 = await getUserNavigationPermissions(testUserId);
    const sidebarRol9 = simulateSidebarMenu(navRol9);
    const configRol9 = sidebarRol9.find(m => m.id === 'configuracion');
    const levelsInConfigRol9 = configRol9?.screens.some(s => s.codigo === 'CONFIG_NIVELES_CLIENTES');

    record(
      8,
      "Soporte Técnico (Rol 9) no ve Niveles de Clientes en Configuración ni en CRM",
      !levelsInConfigRol9,
      `Niveles en Config: ${levelsInConfigRol9}`
    );

    // ------------------------------------------------------------------
    // 5. Protección de ruta directa (/crm/client-levels) y URL
    // ------------------------------------------------------------------
    // Rol 2 (Autorizado) vs Rol 9 (No Autorizado)
    const permsDirectAuth = await getScreenPermissions('CONFIG_NIVELES_CLIENTES', 1); // SuperAdmin
    const permsDirectDenied = await getScreenPermissions('CONFIG_NIVELES_CLIENTES', testUserId); // Rol 9

    record(
      9,
      "Protección server-side (getScreenPermissions): Permite a autorizados y bloquea no autorizados",
      permsDirectAuth.puede_ver === true && permsDirectDenied.puede_ver === false,
      `SuperAdmin puede_ver: ${permsDirectAuth.puede_ver}, Rol 9 puede_ver: ${permsDirectDenied.puede_ver}`
    );

    // Limpiar usuario sintético
    await client.query("DELETE FROM admin.usuario WHERE usuario_id = $1", [testUserId]);

    // ------------------------------------------------------------------
    // 6. Integridad de APIs y selectores
    // ------------------------------------------------------------------
    // Probar GET /api/crm/niveles-cliente?activos=true usando sesión de admin
    const adminUserRes = await client.query("SELECT usuario_id FROM admin.usuario WHERE rol_principal_id = 1 AND estado = 'ACTIVO' LIMIT 1");
    const adminToken = await createTestSession(adminUserRes.rows[0].usuario_id);

    const apiRes = await makeHttpRequest('/api/crm/niveles-cliente?activos=true', adminToken);
    const hasData = apiRes.statusCode === 200 && Array.isArray(apiRes.json?.data) && apiRes.json?.data.length > 0;
    const firstLevel = apiRes.json?.data?.[0];

    record(
      10,
      "API /api/crm/niveles-cliente responde HTTP 200 con estructura de niveles intacta",
      hasData && firstLevel && firstLevel.descuento_servicio !== undefined && firstLevel.descuento_producto !== undefined,
      `Status: ${apiRes.statusCode}, Niveles retornados: ${apiRes.json?.data?.length}, Ejemplo: ${firstLevel?.nombre} (serv: ${firstLevel?.descuento_servicio}%, prod: ${firstLevel?.descuento_producto}%)`
    );

    // ------------------------------------------------------------------
    // 7. Registro auditable de migración 049 en admin.schema_migrations
    // ------------------------------------------------------------------
    const mig049Res = await client.query("SELECT * FROM admin.schema_migrations WHERE migration_id = '049_relocate_client_levels_to_config.sql'");
    const mig049 = mig049Res.rows[0];

    record(
      11,
      "Migración 049 registrada con estado APPLIED en admin.schema_migrations",
      mig049 && mig049.status === 'APPLIED',
      `migration_id: '${mig049?.migration_id}', status: '${mig049?.status}', sequence: ${mig049?.sequence_number}`
    );

  } finally {
    // Limpieza de sesiones de prueba
    if (createdSessions.length > 0) {
      await client.query(`DELETE FROM admin.usuario_sesion WHERE sesion_id = ANY($1::int[])`, [createdSessions]);
    }
    client.release();
    await pool.end();
  }

  console.log('\n======================================================================');
  console.log(`TOTAL PRUEBAS: ${passed + failed} | PASARON: ${passed} | FALLARON: ${failed}`);
  console.log(`RESULTADO GLOBAL: ${failed === 0 ? '✅ APROBADO 100%' : '❌ FALLARON PRUEBAS'}`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error("Error inesperado en suite de pruebas:", err);
  process.exit(1);
});
