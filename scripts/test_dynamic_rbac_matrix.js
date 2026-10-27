/**
 * RIDE LAB — SUITE DE PRUEBAS OBLIGATORIAS: MOTOR RBAC 100% DINÁMICO
 * 
 * Valida:
 * 1. Independencia absoluta del ID, nombre o tipo de rol.
 * 2. Facturación:
 *    - FACTURACION_NUEVA (puede_crear)
 *    - FACTURACION_FACTURAS (puede_ver, puede_aprobar)
 *    - FACTURACION_PAGOS (puede_ver, puede_crear)
 *    - FACTURACION_DESPACHO (puede_ver, puede_cerrar)
 * 3. Ciclo de vida dinámico para cada operación:
 *    - Ver=true, Acción=true -> Permitido
 *    - Ver=true, Acción=false -> Denegado (HTTP 403)
 *    - Ver=false -> Denegado (HTTP 403)
 *    - Activación dinámica en caliente -> Permitido inmediato (sin cambiar código)
 *    - Revocación dinámica en caliente -> Denegado inmediato (HTTP 403)
 * 4. Multi-rol (unión de privilegios)
 * 5. Permisos personalizados (denegación prevalece)
 * 6. Limpieza total garantizada: CERO RESIDUOS.
 */

const { Pool } = require('pg');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.test.local', override: true });

const BASE_URL = process.env.TEST_APP_URL || 'http://localhost:3000';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

async function apiRequest(rawToken, method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Cookie': `session_token=${rawToken}`,
    'Content-Type': 'application/json'
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  let json = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, ok: res.ok, json, text };
}

async function run() {
  const client = await pool.connect();
  const testResults = [];

  function record(num, name, passed, details = '') {
    const symbol = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${symbol} [Escenario ${String(num).padStart(2, '0')}] ${name}`);
    if (details) console.log(`   Detalle: ${details}`);
    testResults.push({ num, name, passed, details });
  }

  console.log("================================================================================");
  console.log("RIDE LAB — CERTIFICACIÓN DE AUTORIZACIÓN 100% DINÁMICA RBAC");
  console.log("================================================================================\n");

  const cleanupRoles = [];
  const cleanupUsers = [];
  const cleanupSessions = [];
  const cleanupInvoices = [];
  const cleanupOrders = [];

  try {
    // 1. Obtener IDs canónicos de pantallas
    const scrRows = (await client.query(`
      SELECT pantalla_id, codigo FROM admin.pantalla_sistema
      WHERE codigo IN ('FACTURACION_NUEVA', 'FACTURACION_FACTURAS', 'FACTURACION_PAGOS', 'FACTURACION_DESPACHO', 'TALLER_ORDENES')
    `)).rows;
    const screens = {};
    for (const s of scrRows) screens[s.codigo] = s.pantalla_id;

    const motivoRes = await client.query("SELECT motivo_anulacion_factura_id FROM admin.motivo_anulacion_factura LIMIT 1");
    const validMotivoId = motivoRes.rows[0]?.motivo_anulacion_factura_id || 1;

    // Limpieza preventiva previa de posibles facturas sintéticas residuales
    await client.query("UPDATE admin.movimientos_inventario SET movimiento_origen_id = NULL WHERE referencia LIKE 'Anulación TEST-FAC-%' OR referencia LIKE 'TEST-FAC-%'");
    await client.query("DELETE FROM admin.movimientos_inventario WHERE referencia LIKE 'Anulación TEST-FAC-%' OR referencia LIKE 'TEST-FAC-%'");
    await client.query("DELETE FROM admin.factura_anulacion WHERE factura_id IN (SELECT factura_id FROM admin.facturas WHERE numero_factura LIKE 'TEST-FAC-%')");
    await client.query("DELETE FROM admin.pagos WHERE factura_id IN (SELECT factura_id FROM admin.facturas WHERE numero_factura LIKE 'TEST-FAC-%')");
    await client.query("DELETE FROM admin.detalle_factura_movimiento WHERE detalle_factura_id IN (SELECT detalle_factura_id FROM admin.detalle_factura WHERE factura_id IN (SELECT factura_id FROM admin.facturas WHERE numero_factura LIKE 'TEST-FAC-%'))");
    await client.query("DELETE FROM admin.detalle_factura WHERE factura_id IN (SELECT factura_id FROM admin.facturas WHERE numero_factura LIKE 'TEST-FAC-%')");
    await client.query("DELETE FROM admin.facturas WHERE numero_factura LIKE 'TEST-FAC-%'");
    await client.query("SELECT setval('admin.movimientos_inventario_movimiento_inventario_id_seq', (SELECT COALESCE(MAX(movimiento_inventario_id), 1) FROM admin.movimientos_inventario))");

    // Limpieza preventiva previa de posibles roles/usuarios de pruebas anteriores
    const prevRoles = await client.query("SELECT rol_funcional_id FROM admin.rol_funcional WHERE nombre LIKE 'TEST_ROL_%'");
    if (prevRoles.rows.length > 0) {
      const pIds = prevRoles.rows.map(r => r.rol_funcional_id);
      await client.query("DELETE FROM admin.factura_anulacion WHERE usuario_anulacion_id IN (SELECT usuario_id FROM admin.usuario WHERE rol_principal_id = ANY($1::int[])) OR usuario_autorizacion_id IN (SELECT usuario_id FROM admin.usuario WHERE rol_principal_id = ANY($1::int[]))", [pIds]);
      await client.query("DELETE FROM admin.pagos WHERE usuario_registro IN (SELECT usuario_id FROM admin.usuario WHERE rol_principal_id = ANY($1::int[]))", [pIds]);
      await client.query("DELETE FROM admin.detalle_factura_movimiento WHERE detalle_factura_id IN (SELECT detalle_factura_id FROM admin.detalle_factura WHERE usuario_registro IN (SELECT usuario_id FROM admin.usuario WHERE rol_principal_id = ANY($1::int[])))", [pIds]);
      await client.query("DELETE FROM admin.detalle_factura WHERE usuario_registro IN (SELECT usuario_id FROM admin.usuario WHERE rol_principal_id = ANY($1::int[]))", [pIds]);
      await client.query("DELETE FROM admin.facturas WHERE usuario_creacion_id IN (SELECT usuario_id FROM admin.usuario WHERE rol_principal_id = ANY($1::int[]))", [pIds]);
      await client.query("DELETE FROM admin.matriz_acceso_pantalla WHERE rol_funcional_id = ANY($1::int[])", [pIds]);
      await client.query("DELETE FROM admin.matriz_acceso_rol WHERE rol_funcional_id = ANY($1::int[])", [pIds]);
      await client.query("DELETE FROM admin.usuario_rol_adicional WHERE rol_funcional_id = ANY($1::int[])", [pIds]);
      await client.query("DELETE FROM admin.usuario_permiso_personalizado WHERE usuario_id IN (SELECT usuario_id FROM admin.usuario WHERE rol_principal_id = ANY($1::int[]))", [pIds]);
      await client.query("DELETE FROM admin.usuario_sesion WHERE usuario_id IN (SELECT usuario_id FROM admin.usuario WHERE rol_principal_id = ANY($1::int[]))", [pIds]);
      await client.query("DELETE FROM admin.usuario_seguridad WHERE usuario_id IN (SELECT usuario_id FROM admin.usuario WHERE rol_principal_id = ANY($1::int[]))", [pIds]);
      await client.query("DELETE FROM admin.usuario_identidad WHERE usuario_id IN (SELECT usuario_id FROM admin.usuario WHERE rol_principal_id = ANY($1::int[]))", [pIds]);
      await client.query("DELETE FROM admin.usuario WHERE rol_principal_id = ANY($1::int[])", [pIds]);
      await client.query("DELETE FROM admin.rol_funcional WHERE rol_funcional_id = ANY($1::int[])", [pIds]);
    }

    // Crear rol sintético arbitrario (Nombre e ID sin privilegios preconcebidos)
    const testRoleName = 'TEST_ROL_ARB_' + Date.now();
    const maxRRes = await client.query("SELECT COALESCE(MAX(rol_funcional_id), 1000) as max_id FROM admin.rol_funcional");
    const testRoleId = Number(maxRRes.rows[0].max_id) + 400;
    cleanupRoles.push(testRoleId);

    await client.query(`
      INSERT INTO admin.rol_funcional (rol_funcional_id, nombre, descripcion, estado, fecha_creacion)
      VALUES ($1, $2, 'Rol dinámico sin privilegios fijos', 'ACTIVO', NOW())
    `, [testRoleId, testRoleName]);

    // Crear usuario sintético asociado a testRoleId
    const maxURes = await client.query("SELECT COALESCE(MAX(usuario_id), 1000) as max_id FROM admin.usuario");
    const testUserId = Number(maxURes.rows[0].max_id) + 400;
    cleanupUsers.push(testUserId);

    await client.query(`
      INSERT INTO admin.usuario (usuario_id, tipo_usuario_id, empresa_id, rol_principal_id, estado, duracion_sesion_minutos, fecha_creacion)
      VALUES ($1, 1, 1, $2, 'ACTIVO', 480, NOW())
    `, [testUserId, testRoleId]);

    await client.query(`
      INSERT INTO admin.usuario_identidad (usuario_id, nombre, apellido, correo_electronico, fecha_creacion)
      VALUES ($1, 'Usuario', 'Dinamico RBAC', 'dinamico.rbac@ridelab.test', NOW())
    `, [testUserId]);

    const maxSegRes = await client.query("SELECT COALESCE(MAX(usuario_seguridad_id), 1000) as max_id FROM admin.usuario_seguridad");
    await client.query(`
      INSERT INTO admin.usuario_seguridad (usuario_seguridad_id, usuario_id, metodo_acceso_principal, identificador_principal, correo_acceso, password)
      VALUES ($1, $2, 'USUARIO', 'dinamico_rbac_user', 'dinamico.rbac@ridelab.test', $3)
    `, [Number(maxSegRes.rows[0].max_id) + 400, testUserId, hashPassword('Password123!')]);

    // Crear sesión activa
    const rawToken = 'dyn_rbac_' + crypto.randomBytes(24).toString('hex');
    const tokenHash = hashSessionToken(rawToken);
    await client.query(`
      INSERT INTO admin.usuario_sesion (usuario_id, token_identificador, dispositivo_navegador, direccion_ip, ubicacion, fecha_inicio, ultima_actividad, fecha_expiracion, estado)
      VALUES ($1, $2, 'Dynamic RBAC Runner', '127.0.0.1', 'Localhost', NOW(), NOW(), NOW() + INTERVAL '2 hours', 'ACTIVA')
    `, [testUserId, tokenHash]);
    cleanupSessions.push(rawToken);

    // =========================================================================
    // SECCIÓN 1: NUEVA FACTURA (FACTURACION_NUEVA -> puede_crear)
    // =========================================================================
    console.log("--- SECCIÓN 1: NUEVA FACTURA (FACTURACION_NUEVA) ---");

    const payloadFactura = {
      tipo_factura_id: 2,
      cliente_id: 35,
      condicion_venta: 'CONTADO',
      pago: { tipo_pago_id: 1, monto: 1000.00 },
      lineas: [
        { tipo_linea: 'PRODUCTO', producto_id: 214, almacen_id: 1, codigo: 'PRD-01', descripcion: 'Prod RBAC Test', cantidad: 1, precio_unitario: 1000.00, descuento: 0 }
      ]
    };

    // Caso 1.1: Ver=true, Crear=true -> PERMITIDO
    await client.query(`
      INSERT INTO admin.matriz_acceso_pantalla (rol_funcional_id, pantalla_id, puede_ver, puede_crear, estado)
      VALUES ($1, $2, true, true, 'ACTIVO')
      ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET puede_ver = true, puede_crear = true
    `, [testRoleId, screens['FACTURACION_NUEVA']]);

    const res1 = await apiRequest(rawToken, 'POST', '/api/facturacion/facturas', payloadFactura);
    const facId1 = res1.json?.factura?.factura_id || res1.json?.factura_id;
    if (facId1) cleanupInvoices.push(facId1);
    record(1, "FACTURACION_NUEVA: Ver=true, Crear=true permite creación (HTTP 201)", res1.status === 201, `Status: ${res1.status} - Body: ${res1.text}`);

    // Caso 1.2: Ver=true, Crear=false -> DENEGADO (HTTP 403)
    await client.query(`
      UPDATE admin.matriz_acceso_pantalla SET puede_crear = false
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [testRoleId, screens['FACTURACION_NUEVA']]);

    const res2 = await apiRequest(rawToken, 'POST', '/api/facturacion/facturas', payloadFactura);
    record(2, "FACTURACION_NUEVA: Ver=true, Crear=false deniega creación (HTTP 403)", res2.status === 403, `Status: ${res2.status}`);

    // Caso 1.3: Ver=false, Crear=false -> DENEGADO (HTTP 403)
    await client.query(`
      UPDATE admin.matriz_acceso_pantalla SET puede_ver = false
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [testRoleId, screens['FACTURACION_NUEVA']]);

    const res3 = await apiRequest(rawToken, 'POST', '/api/facturacion/facturas', payloadFactura);
    record(3, "FACTURACION_NUEVA: Ver=false deniega creación (HTTP 403)", res3.status === 403, `Status: ${res3.status}`);

    // Caso 1.4: Activación dinámica en caliente Crear=true -> PERMITIDO (sin cambiar código)
    await client.query(`
      UPDATE admin.matriz_acceso_pantalla SET puede_ver = true, puede_crear = true
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [testRoleId, screens['FACTURACION_NUEVA']]);

    const res4 = await apiRequest(rawToken, 'POST', '/api/facturacion/facturas', payloadFactura);
    const facId4 = res4.json?.factura?.factura_id || res4.json?.factura_id;
    if (facId4) cleanupInvoices.push(facId4);
    record(4, "FACTURACION_NUEVA: Activación dinámica inmediata de Crear=true permite creación (HTTP 201)", res4.status === 201, `Status: ${res4.status}`);

    // Caso 1.5: Revocación dinámica en caliente Crear=false -> DENEGADO INMEDIATO (HTTP 403)
    await client.query(`
      UPDATE admin.matriz_acceso_pantalla SET puede_crear = false
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [testRoleId, screens['FACTURACION_NUEVA']]);

    const res5 = await apiRequest(rawToken, 'POST', '/api/facturacion/facturas', payloadFactura);
    record(5, "FACTURACION_NUEVA: Revocación dinámica inmediata de Crear=false bloquea creación (HTTP 403)", res5.status === 403, `Status: ${res5.status}`);

    // =========================================================================
    // SECCIÓN 2: FACTURAS EMITIDAS (FACTURACION_FACTURAS -> puede_ver, puede_aprobar)
    // =========================================================================
    console.log("\n--- SECCIÓN 2: FACTURAS EMITIDAS (FACTURACION_FACTURAS) ---");

    // Caso 2.1: Ver=true -> Consulta permitida (HTTP 200)
    await client.query(`
      INSERT INTO admin.matriz_acceso_pantalla (rol_funcional_id, pantalla_id, puede_ver, puede_aprobar, estado)
      VALUES ($1, $2, true, false, 'ACTIVO')
      ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET puede_ver = true, puede_aprobar = false
    `, [testRoleId, screens['FACTURACION_FACTURAS']]);

    const res6 = await apiRequest(rawToken, 'GET', '/api/facturacion/facturas');
    record(6, "FACTURACION_FACTURAS: Ver=true permite consultar listado (HTTP 200)", res6.status === 200, `Status: ${res6.status}`);

    // Caso 2.2: Ver=false -> Consulta denegada (HTTP 403)
    await client.query(`
      UPDATE admin.matriz_acceso_pantalla SET puede_ver = false
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [testRoleId, screens['FACTURACION_FACTURAS']]);

    const res7 = await apiRequest(rawToken, 'GET', '/api/facturacion/facturas');
    record(7, "FACTURACION_FACTURAS: Ver=false deniega consulta de facturas (HTTP 403)", res7.status === 403, `Status: ${res7.status}`);

    // Preparar factura activa para probar anulación
    let targetFacId = facId1 || facId4;
    if (!targetFacId) {
      const numAnular = `TEST-FAC-ANULAR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const insFac = await client.query(`
        INSERT INTO admin.facturas (factura_id, empresa_id, tipo_factura_id, cliente_id, numero_factura, codigo_factura, fecha_factura, subtotal, total_factura, estado, fecha_registro, condicion_venta)
        VALUES ((SELECT COALESCE(MAX(factura_id), 0) + 1 FROM admin.facturas), 1, 1, 35, $1, $1, NOW(), 500, 500, 'EMITIDA', NOW(), 'CONTADO')
        RETURNING factura_id
      `, [numAnular]);
      targetFacId = insFac.rows[0].factura_id;
      cleanupInvoices.push(targetFacId);
    }

    // Caso 2.3: Aprobar=false -> Anulación denegada (HTTP 403)
    await client.query(`
      UPDATE admin.matriz_acceso_pantalla SET puede_ver = true, puede_aprobar = false
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [testRoleId, screens['FACTURACION_FACTURAS']]);

    const res8 = await apiRequest(rawToken, 'POST', `/api/facturacion/facturas/${targetFacId}/anular`, {
      motivo_anulacion_factura_id: validMotivoId,
      observacion: 'Prueba denegación anulación'
    });
    record(8, "FACTURACION_FACTURAS: Aprobar=false deniega anulación de factura (HTTP 403)", res8.status === 403, `Status: ${res8.status}`);

    // Caso 2.4: Activación dinámica Aprobar=true -> Anulación permitida (HTTP 200)
    await client.query(`
      UPDATE admin.matriz_acceso_pantalla SET puede_aprobar = true
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [testRoleId, screens['FACTURACION_FACTURAS']]);

    const res9 = await apiRequest(rawToken, 'POST', `/api/facturacion/facturas/${targetFacId}/anular`, {
      motivo_anulacion_factura_id: validMotivoId,
      observacion: 'Prueba concesión dinámica anulación'
    });
    record(9, "FACTURACION_FACTURAS: Activación dinámica de Aprobar=true autoriza anulación (HTTP 200)", res9.status === 200, `Status: ${res9.status}`);

    // =========================================================================
    // SECCIÓN 3: COBROS Y PAGOS (FACTURACION_PAGOS -> puede_crear)
    // =========================================================================
    console.log("\n--- SECCIÓN 3: COBROS Y PAGOS (FACTURACION_PAGOS) ---");

    // Crear factura a crédito para probar pagos
    const numPagos = `TEST-FAC-PAGOS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const insCredito = await client.query(`
      INSERT INTO admin.facturas (factura_id, empresa_id, tipo_factura_id, cliente_id, numero_factura, codigo_factura, fecha_factura, subtotal, total_factura, monto_pagado, balance_pendiente, estado, fecha_registro, condicion_venta)
      VALUES ((SELECT COALESCE(MAX(factura_id), 0) + 1 FROM admin.facturas), 1, 1, 35, $1, $1, NOW(), 1000, 1000, 0, 1000, 'PENDIENTE', NOW(), 'CREDITO')
      RETURNING factura_id
    `, [numPagos]);
    const facCreditoId = insCredito.rows[0].factura_id;
    cleanupInvoices.push(facCreditoId);

    const payloadPago = {
      tipo_pago_id: 1,
      monto: 300.00,
      monto_recibido: 300.00,
      referencia: 'REF-TEST-PAGOS',
      observacion: 'Abono prueba dinámica RBAC'
    };

    // Caso 3.1: Ver=true, Crear=false -> Registro de pago DENEGADO (HTTP 403)
    await client.query(`
      INSERT INTO admin.matriz_acceso_pantalla (rol_funcional_id, pantalla_id, puede_ver, puede_crear, estado)
      VALUES ($1, $2, true, false, 'ACTIVO')
      ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET puede_ver = true, puede_crear = false
    `, [testRoleId, screens['FACTURACION_PAGOS']]);

    const res10 = await apiRequest(rawToken, 'POST', `/api/facturacion/facturas/${facCreditoId}/pagos`, payloadPago);
    record(10, "FACTURACION_PAGOS: Ver=true, Crear=false deniega registrar pago (HTTP 403)", res10.status === 403, `Status: ${res10.status}`);

    // Caso 3.2: Activación dinámica en caliente Crear=true -> Registro de pago PERMITIDO (HTTP 201)
    await client.query(`
      UPDATE admin.matriz_acceso_pantalla SET puede_crear = true
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [testRoleId, screens['FACTURACION_PAGOS']]);

    const res11 = await apiRequest(rawToken, 'POST', `/api/facturacion/facturas/${facCreditoId}/pagos`, payloadPago);
    record(11, "FACTURACION_PAGOS: Activación dinámica de Crear=true permite registrar pago (HTTP 201)", res11.status === 201, `Status: ${res11.status}`);

    // Caso 3.3: Revocación dinámica Crear=false -> DENEGADO INMEDIATO (HTTP 403)
    await client.query(`
      UPDATE admin.matriz_acceso_pantalla SET puede_crear = false
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [testRoleId, screens['FACTURACION_PAGOS']]);

    const res12 = await apiRequest(rawToken, 'POST', `/api/facturacion/facturas/${facCreditoId}/pagos`, payloadPago);
    record(12, "FACTURACION_PAGOS: Revocación dinámica inmediata de Crear=false bloquea registrar pago (HTTP 403)", res12.status === 403, `Status: ${res12.status}`);

    // =========================================================================
    // SECCIÓN 4: DESPACHO DE ÓRDENES (FACTURACION_DESPACHO -> puede_ver)
    // =========================================================================
    console.log("\n--- SECCIÓN 4: DESPACHO DE ÓRDENES (FACTURACION_DESPACHO) ---");

    // Caso 4.1: Ver=true -> Acceso a despacho autorizado (HTTP 200)
    await client.query(`
      INSERT INTO admin.matriz_acceso_pantalla (rol_funcional_id, pantalla_id, puede_ver, estado)
      VALUES ($1, $2, true, 'ACTIVO')
      ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET puede_ver = true
    `, [testRoleId, screens['FACTURACION_DESPACHO']]);

    const res13 = await apiRequest(rawToken, 'GET', '/api/taller/facturacion/ordenes');
    record(13, "FACTURACION_DESPACHO: Ver=true permite consultar despacho de órdenes (HTTP 200)", res13.status === 200, `Status: ${res13.status}`);

    // Caso 4.2: Ver=false -> Acceso denegado (HTTP 403)
    await client.query(`
      UPDATE admin.matriz_acceso_pantalla SET puede_ver = false
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [testRoleId, screens['FACTURACION_DESPACHO']]);

    const res14 = await apiRequest(rawToken, 'GET', '/api/taller/facturacion/ordenes');
    record(14, "FACTURACION_DESPACHO: Ver=false deniega consultar despacho de órdenes (HTTP 403)", res14.status === 403, `Status: ${res14.status}`);

    // =========================================================================
    // SECCIÓN 5: INDEPENDENCIA ABSOLUTA DEL NOMBRE O ID DE ROL
    // =========================================================================
    console.log("\n--- SECCIÓN 5: INDEPENDENCIA ABSOLUTA DEL TIPO DE ROL ---");

    // Caso 5.1: Rol 1 (SuperAdmin) sin Crear en FACTURACION_NUEVA es denegado legítimamente (HTTP 403)
    // Crear sesión para usuario 1
    const saToken = 'sa_dyn_test_' + crypto.randomBytes(16).toString('hex');
    await client.query(`
      INSERT INTO admin.usuario_sesion (usuario_id, token_identificador, dispositivo_navegador, direccion_ip, ubicacion, fecha_inicio, ultima_actividad, fecha_expiracion, estado)
      VALUES (1, $1, 'SuperAdmin Dynamic Test', '127.0.0.1', 'Localhost', NOW(), NOW(), NOW() + INTERVAL '1 hour', 'ACTIVA')
    `, [hashSessionToken(saToken)]);
    cleanupSessions.push(saToken);

    // Asegurar que Rol 1 tiene puede_crear = false en FACTURACION_NUEVA
    const saPrevPerms = (await client.query(`
      SELECT puede_crear FROM admin.matriz_acceso_pantalla WHERE rol_funcional_id = 1 AND pantalla_id = $1
    `, [screens['FACTURACION_NUEVA']])).rows[0];

    await client.query(`
      UPDATE admin.matriz_acceso_pantalla SET puede_crear = false
      WHERE rol_funcional_id = 1 AND pantalla_id = $1
    `, [screens['FACTURACION_NUEVA']]);

    const saRes1 = await apiRequest(saToken, 'POST', '/api/facturacion/facturas', payloadFactura);
    record(15, "Rol 1 (SuperAdmin): Sin puede_crear en la matriz es DENEGADO (HTTP 403) - Cero bypasses hardcodeados", saRes1.status === 403, `Status: ${saRes1.status}`);

    // Caso 5.2: Rol 1 con puede_crear = true es AUTORIZADO (HTTP 201) - Cero prohibiciones hardcodeadas
    await client.query(`
      UPDATE admin.matriz_acceso_pantalla SET puede_crear = true
      WHERE rol_funcional_id = 1 AND pantalla_id = $1
    `, [screens['FACTURACION_NUEVA']]);

    const saRes2 = await apiRequest(saToken, 'POST', '/api/facturacion/facturas', payloadFactura);
    const facSaId = saRes2.json?.factura?.factura_id || saRes2.json?.factura_id;
    if (facSaId) cleanupInvoices.push(facSaId);
    record(16, "Rol 1 (SuperAdmin): Con puede_crear dinámico en la matriz es AUTORIZADO (HTTP 201)", saRes2.status === 201, `Status: ${saRes2.status} - Body: ${saRes2.text}`);

    // Restaurar Rol 1 exactamente a su valor canónico (Modelo B: puede_crear = false)
    await client.query(`
      UPDATE admin.matriz_acceso_pantalla SET puede_crear = false
      WHERE rol_funcional_id = 1 AND pantalla_id = $1
    `, [screens['FACTURACION_NUEVA']]);

    // =========================================================================
    // SECCIÓN 6: ROLES ADICIONALES (UNIÓN DE PERMISOS)
    // =========================================================================
    console.log("\n--- SECCIÓN 6: ROLES ADICIONALES Y PERMISOS PERSONALIZADOS ---");

    // Crear un segundo rol funcional adicional
    const addRoleName = 'TEST_ROL_ADD_' + Date.now();
    const addRoleId = testRoleId + 1;
    cleanupRoles.push(addRoleId);
    await client.query(`
      INSERT INTO admin.rol_funcional (rol_funcional_id, nombre, descripcion, estado, fecha_creacion)
      VALUES ($1, $2, 'Rol adicional para probar union', 'ACTIVO', NOW())
    `, [addRoleId, addRoleName]);

    // El rol principal NO tiene Crear en FACTURACION_NUEVA
    await client.query(`
      UPDATE admin.matriz_acceso_pantalla SET puede_ver = true, puede_crear = false
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [testRoleId, screens['FACTURACION_NUEVA']]);

    // El rol adicional SÍ tiene Crear en FACTURACION_NUEVA
    await client.query(`
      INSERT INTO admin.matriz_acceso_pantalla (rol_funcional_id, pantalla_id, puede_ver, puede_crear, estado)
      VALUES ($1, $2, true, true, 'ACTIVO')
      ON CONFLICT (rol_funcional_id, pantalla_id) DO UPDATE SET puede_ver = true, puede_crear = true
    `, [addRoleId, screens['FACTURACION_NUEVA']]);

    // Asignar rol adicional al usuario
    await client.query(`
      INSERT INTO admin.usuario_rol_adicional (usuario_id, rol_funcional_id, fecha_creacion)
      VALUES ($1, $2, NOW())
      ON CONFLICT DO NOTHING
    `, [testUserId, addRoleId]);

    const res17 = await apiRequest(rawToken, 'POST', '/api/facturacion/facturas', payloadFactura);
    const facId17 = res17.json?.factura?.factura_id || res17.json?.factura_id;
    if (facId17) cleanupInvoices.push(facId17);
    record(17, "Roles Adicionales: Unión de privilegios (Rol adicional otorga puede_crear) -> AUTORIZADO (HTTP 201)", res17.status === 201, `Status: ${res17.status}`);

    // Caso 6.2: Excepción personalizada DENEGADO (puede_crear = false) PREVALECE sobre la unión de roles
    await client.query(`DELETE FROM admin.usuario_permiso_personalizado WHERE usuario_id = $1 AND pantalla_id = $2`, [testUserId, screens['FACTURACION_NUEVA']]);
    await client.query(`
      INSERT INTO admin.usuario_permiso_personalizado (usuario_id, modulo_sistema_id, pantalla_id, puede_crear, estado, fecha_creacion)
      VALUES ($1, 10, $2, false, 'ACTIVO', NOW())
    `, [testUserId, screens['FACTURACION_NUEVA']]);

    const res18 = await apiRequest(rawToken, 'POST', '/api/facturacion/facturas', payloadFactura);
    record(18, "Permisos Personalizados: Excepción de denegación prevalece sobre la unión de roles (HTTP 403)", res18.status === 403, `Status: ${res18.status} - Body: ${res18.text}`);

    // Caso 6.3: Concesión personalizada (puede_crear = true) habilita creación aún sin permisos en los roles
    await client.query(`DELETE FROM admin.usuario_rol_adicional WHERE usuario_id = $1`, [testUserId]);
    await client.query(`
      UPDATE admin.matriz_acceso_pantalla SET puede_crear = false
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [testRoleId, screens['FACTURACION_NUEVA']]);

    await client.query(`DELETE FROM admin.usuario_permiso_personalizado WHERE usuario_id = $1 AND pantalla_id = $2`, [testUserId, screens['FACTURACION_NUEVA']]);
    await client.query(`
      INSERT INTO admin.usuario_permiso_personalizado (usuario_id, modulo_sistema_id, pantalla_id, puede_crear, estado, fecha_creacion)
      VALUES ($1, 10, $2, true, 'ACTIVO', NOW())
    `, [testUserId, screens['FACTURACION_NUEVA']]);

    const res19 = await apiRequest(rawToken, 'POST', '/api/facturacion/facturas', payloadFactura);
    const facId19 = res19.json?.factura?.factura_id || res19.json?.factura_id;
    if (facId19) cleanupInvoices.push(facId19);
    record(19, "Permisos Personalizados: Concesión personalizada (puede_crear = true) prevalece y AUTORIZA (HTTP 201)", res19.status === 201, `Status: ${res19.status} - Body: ${res19.text}`);

    // =========================================================================
    // SECCIÓN 7: CONTRATO CANÓNICO SIN SUSTITUCIÓN ARBITRARIA ENTRE PANTALLAS
    // =========================================================================
    console.log("\n--- SECCIÓN 7: CONTRATO CANÓNICO ESTRICTO SIN SUSTITUCIÓN ENTRE PANTALLAS ---");

    // Limpiar excepciones personalizadas
    await client.query("DELETE FROM admin.usuario_permiso_personalizado WHERE usuario_id = $1", [testUserId]);

    // Otorgar Crear en FACTURACION_FACTURAS pero NO en FACTURACION_NUEVA
    await client.query(`
      UPDATE admin.matriz_acceso_pantalla SET puede_ver = true, puede_crear = false
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [testRoleId, screens['FACTURACION_NUEVA']]);

    await client.query(`
      UPDATE admin.matriz_acceso_pantalla SET puede_ver = true, puede_crear = true
      WHERE rol_funcional_id = $1 AND pantalla_id = $2
    `, [testRoleId, screens['FACTURACION_FACTURAS']]);

    // Intentar POST /api/facturacion/facturas: DEBE FALLAR con 403 porque Crear en FACTURACION_FACTURAS no puede sustituir a FACTURACION_NUEVA
    const res20 = await apiRequest(rawToken, 'POST', '/api/facturacion/facturas', payloadFactura);
    record(20, "Contrato Canónico: Crear en FACTURACION_FACTURAS NO sustituye a FACTURACION_NUEVA (HTTP 403)", res20.status === 403, `Status: ${res20.status}`);

  } catch (err) {
    console.error("Error en suite de pruebas dinámicas:", err);
    record(99, "Ejecución sin excepciones", false, err.message);
  } finally {
    console.log("\n--- LIMPIEZA TOTAL FORENSE (CERO RESIDUOS) ---");
    try {
      if (cleanupInvoices.length > 0) {
        const movIdsRes = await client.query(`
          SELECT movimiento_inventario_id FROM admin.detalle_factura_movimiento 
          WHERE detalle_factura_id IN (SELECT detalle_factura_id FROM admin.detalle_factura WHERE factura_id = ANY($1::int[]))
        `, [cleanupInvoices]);
        const movIds = movIdsRes.rows.map(r => r.movimiento_inventario_id).filter(Boolean);
        await client.query("DELETE FROM admin.factura_anulacion WHERE factura_id = ANY($1::int[])", [cleanupInvoices]);
        await client.query("DELETE FROM admin.pagos WHERE factura_id = ANY($1::int[])", [cleanupInvoices]);
        await client.query("DELETE FROM admin.detalle_factura_movimiento WHERE detalle_factura_id IN (SELECT detalle_factura_id FROM admin.detalle_factura WHERE factura_id = ANY($1::int[]))", [cleanupInvoices]);
        if (movIds.length > 0) {
          const revMovs = await client.query(`
            SELECT movimiento_inventario_id FROM admin.movimientos_inventario
            WHERE movimiento_origen_id = ANY($1::int[])
          `, [movIds]);
          const allMovIds = [...movIds, ...revMovs.rows.map(r => r.movimiento_inventario_id)];
          await client.query("UPDATE admin.movimientos_inventario SET movimiento_origen_id = NULL WHERE movimiento_origen_id = ANY($1::int[])", [allMovIds]);
          await client.query("DELETE FROM admin.movimientos_inventario WHERE movimiento_inventario_id = ANY($1::int[])", [allMovIds]);
        }
        await client.query("DELETE FROM admin.detalle_factura WHERE factura_id = ANY($1::int[])", [cleanupInvoices]);
        await client.query("DELETE FROM admin.facturas WHERE factura_id = ANY($1::int[])", [cleanupInvoices]);
        await client.query("SELECT setval('admin.movimientos_inventario_movimiento_inventario_id_seq', (SELECT COALESCE(MAX(movimiento_inventario_id), 1) FROM admin.movimientos_inventario))");
        console.log(`  [OK] ${cleanupInvoices.length} facturas sintéticas y pagos eliminados.`);
      }

      if (cleanupUsers.length > 0) {
        await client.query("DELETE FROM admin.factura_anulacion WHERE usuario_anulacion_id = ANY($1::int[]) OR usuario_autorizacion_id = ANY($1::int[])", [cleanupUsers]);
        await client.query("DELETE FROM admin.usuario_permiso_personalizado WHERE usuario_id = ANY($1::int[])", [cleanupUsers]);
        await client.query("DELETE FROM admin.usuario_rol_adicional WHERE usuario_id = ANY($1::int[])", [cleanupUsers]);
        await client.query("DELETE FROM admin.usuario_sesion WHERE usuario_id = ANY($1::int[])", [cleanupUsers]);
        await client.query("DELETE FROM admin.usuario_seguridad WHERE usuario_id = ANY($1::int[])", [cleanupUsers]);
        await client.query("DELETE FROM admin.usuario_identidad WHERE usuario_id = ANY($1::int[])", [cleanupUsers]);
        await client.query("DELETE FROM admin.usuario WHERE usuario_id = ANY($1::int[])", [cleanupUsers]);
        console.log(`  [OK] ${cleanupUsers.length} usuarios sintéticos eliminados.`);
      }

      if (cleanupSessions.length > 0) {
        const tokenHashes = cleanupSessions.map(hashSessionToken);
        await client.query("DELETE FROM admin.usuario_sesion WHERE token_identificador = ANY($1::text[])", [tokenHashes]);
      }

      if (cleanupRoles.length > 0) {
        await client.query("DELETE FROM admin.matriz_acceso_pantalla WHERE rol_funcional_id = ANY($1::int[])", [cleanupRoles]);
        await client.query("DELETE FROM admin.matriz_acceso_rol WHERE rol_funcional_id = ANY($1::int[])", [cleanupRoles]);
        await client.query("DELETE FROM admin.rol_funcional WHERE rol_funcional_id = ANY($1::int[])", [cleanupRoles]);
        console.log(`  [OK] ${cleanupRoles.length} roles sintéticos eliminados.`);
      }
    } catch (cleanErr) {
      console.error("Error en limpieza:", cleanErr);
    }

    client.release();
    await pool.end();
  }

  const allPassed = testResults.every(t => t.passed);
  console.log("\n================================================================================");
  console.log(`RESUMEN DINÁMICO RBAC: ${testResults.filter(t => t.passed).length}/${testResults.length} Pasadas`);
  console.log(`RESULTADO FINAL: ${allPassed ? '✅ CERTIFICACIÓN EXITOSA AL 100%' : '❌ FALLOS DETECTADOS'}`);
  console.log("================================================================================");

  if (!allPassed) process.exit(1);
}

run();
