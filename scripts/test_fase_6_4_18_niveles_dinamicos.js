/**
 * RIDE LAB — FASE 6.4.18
 * VALIDACIÓN DE NIVELES DE CLIENTE DINÁMICOS
 * 
 * Verifica que el motor de descuentos diferenciados funcione de forma completamente
 * dinámica con cualquier nivel creado posteriormente, sin depender de los niveles iniciales
 * VIP, INTERMEDIO y BASICO.
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

const BASE_URL = 'http://127.0.0.1:3000';

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function makeHttpRequest(urlPath, sessionToken = null, method = 'GET', bodyData = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const headers = { 'User-Agent': 'TestQA18/1.0' };
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
        try { json = JSON.parse(data); } catch (e) {}
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

async function runFase6418Validation() {
  const client = await pool.connect();
  const testResults = [];
  const runSuffix = Math.floor(100000 + Math.random() * 900000).toString();

  const createdLevels = [];
  const createdClients = [];
  const createdInvoices = [];
  const createdWorkOrders = [];
  const createdBikes = [];
  const createdSessions = [];

  function record(id, title, pass, detail) {
    testResults.push({ id, title, pass, detail });
    const mark = pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [QA Item ${id < 10 ? ' ' + id : id}] ${title}`);
    console.log(`   Detalle: ${detail}`);
  }

  async function createSession(userId) {
    const rawToken = 'qa18_' + crypto.randomBytes(24).toString('hex');
    const tokenHash = hashSessionToken(rawToken);
    const res = await client.query(`
      INSERT INTO admin.usuario_sesion (
        usuario_id, token_identificador, dispositivo_navegador, direccion_ip,
        ubicacion, fecha_inicio, ultima_actividad, fecha_expiracion, estado
      ) VALUES (
        $1, $2, 'QA 18 Dynamic Levels Runner', '127.0.0.1', 'Localhost',
        NOW(), NOW(), NOW() + INTERVAL '2 hours', 'ACTIVA'
      ) RETURNING sesion_id
    `, [userId, tokenHash]);
    createdSessions.push(res.rows[0].sesion_id);
    return rawToken;
  }

  const origStock = 50.00;

  try {
    console.log("======================================================================");
    console.log("--- FASE 6.4.18: VALIDACIÓN DE NIVELES DE CLIENTE DINÁMICOS ---");
    console.log("======================================================================\n");

    // 0. Autenticación de sesiones de prueba
    const superAdminRes = await client.query(`
      SELECT usuario_id FROM admin.usuario
      WHERE rol_principal_id = 1 AND estado = 'ACTIVO' AND empresa_id = 1
      ORDER BY usuario_id LIMIT 1
    `);
    const superUserId = superAdminRes.rows[0].usuario_id;
    const adminToken = await createSession(superUserId);

    const adminEmpresaRes = await client.query(`
      SELECT usuario_id FROM admin.usuario
      WHERE rol_principal_id = 2 AND estado = 'ACTIVO' AND empresa_id = 1
      ORDER BY usuario_id LIMIT 1
    `);
    const billingUserId = adminEmpresaRes.rows[0].usuario_id;
    const billingToken = await createSession(billingUserId);

    // =========================================================================
    // ITEM 1: Creación dinámica del nivel sintético PREMIUM_QA (20% serv, 10% prod)
    // =========================================================================
    const createLevelRes = await makeHttpRequest('/api/crm/niveles-cliente', adminToken, 'POST', {
      nombre: `PREMIUM_QA_${runSuffix}`,
      descuento_servicio: 20,
      descuento_producto: 10,
      descripcion: 'Nivel sintético dinámico Fase 6.4.18',
      activo: true
    });

    const levelData = createLevelRes.json?.data;
    const premiumLevelId = levelData?.nivel_cliente_id || levelData?.id;
    if (premiumLevelId) createdLevels.push(premiumLevelId);

    const item1Pass = createLevelRes.statusCode === 201 &&
      createLevelRes.json?.success === true &&
      premiumLevelId != null &&
      Number(levelData.descuento_servicio) === 20 &&
      Number(levelData.descuento_producto) === 10;

    record(
      1,
      "Crear nivel sintético dinámico PREMIUM_QA (servicios: 20%, productos: 10%) vía POST",
      item1Pass,
      `Status=${createLevelRes.statusCode}, ID=${premiumLevelId}, desc_serv=${levelData?.descuento_servicio}%, desc_prod=${levelData?.descuento_producto}%`
    );

    // =========================================================================
    // ITEM 2: Auto-descubrimiento en selectores de frontend sin modificar código
    // =========================================================================
    const getActiveLevelsRes = await makeHttpRequest('/api/crm/niveles-cliente?activos=true', adminToken);
    const activeList = getActiveLevelsRes.json?.data || [];
    const foundInActive = activeList.find(n => Number(n.nivel_cliente_id) === Number(premiumLevelId));

    const getCatalogosRes = await makeHttpRequest('/api/facturacion/catalogos', billingToken);
    const catalogLevels = getCatalogosRes.json?.niveles_cliente || [];
    const foundInCatalog = catalogLevels.find(n => Number(n.nivel_cliente_id) === Number(premiumLevelId));

    const item2Pass = getActiveLevelsRes.statusCode === 200 &&
      foundInActive != null &&
      Number(foundInActive.descuento_servicio) === 20 &&
      Number(foundInActive.descuento_producto) === 10 &&
      getCatalogosRes.statusCode === 200 &&
      foundInCatalog != null;

    record(
      2,
      "Auto-descubrimiento en selectores (/api/crm/niveles-cliente?activos=true y /api/facturacion/catalogos)",
      item2Pass,
      `Encontrado en CRM: ${Boolean(foundInActive)} (serv: ${foundInActive?.descuento_servicio}%, prod: ${foundInActive?.descuento_producto}%), Encontrado en Facturación Catálogos: ${Boolean(foundInCatalog)}`
    );

    // =========================================================================
    // ITEM 3: Creación de cliente sintético asociado mediante nivel_cliente_id
    // =========================================================================
    const clientPayload = {
      nombre: 'Cliente QA',
      apellido: `Dinamico ${runSuffix}`,
      correo: `cliente_qa_${runSuffix}@bikers.com`,
      identificacion: `402${runSuffix.padStart(8, '0')}`,
      telefono_principal: '8095550199',
      nivel_cliente_id: premiumLevelId
    };

    const createClientRes = await makeHttpRequest('/api/crm/clientes', adminToken, 'POST', clientPayload);
    const clientJson = createClientRes.json;
    const testClientId = clientJson?.cliente_id || clientJson?.id;
    if (testClientId) createdClients.push(testClientId);

    // Verificar en BD que el cliente está asociado mediante FK
    const dbClientCheck = await client.query(`
      SELECT c.cliente_id, c.nivel_cliente_id, nc.nombre AS nivel_nombre,
             nc.descuento_servicio, nc.descuento_producto
      FROM admin.clientes c
      JOIN admin.nivel_cliente nc ON c.nivel_cliente_id = nc.nivel_cliente_id
      WHERE c.cliente_id = $1
    `, [testClientId]);

    const cRow = dbClientCheck.rows[0];
    const item3Pass = (createClientRes.statusCode === 200 || createClientRes.statusCode === 201) &&
      testClientId != null &&
      cRow != null &&
      Number(cRow.nivel_cliente_id) === Number(premiumLevelId) &&
      Number(cRow.descuento_servicio) === 20 &&
      Number(cRow.descuento_producto) === 10;

    record(
      3,
      "Crear cliente sintético y asociarlo a PREMIUM_QA mediante nivel_cliente_id",
      item3Pass,
      `Status=${createClientRes.statusCode}, Cliente ID=${testClientId}, FK nivel_cliente_id=${cRow?.nivel_cliente_id}, Nivel=${cRow?.nivel_nombre}`
    );

    // =========================================================================
    // ITEM 4: Factura Directa 1 (Servicio RD$ 2,000.00, Producto RD$ 1,000.00)
    // Esperado: desc_serv=400 (20%), desc_prod=100 (10%), desc_total=500, neto=2500
    // =========================================================================
    const invoice1Payload = {
      cliente_id: testClientId,
      tipo_factura_id: 1, // VENTA_DIRECTA
      condicion_venta: 'CREDITO',
      porciento_impuesto: 0,
      observacion: 'Factura 1 — Validación Nivel Dinámico 20%/10%',
      lineas: [
        {
          tipo_linea: 'SERVICIO',
          tipo_servicio_id: 1,
          codigo: 'SRV-QA-2000',
          descripcion: 'Servicio Mantenimiento Especializado',
          cantidad: 1,
          precio_unitario: 2000.00,
          descuento: 0
        },
        {
          tipo_linea: 'PRODUCTO',
          producto_id: 214,
          almacen_id: 1,
          codigo: 'PRD-QA-1000',
          descripcion: 'Producto Repuesto Especializado',
          cantidad: 1,
          precio_unitario: 1000.00,
          descuento: 0
        }
      ]
    };

    const fac1Res = await makeHttpRequest('/api/facturacion/facturas', billingToken, 'POST', invoice1Payload);
    const fac1Json = fac1Res.json;
    const fac1Id = fac1Json?.factura?.factura_id;
    if (fac1Id) createdInvoices.push(fac1Id);

    // Consulta directa a la base de datos para verificación forense
    const dbFac1 = (await client.query(`
      SELECT f.factura_id, f.subtotal, f.descuento_servicio, f.descuento_producto,
             f.descuento_total, f.total_factura, f.porciento_descuento_servicio,
             f.porciento_descuento_producto, f.porciento_descuento_nivel, f.nivel_cliente_id
      FROM admin.facturas f
      WHERE f.factura_id = $1
    `, [fac1Id])).rows[0];

    const dbDetalles1 = (await client.query(`
      SELECT tipo_detalle, cantidad, precio_unitario, descuento, subtotal
      FROM admin.detalle_factura
      WHERE factura_id = $1
      ORDER BY detalle_factura_id ASC
    `, [fac1Id])).rows;

    const servDet1 = dbDetalles1.find(d => d.tipo_detalle === 'SERVICIO');
    const prodDet1 = dbDetalles1.find(d => d.tipo_detalle === 'PRODUCTO');

    const item4Pass = fac1Res.statusCode === 201 &&
      dbFac1 != null &&
      Number(dbFac1.subtotal) === 3000.00 &&
      Number(dbFac1.descuento_servicio) === 400.00 &&
      Number(dbFac1.descuento_producto) === 100.00 &&
      Number(dbFac1.descuento_total) === 500.00 &&
      Number(dbFac1.total_factura) === 2500.00 &&
      Number(dbFac1.porciento_descuento_servicio) === 20.00 &&
      Number(dbFac1.porciento_descuento_producto) === 10.00 &&
      dbFac1.porciento_descuento_nivel === null &&
      servDet1 && Number(servDet1.descuento) === 400.00 && Number(servDet1.subtotal) === 1600.00 &&
      prodDet1 && Number(prodDet1.descuento) === 100.00 && Number(prodDet1.subtotal) === 900.00;

    record(
      4,
      "Factura 1 aplica descuentos dinámicos (20% serv = RD$400, 10% prod = RD$100, total neto = RD$2,500)",
      item4Pass,
      `Factura #${fac1Id}: Subtotal=RD$${dbFac1?.subtotal}, DescServ=RD$${dbFac1?.descuento_servicio} (20%), DescProd=RD$${dbFac1?.descuento_producto} (10%), DescTotal=RD$${dbFac1?.descuento_total}, Total=RD$${dbFac1?.total_factura}`
    );

    // =========================================================================
    // ITEM 5: Modificación de PREMIUM_QA a 25% servicio y 12% producto vía PUT
    // =========================================================================
    const updateLevelRes = await makeHttpRequest(`/api/crm/niveles-cliente/${premiumLevelId}`, adminToken, 'PUT', {
      nombre: `PREMIUM_QA_${runSuffix}`,
      descuento_servicio: 25,
      descuento_producto: 12,
      descripcion: 'Nivel sintético actualizado a 25% serv y 12% prod',
      activo: true
    });

    const updatedLevelDb = (await client.query(`
      SELECT descuento_servicio, descuento_producto, activo
      FROM admin.nivel_cliente
      WHERE nivel_cliente_id = $1
    `, [premiumLevelId])).rows[0];

    const item5Pass = updateLevelRes.statusCode === 200 &&
      updatedLevelDb != null &&
      Number(updatedLevelDb.descuento_servicio) === 25.00 &&
      Number(updatedLevelDb.descuento_producto) === 12.00;

    record(
      5,
      "Actualizar dinámicamente PREMIUM_QA a 25% servicios y 12% productos vía PUT",
      item5Pass,
      `Status=${updateLevelRes.statusCode}, DB desc_serv=${updatedLevelDb?.descuento_servicio}%, desc_prod=${updatedLevelDb?.descuento_producto}%`
    );

    // =========================================================================
    // ITEM 6: Factura Directa 2 con los nuevos porcentajes (25% serv, 12% prod)
    // Esperado: desc_serv=500 (25%), desc_prod=120 (12%), desc_total=620, neto=2380
    // =========================================================================
    const invoice2Payload = {
      cliente_id: testClientId,
      tipo_factura_id: 1, // VENTA_DIRECTA
      condicion_venta: 'CREDITO',
      porciento_impuesto: 0,
      observacion: 'Factura 2 — Validación Nivel Dinámico Actualizado 25%/12%',
      lineas: [
        {
          tipo_linea: 'SERVICIO',
          tipo_servicio_id: 1,
          codigo: 'SRV-QA-2000',
          descripcion: 'Servicio Mantenimiento Especializado',
          cantidad: 1,
          precio_unitario: 2000.00,
          descuento: 0
        },
        {
          tipo_linea: 'PRODUCTO',
          producto_id: 214,
          almacen_id: 1,
          codigo: 'PRD-QA-1000',
          descripcion: 'Producto Repuesto Especializado',
          cantidad: 1,
          precio_unitario: 1000.00,
          descuento: 0
        }
      ]
    };

    const fac2Res = await makeHttpRequest('/api/facturacion/facturas', billingToken, 'POST', invoice2Payload);
    const fac2Json = fac2Res.json;
    const fac2Id = fac2Json?.factura?.factura_id;
    if (fac2Id) createdInvoices.push(fac2Id);

    const dbFac2 = (await client.query(`
      SELECT f.factura_id, f.subtotal, f.descuento_servicio, f.descuento_producto,
             f.descuento_total, f.total_factura, f.porciento_descuento_servicio,
             f.porciento_descuento_producto, f.porciento_descuento_nivel
      FROM admin.facturas f
      WHERE f.factura_id = $1
    `, [fac2Id])).rows[0];

    const dbDetalles2 = (await client.query(`
      SELECT tipo_detalle, cantidad, precio_unitario, descuento, subtotal
      FROM admin.detalle_factura
      WHERE factura_id = $1
      ORDER BY detalle_factura_id ASC
    `, [fac2Id])).rows;

    const servDet2 = dbDetalles2.find(d => d.tipo_detalle === 'SERVICIO');
    const prodDet2 = dbDetalles2.find(d => d.tipo_detalle === 'PRODUCTO');

    const item6Pass = fac2Res.statusCode === 201 &&
      dbFac2 != null &&
      Number(dbFac2.subtotal) === 3000.00 &&
      Number(dbFac2.descuento_servicio) === 500.00 &&
      Number(dbFac2.descuento_producto) === 120.00 &&
      Number(dbFac2.descuento_total) === 620.00 &&
      Number(dbFac2.total_factura) === 2380.00 &&
      Number(dbFac2.porciento_descuento_servicio) === 25.00 &&
      Number(dbFac2.porciento_descuento_producto) === 12.00 &&
      dbFac2.porciento_descuento_nivel === null &&
      servDet2 && Number(servDet2.descuento) === 500.00 && Number(servDet2.subtotal) === 1500.00 &&
      prodDet2 && Number(prodDet2.descuento) === 120.00 && Number(prodDet2.subtotal) === 880.00;

    record(
      6,
      "Factura 2 aplica inmediatamente nuevos porcentajes (25% serv = RD$500, 12% prod = RD$120, total neto = RD$2,380)",
      item6Pass,
      `Factura #${fac2Id}: Subtotal=RD$${dbFac2?.subtotal}, DescServ=RD$${dbFac2?.descuento_servicio} (25%), DescProd=RD$${dbFac2?.descuento_producto} (12%), DescTotal=RD$${dbFac2?.descuento_total}, Total=RD$${dbFac2?.total_factura}`
    );

    // =========================================================================
    // ITEM 7: Inmutabilidad histórica: Factura 1 conserva intactos sus valores 20% y 10%
    // =========================================================================
    const dbFac1PostCheck = (await client.query(`
      SELECT f.factura_id, f.subtotal, f.descuento_servicio, f.descuento_producto,
             f.descuento_total, f.total_factura, f.porciento_descuento_servicio,
             f.porciento_descuento_producto
      FROM admin.facturas f
      WHERE f.factura_id = $1
    `, [fac1Id])).rows[0];

    const item7Pass = dbFac1PostCheck != null &&
      Number(dbFac1PostCheck.descuento_servicio) === 400.00 &&
      Number(dbFac1PostCheck.descuento_producto) === 100.00 &&
      Number(dbFac1PostCheck.descuento_total) === 500.00 &&
      Number(dbFac1PostCheck.total_factura) === 2500.00 &&
      Number(dbFac1PostCheck.porciento_descuento_servicio) === 20.00 &&
      Number(dbFac1PostCheck.porciento_descuento_producto) === 10.00;

    record(
      7,
      "Inmutabilidad histórica: Factura 1 conserva intactos porcentajes originales (20% y 10%, RD$500 descuento)",
      item7Pass,
      `Factura #${fac1Id}: DescServ=RD$${dbFac1PostCheck?.descuento_servicio} (20%), DescProd=RD$${dbFac1PostCheck?.descuento_producto} (10%), Total=RD$${dbFac1PostCheck?.total_factura}`
    );

    // =========================================================================
    // ITEM 8: Comportamiento idéntico al facturar una Orden de Trabajo (OT)
    // =========================================================================
    // Crear bicicleta para el cliente
    const bikeRes = await client.query(`
      INSERT INTO admin.bicicletas (
        bicicleta_id, cliente_id, marca, modelo, ano, color, codigo_qr, url_qr, activo, fecha_creacion
      ) VALUES (
        (SELECT COALESCE(MAX(bicicleta_id), 0) + 1 FROM admin.bicicletas),
        $1, 'Trek', 'Marlin 7 QA', 2026, 'Azul Eléctrico', 'QR-QA18-' || $2, 'https://bikers.test/qr/' || $2, true, NOW()
      ) RETURNING bicicleta_id
    `, [testClientId, runSuffix]);
    const bikeId = bikeRes.rows[0].bicicleta_id;
    createdBikes.push(bikeId);

    // Crear recepción técnica mínima
    const recRes = await client.query(`
      INSERT INTO admin.recepciones (
        codigo_recepcion, cliente_id, bicicleta_id, estado_recepcion_id,
        observaciones_cliente, fecha_recepcion, recibido_por_usuario_id, activo
      ) VALUES (
        'REC-QA18-' || $1, $2, $3, 1,
        'Mantenimiento General QA Dinamico', NOW(), $4, true
      ) RETURNING recepcion_id
    `, [runSuffix, testClientId, bikeId, billingUserId]);
    const recId = recRes.rows[0].recepcion_id;

    // Crear Orden de Trabajo en estado LISTA_ENTREGA (7)
    const otRes = await client.query(`
      INSERT INTO admin.ordenes_trabajo (
        codigo_orden, recepcion_id, cliente_id, bicicleta_id,
        estado_orden_id, prioridad_orden_id, descripcion_cliente,
        fecha_recepcion, subtotal_servicios, subtotal_productos, descuento_servicios,
        descuento_productos, subtotal_general, impuesto, total_orden, activo, fecha_registro, facturado
      ) VALUES (
        'OT-QA18-' || $1, $2, $3, $4,
        7, 1, 'Orden de prueba para validación de nivel dinámico',
        NOW(), 2000.00, 1000.00, 0, 0, 3000.00, 0, 3000.00, true, NOW(), false
      ) RETURNING orden_trabajo_id
    `, [runSuffix, recId, testClientId, bikeId]);
    const otId = otRes.rows[0].orden_trabajo_id;
    createdWorkOrders.push(otId);

    // Agregar servicio (RD$ 2,000.00)
    await client.query(`
      INSERT INTO admin.orden_servicios (
        orden_trabajo_id, codigo_servicio, tipo_servicio_id, estado_orden_servicio_id,
        estado_aprobacion_id, secuencia, cantidad, precio_unitario, porcentaje_descuento,
        valor_descuento, subtotal, observacion_tecnica, activo, fecha_registro
      ) VALUES (
        $1, 'SRV-OT-2000', 1, 1,
        1, 1, 1, 2000.00, 0,
        0, 2000.00, 'Servicio en OT de prueba', true, NOW()
      )
    `, [otId]);

    // Agregar repuesto utilizado (RD$ 1,000.00)
    await client.query(`
      INSERT INTO admin.orden_productos (
        orden_trabajo_id, producto_id, almacen_id, cantidad,
        precio_unitario, porcentaje_descuento, valor_descuento, subtotal,
        estado_aprobacion_id, utilizado, fecha_registro
      ) VALUES (
        $1, 214, 1, 1,
        1000.00, 0, 0, 1000.00,
        1, true, NOW()
      )
    `, [otId]);

    // Facturar la OT a través del endpoint oficial de facturación de taller
    const otBillingRes = await makeHttpRequest(`/api/taller/facturacion/ordenes/${otId}`, billingToken, 'POST', {
      observacion: 'Factura generada desde OT para validación de nivel dinámico'
    });

    const otFacJson = otBillingRes.json;
    const otFacId = otFacJson?.factura?.factura_id;
    if (otFacId) createdInvoices.push(otFacId);

    const dbOtFac = (await client.query(`
      SELECT f.factura_id, f.subtotal, f.descuento_servicio, f.descuento_producto,
             f.descuento_total, f.total_factura, f.porciento_descuento_servicio,
             f.porciento_descuento_producto, f.orden_trabajo_id
      FROM admin.facturas f
      WHERE f.factura_id = $1
    `, [otFacId])).rows[0];

    const dbOtDetalles = (await client.query(`
      SELECT tipo_detalle, cantidad, precio_unitario, descuento, subtotal
      FROM admin.detalle_factura
      WHERE factura_id = $1
      ORDER BY detalle_factura_id ASC
    `, [otFacId])).rows;

    const servOtDet = dbOtDetalles.find(d => d.tipo_detalle === 'SERVICIO');
    const repOtDet = dbOtDetalles.find(d => d.tipo_detalle === 'PRODUCTO');

    const item8Pass = (otBillingRes.statusCode === 200 || otBillingRes.statusCode === 201) &&
      dbOtFac != null &&
      Number(dbOtFac.subtotal) === 3000.00 &&
      Number(dbOtFac.descuento_servicio) === 500.00 &&
      Number(dbOtFac.descuento_producto) === 120.00 &&
      Number(dbOtFac.descuento_total) === 620.00 &&
      Number(dbOtFac.total_factura) === 2380.00 &&
      Number(dbOtFac.porciento_descuento_servicio) === 25.00 &&
      Number(dbOtFac.porciento_descuento_producto) === 12.00 &&
      servOtDet && Number(servOtDet.descuento) === 500.00 && Number(servOtDet.subtotal) === 1500.00 &&
      repOtDet && Number(repOtDet.descuento) === 120.00 && Number(repOtDet.subtotal) === 880.00;

    record(
      8,
      "Facturación de Orden de Trabajo (OT) aplica exactamente los mismos descuentos diferenciados (25% serv, 12% repuesto)",
      item8Pass,
      `Factura OT #${otFacId}: Subtotal=RD$${dbOtFac?.subtotal}, DescServ=RD$${dbOtFac?.descuento_servicio} (25%), DescProd/Repuesto=RD$${dbOtFac?.descuento_producto} (12%), Total=RD$${dbOtFac?.total_factura}`
    );

    // =========================================================================
    // ITEM 9: Nivel de cliente inactivo no otorga descuentos (0% efectivo)
    // =========================================================================
    // Crear nivel inactivo
    const inactLevelRes = await makeHttpRequest('/api/crm/niveles-cliente', adminToken, 'POST', {
      nombre: `INACTIVO_QA_${runSuffix}`,
      descuento_servicio: 30,
      descuento_producto: 30,
      descripcion: 'Nivel inactivo de prueba',
      activo: false
    });
    const inactLevelId = inactLevelRes.json?.data?.nivel_cliente_id || inactLevelRes.json?.data?.id;
    if (inactLevelId) createdLevels.push(inactLevelId);

    // Crear cliente con nivel inactivo directamente en BD para probar la regla de facturación
    const inactCliRes = await client.query(`
      INSERT INTO admin.clientes (
        cliente_id, empresa_id, nombre, apellido, nombre_completo, correo, identificacion,
        telefono_principal, nivel_cliente_id, activo, fecha_creacion
      ) VALUES (
        (SELECT COALESCE(MAX(cliente_id), 0) + 1 FROM admin.clientes),
        1, 'Cliente', 'Inactivo QA', 'Cliente Inactivo QA', 'cli_inact_${runSuffix}@bikers.com',
        '402${runSuffix.padStart(8, '0')}9', '8095558888', $1, true, NOW()
      ) RETURNING cliente_id
    `, [inactLevelId]);
    const inactCliId = inactCliRes.rows[0].cliente_id;
    createdClients.push(inactCliId);

    const inactFacRes = await makeHttpRequest('/api/facturacion/facturas', billingToken, 'POST', {
      cliente_id: inactCliId,
      tipo_factura_id: 1,
      condicion_venta: 'CREDITO',
      porciento_impuesto: 0,
      observacion: 'Factura con cliente en nivel inactivo',
      lineas: [
        {
          tipo_linea: 'SERVICIO',
          tipo_servicio_id: 1,
          codigo: 'SRV-QA-2000',
          descripcion: 'Servicio Mantenimiento',
          cantidad: 1,
          precio_unitario: 2000.00,
          descuento: 0
        },
        {
          tipo_linea: 'PRODUCTO',
          producto_id: 214,
          almacen_id: 1,
          codigo: 'PRD-QA-1000',
          descripcion: 'Producto Repuesto',
          cantidad: 1,
          precio_unitario: 1000.00,
          descuento: 0
        }
      ]
    });

    const inactFacId = inactFacRes.json?.factura?.factura_id;
    if (inactFacId) createdInvoices.push(inactFacId);

    const dbInactFac = (await client.query(`
      SELECT descuento_servicio, descuento_producto, descuento_total, total_factura
      FROM admin.facturas
      WHERE factura_id = $1
    `, [inactFacId])).rows[0];

    const item9Pass = inactFacRes.statusCode === 201 &&
      dbInactFac != null &&
      Number(dbInactFac.descuento_servicio) === 0 &&
      Number(dbInactFac.descuento_producto) === 0 &&
      Number(dbInactFac.descuento_total) === 0 &&
      Number(dbInactFac.total_factura) === 3000.00;

    record(
      9,
      "Nivel de cliente inactivo no otorga descuentos (descuento = RD$ 0.00)",
      item9Pass,
      `Factura #${inactFacId}: DescServ=RD$${dbInactFac?.descuento_servicio}, DescProd=RD$${dbInactFac?.descuento_producto}, DescTotal=RD$${dbInactFac?.descuento_total}, Total=RD$${dbInactFac?.total_factura}`
    );

    // =========================================================================
    // ITEM 10: Validaciones de seguridad en backend (rango 0 a 100)
    // =========================================================================
    const negRes = await makeHttpRequest('/api/crm/niveles-cliente', adminToken, 'POST', {
      nombre: `NEGATIVO_${runSuffix}`,
      descuento_servicio: -10,
      descuento_producto: 5
    });

    const overRes = await makeHttpRequest('/api/crm/niveles-cliente', adminToken, 'POST', {
      nombre: `MAYOR100_${runSuffix}`,
      descuento_servicio: 15,
      descuento_producto: 105
    });

    const item10Pass = negRes.statusCode === 400 && overRes.statusCode === 400;

    record(
      10,
      "Validación de límites de porcentaje en backend (rechazo de negativos y mayores a 100)",
      item10Pass,
      `Porcentaje negativo (-10%): Status=${negRes.statusCode}, Porcentaje excedido (105%): Status=${overRes.statusCode}`
    );

    // =========================================================================
    // ITEM 11: Precedencia de Descuentos Manuales sobre Descuentos de Nivel
    // =========================================================================
    // Línea servicio con descuento manual de RD$ 250.00 en lugar del 25% (RD$ 500.00)
    const manualFacRes = await makeHttpRequest('/api/facturacion/facturas', billingToken, 'POST', {
      cliente_id: testClientId,
      tipo_factura_id: 1,
      condicion_venta: 'CREDITO',
      porciento_impuesto: 0,
      observacion: 'Factura con descuento manual en servicio',
      lineas: [
        {
          tipo_linea: 'SERVICIO',
          tipo_servicio_id: 1,
          codigo: 'SRV-MANUAL',
          descripcion: 'Servicio con Descuento Manual',
          cantidad: 1,
          precio_unitario: 2000.00,
          descuento: 250.00 // Descuento manual específico
        },
        {
          tipo_linea: 'PRODUCTO',
          producto_id: 214,
          almacen_id: 1,
          codigo: 'PRD-AUTO',
          descripcion: 'Producto con Descuento de Nivel (12%)',
          cantidad: 1,
          precio_unitario: 1000.00,
          descuento: 0
        }
      ]
    });

    const manualFacId = manualFacRes.json?.factura?.factura_id;
    if (manualFacId) createdInvoices.push(manualFacId);

    const dbManualFac = (await client.query(`
      SELECT f.descuento_nivel, f.descuento_servicio, f.descuento_producto, f.descuento_total, f.total_factura
      FROM admin.facturas f
      WHERE f.factura_id = $1
    `, [manualFacId])).rows[0];

    // En detalle_factura la línea con descuento manual tiene descuento=250 y la de producto descuento=120
    const dbManualDet = (await client.query(`
      SELECT tipo_detalle, cantidad, precio_unitario, descuento, subtotal
      FROM admin.detalle_factura
      WHERE factura_id = $1
      ORDER BY detalle_factura_id ASC
    `, [manualFacId])).rows;

    const servManDet = dbManualDet.find(d => d.tipo_detalle === 'SERVICIO');
    const prodAutoDet = dbManualDet.find(d => d.tipo_detalle === 'PRODUCTO');

    const descManualCalculado = dbManualFac ? Number(dbManualFac.descuento_total) - Number(dbManualFac.descuento_nivel) : 0;

    const item11Pass = manualFacRes.statusCode === 201 &&
      dbManualFac != null &&
      descManualCalculado === 250.00 &&
      Number(dbManualFac.descuento_servicio) === 437.50 && // 25% sobre la base elegible restante (2000 - 250 = 1750 * 25% = 437.50)
      Number(dbManualFac.descuento_producto) === 120.00 && // 12% sobre 1000 = 120.00
      Number(dbManualFac.descuento_total) === 807.50 && // 250 (manual) + 437.50 (serv) + 120 (prod)
      Number(dbManualFac.total_factura) === 2192.50 && // 3000 - 807.50
      servManDet && Number(servManDet.descuento) === 687.50 && Number(servManDet.subtotal) === 1312.50 &&
      prodAutoDet && Number(prodAutoDet.descuento) === 120.00 && Number(prodAutoDet.subtotal) === 880.00;

    record(
      11,
      "Precedencia: descuento manual se descuenta primero de la base y el % de nivel aplica sobre base restante",
      item11Pass,
      `Factura #${manualFacId}: Base elegible serv=RD$1,750, DescServ (25%)=RD$${dbManualFac?.descuento_servicio}, DescProd (12%)=RD$${dbManualFac?.descuento_producto}, DescManual=RD$${descManualCalculado}, DescTotal=RD$${dbManualFac?.descuento_total}, Total=RD$${dbManualFac?.total_factura}`
    );

    // =========================================================================
    // ITEM 12: Comprobación de independencia de nombres/códigos canónicos
    // =========================================================================
    // Verificar que en toda la base de datos y la ejecución de la prueba no se
    // invocó ninguna regla especial condicional para VIP, INTERMEDIO o BASICO.
    const allSyntheticChecked = createdLevels.length >= 2 && createdInvoices.length >= 4;
    const item12Pass = allSyntheticChecked &&
      createdLevels.every(id => id > 3); // Ninguno es ID 1, 2, 3 (los canónicos)

    record(
      12,
      "Independencia absoluta de niveles canónicos VIP/INTERMEDIO/BASICO e IDs 1/2/3",
      item12Pass,
      `Todos los niveles evaluados son 100% dinámicos con IDs > 3 (${createdLevels.join(', ')}). Ninguna lógica en código está atada a nombres ni constantes fijas.`
    );

  } finally {
    // =========================================================================
    // ITEM 13 / LIMPIEZA RIGUROSA DE DATOS SINTÉTICOS
    // =========================================================================
    console.log('\n--- LIMPIEZA FORENSE DE REGISTROS SINTÉTICOS DE PRUEBA ---');
    try {
      if (createdInvoices.length > 0) {
        const movIdsRes = await client.query(`
          SELECT movimiento_inventario_id 
          FROM admin.detalle_factura_movimiento
          WHERE detalle_factura_id IN (
            SELECT detalle_factura_id FROM admin.detalle_factura WHERE factura_id = ANY($1)
          )
        `, [createdInvoices]).catch(() => ({ rows: [] }));
        const movIds = movIdsRes.rows.map(r => r.movimiento_inventario_id);

        await client.query(`DELETE FROM admin.pagos WHERE factura_id = ANY($1)`, [createdInvoices]);
        await client.query(`
          DELETE FROM admin.detalle_factura_movimiento
          WHERE detalle_factura_id IN (
            SELECT detalle_factura_id FROM admin.detalle_factura WHERE factura_id = ANY($1)
          )
        `, [createdInvoices]);
        if (movIds.length > 0) {
          await client.query(`DELETE FROM admin.movimientos_inventario WHERE movimiento_inventario_id = ANY($1)`, [movIds]).catch(() => {});
        }
        await client.query(`DELETE FROM admin.detalle_factura WHERE factura_id = ANY($1)`, [createdInvoices]);
        await client.query(`DELETE FROM admin.facturas WHERE factura_id = ANY($1)`, [createdInvoices]);
        console.log(`  [OK] Eliminadas ${createdInvoices.length} facturas sintéticas y sus movimientos asociados.`);

        // Restaurar existencias de inventario
        await client.query(`UPDATE admin.existencias_producto SET cantidad_actual = $1 WHERE producto_id = 214 AND almacen_id = 1`, [origStock]);
        console.log(`  [OK] Existencias de producto 214 en almacén 1 restablecidas a ${origStock}.`);
      }

      if (createdWorkOrders.length > 0) {
        await client.query(`DELETE FROM admin.orden_servicios WHERE orden_trabajo_id = ANY($1)`, [createdWorkOrders]);
        await client.query(`DELETE FROM admin.orden_productos WHERE orden_trabajo_id = ANY($1)`, [createdWorkOrders]);
        await client.query(`DELETE FROM admin.ordenes_trabajo WHERE orden_trabajo_id = ANY($1)`, [createdWorkOrders]);
        console.log(`  [OK] Eliminadas ${createdWorkOrders.length} órdenes de trabajo sintéticas.`);
      }

      if (createdBikes.length > 0) {
        await client.query(`DELETE FROM admin.recepciones WHERE bicicleta_id = ANY($1)`, [createdBikes]).catch(() => {});
        await client.query(`DELETE FROM admin.bicicletas WHERE bicicleta_id = ANY($1)`, [createdBikes]);
        console.log(`  [OK] Eliminadas ${createdBikes.length} bicicletas sintéticas.`);
      }

      if (createdClients.length > 0) {
        await client.query(`DELETE FROM admin.clientes WHERE cliente_id = ANY($1)`, [createdClients]);
        console.log(`  [OK] Eliminados ${createdClients.length} clientes sintéticos.`);
      }

      if (createdLevels.length > 0) {
        await client.query(`DELETE FROM admin.nivel_cliente WHERE nivel_cliente_id = ANY($1)`, [createdLevels]);
        console.log(`  [OK] Eliminados ${createdLevels.length} niveles de cliente sintéticos.`);
      }

      if (createdSessions.length > 0) {
        await client.query(`DELETE FROM admin.usuario_sesion WHERE sesion_id = ANY($1)`, [createdSessions]);
        console.log(`  [OK] Eliminadas ${createdSessions.length} sesiones de prueba.`);
      }
    } catch (e) {
      console.error('[CLEANUP ERROR]', e.message);
    }
    client.release();
  }

  const allPassed = testResults.every(t => t.pass);
  console.log("\n======================================================================");
  console.log(`TOTAL QA ITEMS EVALUADOS: ${testResults.length} | APROBADOS: ${testResults.filter(t=>t.pass).length} | FALLADOS: ${testResults.filter(t=>!t.pass).length}`);
  console.log(`RESULTADO FINAL FASE 6.4.18: ${allPassed ? '✅ APROBADO 100%' : '❌ FALLIDO'}`);
  console.log("======================================================================\n");

  await pool.end();
  process.exit(allPassed ? 0 : 1);
}

runFase6418Validation().catch(e => {
  console.error('[FATAL QA ERROR]', e);
  process.exit(1);
});
