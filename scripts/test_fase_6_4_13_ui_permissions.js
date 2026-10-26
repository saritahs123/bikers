/**
 * RIDE LAB — FASE 6.4.13: SUITE DE PRUEBAS DE PERMISOS UI Y ENFORCEMENT RBAC
 * Verificación Integral de Cabeceras x-perm-*, Bloqueo Global de UI y Modelo B
 * 
 * Cobertura:
 * - Emisión de cabeceras x-perm-* en todos los endpoints de catálogos y operativos.
 * - Comportamiento Modelo B (SuperAdmin salvaguarda institucional; restricciones operativas si no concedidas).
 * - Usuario solo-lectura: cabeceras con puede_crear=false, puede_editar=false, puede_eliminar=false.
 * - Rechazo server-side (403 FORBIDDEN) a operaciones no autorizadas (POST, PUT, DELETE).
 * - Verificación de acciones granulares (puede_asignar, puede_cerrar, puede_reabrir, puede_mover).
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

async function runFase6413Tests() {
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
    console.log(`${icon} [Escenario ${num}] ${name}`);
    if (details) console.log(`   Detalle: ${details}`);
    testResults.push({ num, name, status, details });
  }

  async function createSession(userId) {
    const rawToken = 'fase6413_' + crypto.randomBytes(24).toString('hex');
    const tokenHash = hashSessionToken(rawToken);
    const res = await client.query(`
      INSERT INTO admin.usuario_sesion (
        usuario_id, token_identificador, dispositivo_navegador, direccion_ip,
        ubicacion, fecha_inicio, ultima_actividad, fecha_expiracion, estado
      ) VALUES (
        $1, $2, 'Fase 6.4.13 Test Agent', '127.0.0.1', 'Localhost',
        NOW(), NOW(), NOW() + INTERVAL '1 hour', 'ACTIVA'
      ) RETURNING sesion_id
    `, [userId, tokenHash]);
    createdSessions.push(res.rows[0].sesion_id);
    return rawToken;
  }

  async function createSyntheticUser({ companyId = 1, roleId = 5, emailPrefix = 'ui_perm_test' }) {
    const email = `${emailPrefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}@testbikers.com`;
    const maxUserRes = await client.query(`SELECT COALESCE(MAX(usuario_id), 0) + 1 AS next_id FROM admin.usuario`);
    const userId = Number(maxUserRes.rows[0].next_id);

    await client.query(`
      INSERT INTO admin.usuario (usuario_id, empresa_id, tipo_usuario_id, rol_principal_id, estado, estado_activacion, duracion_sesion_minutos, fecha_creacion)
      VALUES ($1, $2, 3, $3, 'ACTIVO', 'Activo', 480, NOW())
    `, [userId, companyId, roleId]);

    await client.query(`
      INSERT INTO admin.usuario_identidad (usuario_id, nombre, apellido, correo_electronico, telefono)
      VALUES ($1, 'SynthUI', 'TestUser', $2, '8095550000')
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

  try {
    console.log('='.repeat(78));
    console.log('RIDE LAB — FASE 6.4.13: SUITE DE PRUEBAS DE PERMISOS UI Y ENFORCEMENT RBAC');
    console.log('='.repeat(78));

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

    // 2. Crear rol sintético de Solo Lectura para pruebas
    const maxRfRes = await client.query(`SELECT COALESCE(MAX(rol_funcional_id), 0) + 1 AS next_id FROM admin.rol_funcional`);
    const readOnlyRoleId = Number(maxRfRes.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.rol_funcional (rol_funcional_id, nombre, descripcion, estado, fecha_creacion)
      VALUES ($1, 'TEST_READ_ONLY_UI', 'Rol de prueba solo lectura para Fase 6.4.13', 'ACTIVO', NOW())
    `, [readOnlyRoleId]);
    createdRoles.push(readOnlyRoleId);

    // Configurar permisos de solo lectura para todos los módulos en admin.matriz_acceso_rol
    const modulosRes = await client.query(`SELECT modulo_sistema_id FROM admin.modulo_sistema WHERE estado = 'ACTIVO'`);
    for (const m of modulosRes.rows) {
      const maxMarRes = await client.query(`SELECT COALESCE(MAX(matriz_acceso_rol_id), 0) + 1 AS next_id FROM admin.matriz_acceso_rol`);
      await client.query(`
        INSERT INTO admin.matriz_acceso_rol (
          matriz_acceso_rol_id, rol_funcional_id, modulo_sistema_id, puede_ver, puede_crear, puede_editar,
          puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
          puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar, estado, fecha_creacion, fecha_actualizacion
        ) VALUES (
          $1, $2, $3, true, false, false,
          false, false, false, false,
          false, false, false, false, false, 'ACTIVO', NOW(), NOW()
        )
      `, [Number(maxMarRes.rows[0].next_id), readOnlyRoleId, m.modulo_sistema_id]);
    }

    // Configurar permisos de solo lectura para todas las pantallas en admin.matriz_acceso_pantalla
    const pantallasRes = await client.query(`SELECT pantalla_id FROM admin.pantalla_sistema WHERE activo = true`);
    for (const p of pantallasRes.rows) {
      const maxMapRes = await client.query(`SELECT COALESCE(MAX(matriz_pantalla_id), 0) + 1 AS next_id FROM admin.matriz_acceso_pantalla`);
      await client.query(`
        INSERT INTO admin.matriz_acceso_pantalla (
          matriz_pantalla_id, rol_funcional_id, pantalla_id, puede_ver, puede_crear, puede_editar,
          puede_inactivar, puede_exportar, puede_importar, puede_aprobar,
          puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar, estado, fecha_creacion, fecha_actualizacion
        ) VALUES (
          $1, $2, $3, true, false, false,
          false, false, false, false,
          false, false, false, false, false, 'ACTIVO', NOW(), NOW()
        )
      `, [Number(maxMapRes.rows[0].next_id), readOnlyRoleId, p.pantalla_id]);
    }

    // Crear usuario con rol de solo lectura
    const readOnlyUserId = await createSyntheticUser({ companyId: 1, roleId: readOnlyRoleId, emailPrefix: 'ro_user' });
    const readOnlyToken = await createSession(readOnlyUserId);

    // ------------------------------------------------------------------------
    // GRUPO 1: VERIFICACIÓN DE CABECERAS x-perm-* EN CATÁLOGOS SEGURIDAD
    // ------------------------------------------------------------------------
    console.log('\n--- GRUPO 1: Emisión de Cabeceras x-perm-* en Catálogos de Seguridad ---');

    // Escenario 1: GET /api/departamentos
    const resDepto = await makeHttpRequest('/api/departamentos', superAdminToken);
    record(1, 'GET /api/departamentos emite cabeceras x-perm-* completas',
      resDepto.statusCode === 200 &&
      resDepto.headers['x-perm-ver'] === 'true' &&
      resDepto.headers['x-perm-crear'] === 'true' &&
      resDepto.headers['x-perm-editar'] === 'true' &&
      resDepto.headers['x-perm-eliminar'] === 'true' &&
      resDepto.headers['x-perm-exportar'] === 'true',
      `Status: ${resDepto.statusCode}, x-perm-crear: ${resDepto.headers['x-perm-crear']}`
    );

    // Escenario 2: GET /api/areas
    const resAreas = await makeHttpRequest('/api/areas', superAdminToken);
    record(2, 'GET /api/areas emite cabeceras x-perm-* completas',
      resAreas.statusCode === 200 &&
      resAreas.headers['x-perm-ver'] === 'true' &&
      resAreas.headers['x-perm-crear'] === 'true' &&
      resAreas.headers['x-perm-editar'] === 'true',
      `Status: ${resAreas.statusCode}, x-perm-crear: ${resAreas.headers['x-perm-crear']}`
    );

    // Escenario 3: GET /api/cargos
    const resCargos = await makeHttpRequest('/api/cargos', superAdminToken);
    record(3, 'GET /api/cargos emite cabeceras x-perm-* completas',
      resCargos.statusCode === 200 &&
      resCargos.headers['x-perm-ver'] === 'true' &&
      resCargos.headers['x-perm-crear'] === 'true',
      `Status: ${resCargos.statusCode}, x-perm-crear: ${resCargos.headers['x-perm-crear']}`
    );

    // Escenario 4: GET /api/empresas
    const resEmpresas = await makeHttpRequest('/api/empresas', superAdminToken);
    record(4, 'GET /api/empresas emite cabeceras x-perm-* completas',
      resEmpresas.statusCode === 200 &&
      resEmpresas.headers['x-perm-ver'] === 'true' &&
      resEmpresas.headers['x-perm-crear'] === 'true',
      `Status: ${resEmpresas.statusCode}, x-perm-crear: ${resEmpresas.headers['x-perm-crear']}`
    );

    // Escenario 5: GET /api/tipos-empresa
    const resTiposEmp = await makeHttpRequest('/api/tipos-empresa', superAdminToken);
    record(5, 'GET /api/tipos-empresa emite cabeceras x-perm-* completas',
      resTiposEmp.statusCode === 200 &&
      resTiposEmp.headers['x-perm-ver'] === 'true' &&
      resTiposEmp.headers['x-perm-crear'] === 'true',
      `Status: ${resTiposEmp.statusCode}, x-perm-crear: ${resTiposEmp.headers['x-perm-crear']}`
    );

    // Escenario 6: GET /api/tipos-usuario
    const resTiposUsu = await makeHttpRequest('/api/tipos-usuario', superAdminToken);
    record(6, 'GET /api/tipos-usuario emite cabeceras x-perm-* completas',
      resTiposUsu.statusCode === 200 &&
      resTiposUsu.headers['x-perm-ver'] === 'true' &&
      resTiposUsu.headers['x-perm-crear'] === 'true',
      `Status: ${resTiposUsu.statusCode}, x-perm-crear: ${resTiposUsu.headers['x-perm-crear']}`
    );

    // Escenario 7: GET /api/matriz-acceso-rol
    const resMatriz = await makeHttpRequest('/api/matriz-acceso-rol', superAdminToken);
    record(7, 'GET /api/matriz-acceso-rol emite cabeceras x-perm-* completas',
      resMatriz.statusCode === 200 &&
      resMatriz.headers['x-perm-ver'] === 'true' &&
      resMatriz.headers['x-perm-editar'] === 'true',
      `Status: ${resMatriz.statusCode}, x-perm-editar: ${resMatriz.headers['x-perm-editar']}`
    );

    // Escenario 8: GET /api/usuarios
    const resUsuarios = await makeHttpRequest('/api/usuarios', superAdminToken);
    record(8, 'GET /api/usuarios emite cabeceras x-perm-* incluyendo x-perm-asignar',
      resUsuarios.statusCode === 200 &&
      resUsuarios.headers['x-perm-ver'] === 'true' &&
      resUsuarios.headers['x-perm-crear'] === 'true' &&
      resUsuarios.headers['x-perm-asignar'] === 'true',
      `Status: ${resUsuarios.statusCode}, x-perm-asignar: ${resUsuarios.headers['x-perm-asignar']}`
    );

    // ------------------------------------------------------------------------
    // GRUPO 2: VERIFICACIÓN DE CABECERAS EN MÓDULOS OPERATIVOS
    // ------------------------------------------------------------------------
    console.log('\n--- GRUPO 2: Emisión de Cabeceras x-perm-* en Módulos Operativos ---');

    // Escenario 9: GET /api/crm/niveles-cliente
    const resNiveles = await makeHttpRequest('/api/crm/niveles-cliente', superAdminToken);
    record(9, 'GET /api/crm/niveles-cliente emite cabeceras x-perm-* completas',
      resNiveles.statusCode === 200 &&
      resNiveles.headers['x-perm-ver'] !== undefined &&
      resNiveles.headers['x-perm-crear'] !== undefined,
      `Status: ${resNiveles.statusCode}, x-perm-ver: ${resNiveles.headers['x-perm-ver']}, x-perm-crear: ${resNiveles.headers['x-perm-crear']}`
    );

    // Escenario 10: GET /api/taller/recepciones
    const resRecs = await makeHttpRequest('/api/taller/recepciones', superAdminToken);
    record(10, 'GET /api/taller/recepciones emite cabeceras x-perm-* completas',
      resRecs.statusCode === 200 &&
      resRecs.headers['x-perm-ver'] !== undefined &&
      resRecs.headers['x-perm-crear'] !== undefined,
      `Status: ${resRecs.statusCode}, x-perm-crear: ${resRecs.headers['x-perm-crear']}`
    );

    // Escenario 11: GET /api/taller/ordenes
    const resOrdenes = await makeHttpRequest('/api/taller/ordenes', superAdminToken);
    record(11, 'GET /api/taller/ordenes emite cabeceras x-perm-* incluyendo asignar, cerrar y reabrir',
      resOrdenes.statusCode === 200 &&
      resOrdenes.headers['x-perm-ver'] !== undefined &&
      resOrdenes.headers['x-perm-asignar'] !== undefined &&
      resOrdenes.headers['x-perm-cerrar'] !== undefined &&
      resOrdenes.headers['x-perm-reabrir'] !== undefined,
      `Status: ${resOrdenes.statusCode}, cerrar: ${resOrdenes.headers['x-perm-cerrar']}, reabrir: ${resOrdenes.headers['x-perm-reabrir']}`
    );

    // Escenario 12: GET /api/inventario/ajustes
    const resAjustes = await makeHttpRequest('/api/inventario/ajustes', superAdminToken);
    record(12, 'GET /api/inventario/ajustes emite cabeceras x-perm-* incluyendo aprobar',
      resAjustes.statusCode === 200 &&
      resAjustes.headers['x-perm-ver'] !== undefined &&
      resAjustes.headers['x-perm-crear'] !== undefined &&
      resAjustes.headers['x-perm-aprobar'] !== undefined,
      `Status: ${resAjustes.statusCode}, aprobar: ${resAjustes.headers['x-perm-aprobar']}`
    );

    // ------------------------------------------------------------------------
    // GRUPO 3: COMPORTAMIENTO DE USUARIO SOLO LECTURA (FAIL-CLOSED)
    // ------------------------------------------------------------------------
    console.log('\n--- GRUPO 3: Enforcing Restricciones para Usuario Solo-Lectura ---');

    // Escenario 13: Usuario solo lectura recibe x-perm-crear="false" en departamentos
    const roDepto = await makeHttpRequest('/api/departamentos', readOnlyToken);
    record(13, 'Usuario Solo-Lectura recibe x-perm-crear="false" en /api/departamentos',
      roDepto.statusCode === 200 &&
      roDepto.headers['x-perm-ver'] === 'true' &&
      roDepto.headers['x-perm-crear'] === 'false' &&
      roDepto.headers['x-perm-editar'] === 'false' &&
      roDepto.headers['x-perm-eliminar'] === 'false',
      `x-perm-ver: ${roDepto.headers['x-perm-ver']}, x-perm-crear: ${roDepto.headers['x-perm-crear']}, x-perm-editar: ${roDepto.headers['x-perm-editar']}`
    );

    // Escenario 14: Usuario solo lectura recibe x-perm-crear="false" en usuarios
    const roUsu = await makeHttpRequest('/api/usuarios', readOnlyToken);
    record(14, 'Usuario Solo-Lectura recibe x-perm-crear="false" y x-perm-asignar="false" en /api/usuarios',
      roUsu.statusCode === 200 &&
      roUsu.headers['x-perm-crear'] === 'false' &&
      roUsu.headers['x-perm-asignar'] === 'false',
      `x-perm-crear: ${roUsu.headers['x-perm-crear']}, x-perm-asignar: ${roUsu.headers['x-perm-asignar']}`
    );

    // Escenario 15: Usuario solo lectura recibe x-perm-crear="false" en taller recepciones
    const roRecs = await makeHttpRequest('/api/taller/recepciones', readOnlyToken);
    record(15, 'Usuario Solo-Lectura recibe x-perm-crear="false" en /api/taller/recepciones',
      roRecs.statusCode === 200 &&
      roRecs.headers['x-perm-crear'] === 'false',
      `x-perm-crear: ${roRecs.headers['x-perm-crear']}`
    );

    // Escenario 16: Usuario solo lectura recibe x-perm-crear="false" y x-perm-cerrar="false" en taller ordenes
    const roOrd = await makeHttpRequest('/api/taller/ordenes', readOnlyToken);
    record(16, 'Usuario Solo-Lectura recibe x-perm-crear="false" y x-perm-cerrar="false" en /api/taller/ordenes',
      roOrd.statusCode === 200 &&
      roOrd.headers['x-perm-crear'] === 'false' &&
      roOrd.headers['x-perm-cerrar'] === 'false',
      `x-perm-crear: ${roOrd.headers['x-perm-crear']}, x-perm-cerrar: ${roOrd.headers['x-perm-cerrar']}`
    );

    // ------------------------------------------------------------------------
    // GRUPO 4: RECHAZO EN SERVIDOR (403 FORBIDDEN) A OPERACIONES NO AUTORIZADAS
    // ------------------------------------------------------------------------
    console.log('\n--- GRUPO 4: Bloqueo Server-Side 403 Forbidden ---');

    // Escenario 17: Rechazo a POST /api/departamentos sin puede_crear
    const postDepto = await makeHttpRequest('/api/departamentos', readOnlyToken, 'POST', {
      nombre: 'Depto No Autorizado',
      estado: 'ACTIVO'
    });
    record(17, 'Bloqueo server-side: Rechazo 403 en POST /api/departamentos sin puede_crear',
      postDepto.statusCode === 403,
      `Status: ${postDepto.statusCode}, Message: ${postDepto.json?.message || postDepto.body}`
    );

    // Escenario 18: Rechazo a PUT /api/departamentos/[id] sin puede_editar
    const putDepto = await makeHttpRequest('/api/departamentos/1', readOnlyToken, 'PUT', {
      nombre: 'Depto Modificado Ilegal',
      estado: 'ACTIVO'
    });
    record(18, 'Bloqueo server-side: Rechazo 403 en PUT /api/departamentos/[id] sin puede_editar',
      putDepto.statusCode === 403,
      `Status: ${putDepto.statusCode}, Message: ${putDepto.json?.message || putDepto.body}`
    );

    // Escenario 19: Rechazo a DELETE /api/departamentos/[id] sin puede_eliminar
    const delDepto = await makeHttpRequest('/api/departamentos/9999', readOnlyToken, 'DELETE');
    record(19, 'Bloqueo server-side: Rechazo 403 en DELETE /api/departamentos/[id] sin puede_eliminar',
      delDepto.statusCode === 403,
      `Status: ${delDepto.statusCode}, Message: ${delDepto.json?.message || delDepto.body}`
    );

    // Escenario 20: Rechazo a POST /api/taller/recepciones sin puede_crear
    const postRec = await makeHttpRequest('/api/taller/recepciones', readOnlyToken, 'POST', {
      cliente_id: 1,
      bicicleta_id: 1,
      diagnostico_preliminar: 'Prueba no autorizada'
    });
    record(20, 'Bloqueo server-side: Rechazo 403 en POST /api/taller/recepciones sin puede_crear',
      postRec.statusCode === 403,
      `Status: ${postRec.statusCode}, Message: ${postRec.json?.message || postRec.body}`
    );

    // Escenario 21: Rechazo a POST /api/taller/ordenes sin puede_crear
    const postOrd = await makeHttpRequest('/api/taller/ordenes', readOnlyToken, 'POST', {
      cliente_id: 1,
      bicicleta_id: 1,
      prioridad_id: 1
    });
    record(21, 'Bloqueo server-side: Rechazo 403 en POST /api/taller/ordenes sin puede_crear',
      postOrd.statusCode === 403,
      `Status: ${postOrd.statusCode}, Message: ${postOrd.json?.message || postOrd.body}`
    );

    // Escenario 22: Rechazo a POST /api/inventario/ajustes sin puede_crear
    const postAjuste = await makeHttpRequest('/api/inventario/ajustes', readOnlyToken, 'POST', {
      tipo: 'SALIDA',
      almacenId: 1,
      lineas: [{ productoId: 1, cantidad: 1 }]
    });
    record(22, 'Bloqueo server-side: Rechazo 403 en POST /api/inventario/ajustes sin puede_crear',
      postAjuste.statusCode === 403,
      `Status: ${postAjuste.statusCode}, Message: ${postAjuste.json?.message || postAjuste.body}`
    );

    // ------------------------------------------------------------------------
    // GRUPO 5: MODELO B Y SALVAGUARDA INSTITUCIONAL
    // ------------------------------------------------------------------------
    console.log('\n--- GRUPO 5: Integridad Arquitectónica de Modelo B ---');

    // Escenario 23: SuperAdmin conserva salvaguarda en seguridad institucional
    const saSegMatriz = await makeHttpRequest('/api/matriz-acceso-rol', superAdminToken);
    record(23, 'Modelo B: SuperAdmin conserva acceso y edición plena a Seguridad Institucional',
      saSegMatriz.statusCode === 200 && saSegMatriz.headers['x-perm-editar'] === 'true',
      `Status: ${saSegMatriz.statusCode}, x-perm-editar: ${saSegMatriz.headers['x-perm-editar']}`
    );

    // Escenario 24: Verificación de ProtectedServerPage sin bypass operativo incondicional
    const pspContent = fs.readFileSync('src/components/auth/ProtectedServerPage.tsx', 'utf8');
    const hasRequiredAction = pspContent.includes('requiredAction') && pspContent.includes('getScreenPermissions');
    const noUnconditionalBypass = !pspContent.includes('if (session.rol_principal_id === 1) return <>{children}</>');
    record(24, 'Modelo B: ProtectedServerPage evalúa requiredAction vía getScreenPermissions sin bypass incondicional',
      hasRequiredAction && noUnconditionalBypass,
      `hasRequiredAction: ${hasRequiredAction}, noUnconditionalBypass: ${noUnconditionalBypass}`
    );

    // Escenario 25: Facturación nueva factura requiere server-side puede_crear
    const newInvoicePage = fs.readFileSync('src/app/(dashboard)/billing/new/page.tsx', 'utf8');
    record(25, 'ProtectedServerPage en /billing/new especifica requiredAction="puede_crear"',
      newInvoicePage.includes('requiredAction="puede_crear"'),
      `Contiene requiredAction="puede_crear": ${newInvoicePage.includes('requiredAction="puede_crear"')}`
    );

    // Escenario 26: Inventario entradas requiere server-side puede_crear
    const entriesPage = fs.readFileSync('src/app/(dashboard)/inventory/entries/page.tsx', 'utf8');
    record(26, 'ProtectedServerPage en /inventory/entries especifica requiredAction="puede_crear"',
      entriesPage.includes('requiredAction="puede_crear"'),
      `Contiene requiredAction="puede_crear": ${entriesPage.includes('requiredAction="puede_crear"')}`
    );

    // Escenario 27: Inventario transferencias requiere server-side puede_mover
    const transfersPage = fs.readFileSync('src/app/(dashboard)/inventory/transfers/page.tsx', 'utf8');
    record(27, 'ProtectedServerPage en /inventory/transfers especifica requiredAction="puede_mover"',
      transfersPage.includes('requiredAction="puede_mover"'),
      `Contiene requiredAction="puede_mover": ${transfersPage.includes('requiredAction="puede_mover"')}`
    );

    // Escenario 28: Inventario inicial requiere server-side puede_crear
    const initialPage = fs.readFileSync('src/app/(dashboard)/inventory/initial/page.tsx', 'utf8');
    record(28, 'ProtectedServerPage en /inventory/initial especifica requiredAction="puede_crear"',
      initialPage.includes('requiredAction="puede_crear"'),
      `Contiene requiredAction="puede_crear": ${initialPage.includes('requiredAction="puede_crear"')}`
    );

    console.log('\n' + '='.repeat(78));
    console.log(`RESUMEN FINAL FASE 6.4.13:`);
    console.log(`Total escenarios: ${testResults.length}`);
    console.log(`Exitosos: ${passedCount}`);
    console.log(`Fallidos: ${failedCount}`);
    console.log('='.repeat(78));

    if (failedCount > 0) {
      process.exitCode = 1;
    }

  } finally {
    // Limpieza de datos sintéticos de prueba
    console.log('\n🧹 Limpiando sesiones y usuarios de prueba...');
    try {
      if (createdSessions.length > 0) {
        await client.query(`DELETE FROM admin.usuario_sesion WHERE sesion_id = ANY($1::int[])`, [createdSessions]);
      }
      if (createdUsers.length > 0) {
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

runFase6413Tests().catch((err) => {
  console.error('FATAL ERROR en suite de pruebas 6.4.13:', err);
  process.exit(1);
});
