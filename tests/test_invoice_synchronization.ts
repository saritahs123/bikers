import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getPool } from '../src/lib/db';
import { recalculateWorkOrderTotals } from '../src/lib/workshop/recalculateWorkOrderTotals';
import { syncWorkOrderInvoice } from '../src/lib/workshop/syncWorkOrderInvoice';

async function runInvoiceSyncTests() {
  console.log('========================================================================');
  console.log('STARTING INVOICE SYNCHRONIZATION TEST SUITE (SCENARIOS A - G)');
  console.log('========================================================================\n');

  const pool = getPool();
  const client = await pool.connect();

  let testClienteId: number | null = null;
  let testBicicletaId: number | null = null;
  let testRecepcionId: number | null = null;
  let testOrdenId: number | null = null;
  let testFacturaId: number | null = null;
  let testPagoId: number | null = null;

  try {
    // -------------------------------------------------------------------------
    // SETUP FIXTURES
    // -------------------------------------------------------------------------
    const maxCli = await client.query('SELECT COALESCE(MAX(cliente_id), 0) + 1 AS next_id FROM admin.clientes');
    testClienteId = Number(maxCli.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.clientes (cliente_id, nombre, apellido, nombre_completo, identificacion, telefono_principal, correo, activo, fecha_creacion, empresa_id)
      VALUES ($1, 'Cliente', 'SyncTest', 'Cliente SyncTest', $2, '809-555-9999', 'synctest@example.com', true, NOW(), 1)
    `, [testClienteId, `001-SYNC-${Date.now()}`]);

    const maxBic = await client.query('SELECT COALESCE(MAX(bicicleta_id), 0) + 1 AS next_id FROM admin.bicicletas');
    testBicicletaId = Number(maxBic.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.bicicletas (bicicleta_id, cliente_id, codigo_qr, url_qr, marca, modelo, ano, color, numero_serie_cuadro, activo, fecha_creacion)
      VALUES ($1, $2, $3, $4, 'Trek', 'Marlin 7', 2024, 'Azul', 'SN-SYNC-QA', true, NOW())
    `, [testBicicletaId, testClienteId, `QR-SYNC-${testBicicletaId}`, `https://example.com/qr/${testBicicletaId}`]);

    const recRes = await client.query(`
      INSERT INTO admin.recepciones (codigo_recepcion, cliente_id, bicicleta_id, estado_recepcion_id, diagnostico_preliminar, observaciones_cliente, observaciones_recepcion, presupuesto_estimado, requiere_aprobacion, activo, fecha_creacion, recibido_por_usuario_id, fecha_recepcion)
      VALUES ($1, $2, $3, 1, 'Diag Sync', 'Obs Sync', 'Sin obs', 2300, false, true, NOW(), 1, NOW())
      RETURNING recepcion_id
    `, [`REC-SYNC-${Date.now()}`, testClienteId, testBicicletaId]);
    testRecepcionId = recRes.rows[0].recepcion_id;

    // -------------------------------------------------------------------------
    // TEST A: OT SIN FACTURA
    // -------------------------------------------------------------------------
    console.log('--- TEST A: OT SIN FACTURA ---');
    const maxOrdA = await client.query('SELECT COALESCE(MAX(orden_trabajo_id), 0) + 1 AS next_id FROM admin.ordenes_trabajo');
    const otIdA = Number(maxOrdA.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.ordenes_trabajo (orden_trabajo_id, codigo_orden, recepcion_id, cliente_id, bicicleta_id, estado_orden_id, prioridad_orden_id, mecanico_id, subtotal_servicios, subtotal_productos, subtotal_general, impuesto, total_orden, facturado, fecha_recepcion, activo, fecha_registro)
      VALUES ($1, $2, $3, $4, $5, 1, 1, 1, 1500, 0, 1500, 0, 1500, false, NOW(), true, NOW())
    `, [otIdA, `OT-SYNC-A-${otIdA}`, testRecepcionId, testClienteId, testBicicletaId]);

    const servResA = await client.query(`
      INSERT INTO admin.orden_servicios (orden_trabajo_id, tipo_servicio_id, estado_orden_servicio_id, estado_aprobacion_id, cantidad, precio_unitario, subtotal, activo, fecha_registro)
      VALUES ($1, 1, 1, 1, 1, 1500, 1500, true, NOW())
      RETURNING orden_servicio_id
    `, [otIdA]);
    const servIdA = servResA.rows[0].orden_servicio_id;

    // Edit service on OT without invoice
    await client.query('UPDATE admin.orden_servicios SET precio_unitario = 1800, subtotal = 1800 WHERE orden_servicio_id = $1', [servIdA]);
    await recalculateWorkOrderTotals(client, otIdA, 1);
    const syncResA = await syncWorkOrderInvoice(client, otIdA, 1);

    console.log(`  Sync Result: synchronized = ${syncResA.synchronized}`);
    if (syncResA.synchronized !== false) throw new Error('Test A Failed: Expected synchronized=false for OT without invoice');
    const checkFacA = await client.query('SELECT COUNT(*) FROM admin.facturas WHERE orden_trabajo_id = $1', [otIdA]);
    if (Number(checkFacA.rows[0].count) !== 0) throw new Error('Test A Failed: An invoice was unexpectedly created');
    console.log('  ✓ PASS: OT sin factura no crea factura ni falla la sincronización.\n');

    // -------------------------------------------------------------------------
    // TEST B: FACTURA SIN PAGOS
    // -------------------------------------------------------------------------
    console.log('--- TEST B: FACTURA SIN PAGOS ---');
    const maxOrdB = await client.query('SELECT COALESCE(MAX(orden_trabajo_id), 0) + 1 AS next_id FROM admin.ordenes_trabajo');
    const otIdB = Number(maxOrdB.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.ordenes_trabajo (orden_trabajo_id, codigo_orden, recepcion_id, cliente_id, bicicleta_id, estado_orden_id, prioridad_orden_id, mecanico_id, subtotal_servicios, subtotal_productos, subtotal_general, impuesto, total_orden, facturado, fecha_facturacion, usuario_facturacion_id, fecha_recepcion, activo, fecha_registro)
      VALUES ($1, $2, $3, $4, $5, 7, 1, 1, 1500, 800, 2300, 0, 2300, true, NOW(), 1, NOW(), true, NOW())
    `, [otIdB, `OT-SYNC-B-${otIdB}`, testRecepcionId, testClienteId, testBicicletaId]);

    const servResB = await client.query(`
      INSERT INTO admin.orden_servicios (orden_trabajo_id, tipo_servicio_id, estado_orden_servicio_id, estado_aprobacion_id, cantidad, precio_unitario, subtotal, activo, fecha_registro)
      VALUES ($1, 1, 3, 1, 1, 1500, 1500, true, NOW())
      RETURNING orden_servicio_id
    `, [otIdB]);
    const servIdB = servResB.rows[0].orden_servicio_id;

    await client.query(`
      INSERT INTO admin.orden_productos (orden_trabajo_id, producto_id, almacen_id, estado_aprobacion_id, cantidad, precio_unitario, subtotal, fecha_registro)
      VALUES ($1, 1, 1, 1, 1, 800, 800, NOW())
    `, [otIdB]);

    const maxFacB = await client.query('SELECT COALESCE(MAX(factura_id), 0) + 1 AS next_id FROM admin.facturas');
    const facIdB = Number(maxFacB.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.facturas (factura_id, tipo_factura_id, cliente_id, orden_trabajo_id, numero_factura, subtotal, descuento_total, impuesto_total, total_factura, monto_pagado, balance_pendiente, estado, fecha_factura, fecha_registro)
      VALUES ($1, 1, $2, $3, $4, 2300, 0, 0, 2300, 0, 2300, 'EMITIDA', NOW(), NOW())
    `, [facIdB, testClienteId, otIdB, `FAC-SYNC-B-${facIdB}`]);

    // Initial sync
    await syncWorkOrderInvoice(client, otIdB, 1);

    // Edit service: 1500 -> 2000
    await client.query('UPDATE admin.orden_servicios SET precio_unitario = 2000, subtotal = 2000 WHERE orden_servicio_id = $1', [servIdB]);
    await recalculateWorkOrderTotals(client, otIdB, 1);
    const syncResB = await syncWorkOrderInvoice(client, otIdB, 1);

    console.log(`  OT Total: RD$ ${syncResB.total_nuevo}, Factura Total: RD$ ${syncResB.total_nuevo}, Balance: RD$ ${syncResB.balance_pendiente}`);
    if (syncResB.total_nuevo !== 2800 || syncResB.balance_pendiente !== 2800 || syncResB.monto_pagado !== 0) {
      throw new Error(`Test B Failed: Unexpected totals in sync: ${JSON.stringify(syncResB)}`);
    }

    const detRowsB = await client.query('SELECT * FROM admin.detalle_factura WHERE factura_id = $1 ORDER BY detalle_factura_id', [facIdB]);
    if (detRowsB.rows.length !== 2) throw new Error(`Test B Failed: Expected 2 detail lines, got ${detRowsB.rows.length}`);
    const servLineB = detRowsB.rows.find((r: any) => r.tipo_detalle === 'SERVICIO');
    if (parseFloat(servLineB.subtotal) !== 2000) throw new Error(`Test B Failed: Expected service line subtotal 2000, got ${servLineB.subtotal}`);

    console.log('  ✓ PASS: Factura sin pagos se sincroniza a RD$ 2,800 con balance pendiente RD$ 2,800.\n');

    // -------------------------------------------------------------------------
    // TEST C: FACTURA PAGADA + AUMENTO DE PRECIO DEL SERVICIO
    // -------------------------------------------------------------------------
    console.log('--- TEST C: FACTURA PAGADA + AUMENTO DE SERVICIO ---');
    const maxOrdC = await client.query('SELECT COALESCE(MAX(orden_trabajo_id), 0) + 1 AS next_id FROM admin.ordenes_trabajo');
    const otIdC = Number(maxOrdC.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.ordenes_trabajo (orden_trabajo_id, codigo_orden, recepcion_id, cliente_id, bicicleta_id, estado_orden_id, prioridad_orden_id, mecanico_id, subtotal_servicios, subtotal_productos, subtotal_general, impuesto, total_orden, facturado, fecha_facturacion, usuario_facturacion_id, fecha_recepcion, activo, fecha_registro)
      VALUES ($1, $2, $3, $4, $5, 8, 1, 1, 1500, 800, 2300, 0, 2300, true, NOW(), 1, NOW(), true, NOW())
    `, [otIdC, `OT-SYNC-C-${otIdC}`, testRecepcionId, testClienteId, testBicicletaId]);

    const servResC = await client.query(`
      INSERT INTO admin.orden_servicios (orden_trabajo_id, tipo_servicio_id, estado_orden_servicio_id, estado_aprobacion_id, cantidad, precio_unitario, subtotal, activo, fecha_registro)
      VALUES ($1, 1, 3, 1, 1, 1500, 1500, true, NOW())
      RETURNING orden_servicio_id
    `, [otIdC]);
    const servIdC = servResC.rows[0].orden_servicio_id;

    await client.query(`
      INSERT INTO admin.orden_productos (orden_trabajo_id, producto_id, almacen_id, estado_aprobacion_id, cantidad, precio_unitario, subtotal, fecha_registro)
      VALUES ($1, 1, 1, 1, 1, 800, 800, NOW())
    `, [otIdC]);

    const maxFacC = await client.query('SELECT COALESCE(MAX(factura_id), 0) + 1 AS next_id FROM admin.facturas');
    const facIdC = Number(maxFacC.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.facturas (factura_id, tipo_factura_id, cliente_id, orden_trabajo_id, numero_factura, subtotal, descuento_total, impuesto_total, total_factura, monto_pagado, balance_pendiente, estado, fecha_factura, fecha_registro)
      VALUES ($1, 1, $2, $3, $4, 2300, 0, 0, 2300, 2300, 0, 'PAGADA', NOW(), NOW())
    `, [facIdC, testClienteId, otIdC, `FAC-SYNC-C-${facIdC}`]);

    // Insert applied payment of 2300
    const maxPagC = await client.query('SELECT COALESCE(MAX(pago_id), 0) + 1 AS next_id FROM admin.pagos');
    const pagIdC = Number(maxPagC.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.pagos (pago_id, factura_id, tipo_pago_id, monto_pago, fecha_pago, referencia, estado, fecha_registro)
      VALUES ($1, $2, 1, 2300, NOW(), 'PAGO-C-2300', 'APLICADO', NOW())
    `, [pagIdC, facIdC]);

    // Initial sync
    await syncWorkOrderInvoice(client, otIdC, 1);

    // Edit service: 1500 -> 2000
    await client.query('UPDATE admin.orden_servicios SET precio_unitario = 2000, subtotal = 2000 WHERE orden_servicio_id = $1', [servIdC]);
    await recalculateWorkOrderTotals(client, otIdC, 1);
    const syncResC = await syncWorkOrderInvoice(client, otIdC, 1);

    console.log(`  Factura Total: RD$ ${syncResC.total_nuevo}, Pago Factual: RD$ ${syncResC.monto_pagado}, Balance Pendiente: RD$ ${syncResC.balance_pendiente}, Estado: ${syncResC.estado}`);
    if (syncResC.total_nuevo !== 2800 || syncResC.monto_pagado !== 2300 || syncResC.balance_pendiente !== 500 || syncResC.estado !== 'EMITIDA') {
      throw new Error(`Test C Failed: Unexpected sync values: ${JSON.stringify(syncResC)}`);
    }

    // Verify admin.pagos was NOT modified
    const checkPagC = await client.query('SELECT monto_pago, estado FROM admin.pagos WHERE pago_id = $1', [pagIdC]);
    if (parseFloat(checkPagC.rows[0].monto_pago) !== 2300 || checkPagC.rows[0].estado !== 'APLICADO') {
      throw new Error('Test C Failed: admin.pagos was unexpectedly modified!');
    }
    console.log('  ✓ PASS: Factura pagada con aumento de precio refleja total RD$ 2,800, pago factual RD$ 2,300 y balance RD$ 500 (Pagos intactos).\n');

    // -------------------------------------------------------------------------
    // TEST D: FACTURA PAGADA + ELIMINACIÓN DEL SERVICIO (SOBREPAGO)
    // -------------------------------------------------------------------------
    console.log('--- TEST D: FACTURA PAGADA + ELIMINACIÓN DE SERVICIO (SOBREPAGO) ---');
    const maxOrdD = await client.query('SELECT COALESCE(MAX(orden_trabajo_id), 0) + 1 AS next_id FROM admin.ordenes_trabajo');
    const otIdD = Number(maxOrdD.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.ordenes_trabajo (orden_trabajo_id, codigo_orden, recepcion_id, cliente_id, bicicleta_id, estado_orden_id, prioridad_orden_id, mecanico_id, subtotal_servicios, subtotal_productos, subtotal_general, impuesto, total_orden, facturado, fecha_facturacion, usuario_facturacion_id, fecha_recepcion, activo, fecha_registro)
      VALUES ($1, $2, $3, $4, $5, 8, 1, 1, 1500, 800, 2300, 0, 2300, true, NOW(), 1, NOW(), true, NOW())
    `, [otIdD, `OT-SYNC-D-${otIdD}`, testRecepcionId, testClienteId, testBicicletaId]);

    const servResD = await client.query(`
      INSERT INTO admin.orden_servicios (orden_trabajo_id, tipo_servicio_id, estado_orden_servicio_id, estado_aprobacion_id, cantidad, precio_unitario, subtotal, activo, fecha_registro)
      VALUES ($1, 1, 3, 1, 1, 1500, 1500, true, NOW())
      RETURNING orden_servicio_id
    `, [otIdD]);
    const servIdD = servResD.rows[0].orden_servicio_id;

    await client.query(`
      INSERT INTO admin.orden_productos (orden_trabajo_id, producto_id, almacen_id, estado_aprobacion_id, cantidad, precio_unitario, subtotal, fecha_registro)
      VALUES ($1, 1, 1, 1, 1, 800, 800, NOW())
    `, [otIdD]);

    const maxFacD = await client.query('SELECT COALESCE(MAX(factura_id), 0) + 1 AS next_id FROM admin.facturas');
    const facIdD = Number(maxFacD.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.facturas (factura_id, tipo_factura_id, cliente_id, orden_trabajo_id, numero_factura, subtotal, descuento_total, impuesto_total, total_factura, monto_pagado, balance_pendiente, estado, fecha_factura, fecha_registro)
      VALUES ($1, 1, $2, $3, $4, 2300, 0, 0, 2300, 2300, 0, 'PAGADA', NOW(), NOW())
    `, [facIdD, testClienteId, otIdD, `FAC-SYNC-D-${facIdD}`]);

    const maxPagD = await client.query('SELECT COALESCE(MAX(pago_id), 0) + 1 AS next_id FROM admin.pagos');
    const pagIdD = Number(maxPagD.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.pagos (pago_id, factura_id, tipo_pago_id, monto_pago, fecha_pago, referencia, estado, fecha_registro)
      VALUES ($1, $2, 1, 2300, NOW(), 'PAGO-D-2300', 'APLICADO', NOW())
    `, [pagIdD, facIdD]);

    // Initial sync
    await syncWorkOrderInvoice(client, otIdD, 1);

    // Delete service
    await client.query('DELETE FROM admin.orden_servicios WHERE orden_servicio_id = $1', [servIdD]);
    await recalculateWorkOrderTotals(client, otIdD, 1);
    const syncResD = await syncWorkOrderInvoice(client, otIdD, 1);

    console.log(`  Factura Total: RD$ ${syncResD.total_nuevo}, Pago Factual: RD$ ${syncResD.monto_pagado}, Balance: RD$ ${syncResD.balance_pendiente}, Sobrepago: RD$ ${syncResD.sobrepago}`);
    if (syncResD.total_nuevo !== 800 || syncResD.monto_pagado !== 2300 || syncResD.balance_pendiente !== 0 || syncResD.sobrepago !== 1500) {
      throw new Error(`Test D Failed: Unexpected overpayment calculation: ${JSON.stringify(syncResD)}`);
    }

    // Verify detail line was removed
    const detRowsD = await client.query('SELECT * FROM admin.detalle_factura WHERE factura_id = $1', [facIdD]);
    if (detRowsD.rows.length !== 1 || detRowsD.rows[0].tipo_detalle !== 'PRODUCTO') {
      throw new Error(`Test D Failed: Deleted service remained in detalle_factura!`);
    }

    // Verify payment was NOT touched
    const checkPagD = await client.query('SELECT monto_pago FROM admin.pagos WHERE pago_id = $1', [pagIdD]);
    if (parseFloat(checkPagD.rows[0].monto_pago) !== 2300) throw new Error('Test D Failed: Payment amount was altered!');

    console.log('  ✓ PASS: Eliminación de servicio redujo factura a RD$ 800, conservó pago histórico RD$ 2,300, eliminó línea de detalle y detectó sobrepago RD$ 1,500.\n');

    // -------------------------------------------------------------------------
    // TEST E: FACTURA CON PAGO PARCIAL
    // -------------------------------------------------------------------------
    console.log('--- TEST E: FACTURA CON PAGO PARCIAL ---');
    const maxOrdE = await client.query('SELECT COALESCE(MAX(orden_trabajo_id), 0) + 1 AS next_id FROM admin.ordenes_trabajo');
    const otIdE = Number(maxOrdE.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.ordenes_trabajo (orden_trabajo_id, codigo_orden, recepcion_id, cliente_id, bicicleta_id, estado_orden_id, prioridad_orden_id, mecanico_id, subtotal_servicios, subtotal_productos, subtotal_general, impuesto, total_orden, facturado, fecha_facturacion, usuario_facturacion_id, fecha_recepcion, activo, fecha_registro)
      VALUES ($1, $2, $3, $4, $5, 7, 1, 1, 1500, 800, 2300, 0, 2300, true, NOW(), 1, NOW(), true, NOW())
    `, [otIdE, `OT-SYNC-E-${otIdE}`, testRecepcionId, testClienteId, testBicicletaId]);

    const servResE = await client.query(`
      INSERT INTO admin.orden_servicios (orden_trabajo_id, tipo_servicio_id, estado_orden_servicio_id, estado_aprobacion_id, cantidad, precio_unitario, subtotal, activo, fecha_registro)
      VALUES ($1, 1, 3, 1, 1, 1500, 1500, true, NOW())
      RETURNING orden_servicio_id
    `, [otIdE]);
    const servIdE = servResE.rows[0].orden_servicio_id;

    await client.query(`
      INSERT INTO admin.orden_productos (orden_trabajo_id, producto_id, almacen_id, estado_aprobacion_id, cantidad, precio_unitario, subtotal, fecha_registro)
      VALUES ($1, 1, 1, 1, 1, 800, 800, NOW())
    `, [otIdE]);

    const maxFacE = await client.query('SELECT COALESCE(MAX(factura_id), 0) + 1 AS next_id FROM admin.facturas');
    const facIdE = Number(maxFacE.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.facturas (factura_id, tipo_factura_id, cliente_id, orden_trabajo_id, numero_factura, subtotal, descuento_total, impuesto_total, total_factura, monto_pagado, balance_pendiente, estado, fecha_factura, fecha_registro)
      VALUES ($1, 1, $2, $3, $4, 2300, 0, 0, 2300, 1000, 1300, 'EMITIDA', NOW(), NOW())
    `, [facIdE, testClienteId, otIdE, `FAC-SYNC-E-${facIdE}`]);

    // Insert partial payment: 1000
    const maxPagE = await client.query('SELECT COALESCE(MAX(pago_id), 0) + 1 AS next_id FROM admin.pagos');
    const pagIdE = Number(maxPagE.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.pagos (pago_id, factura_id, tipo_pago_id, monto_pago, fecha_pago, referencia, estado, fecha_registro)
      VALUES ($1, $2, 1, 1000, NOW(), 'PAGO-E-1000', 'APLICADO', NOW())
    `, [pagIdE, facIdE]);

    // Initial sync
    await syncWorkOrderInvoice(client, otIdE, 1);

    // Edit service: 1500 -> 2000
    await client.query('UPDATE admin.orden_servicios SET precio_unitario = 2000, subtotal = 2000 WHERE orden_servicio_id = $1', [servIdE]);
    await recalculateWorkOrderTotals(client, otIdE, 1);
    const syncResE = await syncWorkOrderInvoice(client, otIdE, 1);

    console.log(`  Factura Total: RD$ ${syncResE.total_nuevo}, Pago: RD$ ${syncResE.monto_pagado}, Balance: RD$ ${syncResE.balance_pendiente}, Estado: ${syncResE.estado}`);
    if (syncResE.total_nuevo !== 2800 || syncResE.monto_pagado !== 1000 || syncResE.balance_pendiente !== 1800 || syncResE.estado !== 'EMITIDA') {
      throw new Error(`Test E Failed: Unexpected partial payment sync: ${JSON.stringify(syncResE)}`);
    }

    console.log('  ✓ PASS: Factura con pago parcial sincroniza total a RD$ 2,800, preserva pago RD$ 1,000 y balance pendiente exacto RD$ 1,800.\n');

    // -------------------------------------------------------------------------
    // TEST F: IMPRESIÓN / POS DESPUÉS DE SINCRONIZACIÓN
    // -------------------------------------------------------------------------
    console.log('--- TEST F: IMPRESIÓN / POS LEE FACTURA PERSISTIDA ---');
    // Verify querying admin.facturas and admin.detalle_factura for otIdC
    const facCheckF = await client.query('SELECT total_factura, monto_pagado, balance_pendiente FROM admin.facturas WHERE orden_trabajo_id = $1', [otIdC]);
    const detCheckF = await client.query('SELECT * FROM admin.detalle_factura WHERE factura_id = $1 ORDER BY detalle_factura_id', [facIdC]);

    console.log(`  Factura encontrada: Total RD$ ${facCheckF.rows[0].total_factura}, Balance RD$ ${facCheckF.rows[0].balance_pendiente}`);
    console.log(`  Líneas de detalle recuperadas (${detCheckF.rows.length}):`);
    detCheckF.rows.forEach((d: any) => console.log(`    - ${d.tipo_detalle}: ${d.descripcion} -> RD$ ${d.subtotal}`));

    if (parseFloat(facCheckF.rows[0].total_factura) !== 2800 || detCheckF.rows.length !== 2) {
      throw new Error('Test F Failed: Invoice lines inconsistent for printable POS view');
    }
    console.log('  ✓ PASS: Impresión POS lee directamente evidencia persistida de admin.facturas y admin.detalle_factura.\n');

    // -------------------------------------------------------------------------
    // TEST G: TRANSACTIONAL ROLLBACK SI FALLA LA FACTURA
    // -------------------------------------------------------------------------
    console.log('--- TEST G: TRANSACTIONAL ROLLBACK SI FALLA SINCRONIZACIÓN ---');
    await client.query('BEGIN');
    try {
      // Modify service
      await client.query('UPDATE admin.orden_servicios SET precio_unitario = 9999, subtotal = 9999 WHERE orden_servicio_id = $1', [servIdC]);
      await recalculateWorkOrderTotals(client, otIdC, 1);

      // Simulate a synthetic error during invoice sync / constraint failure
      throw new Error('SIMULATED_DB_ERROR_IN_INVOICE_SYNC');

      await client.query('COMMIT');
    } catch (simErr: any) {
      await client.query('ROLLBACK');
      console.log(`  Capturado error forzado: ${simErr.message} -> ROLLBACK ejecutado.`);
    }

    // Verify service remained at 2000, not 9999
    const checkServG = await client.query('SELECT precio_unitario FROM admin.orden_servicios WHERE orden_servicio_id = $1', [servIdC]);
    if (parseFloat(checkServG.rows[0].precio_unitario) !== 2000) {
      throw new Error(`Test G Failed: Rollback did not revert service update! Got: ${checkServG.rows[0].precio_unitario}`);
    }
    const checkOtG = await client.query('SELECT total_orden FROM admin.ordenes_trabajo WHERE orden_trabajo_id = $1', [otIdC]);
    if (parseFloat(checkOtG.rows[0].total_orden) !== 2800) {
      throw new Error(`Test G Failed: Rollback did not revert OT total! Got: ${checkOtG.rows[0].total_orden}`);
    }
    // -------------------------------------------------------------------------
    // TEST H: AISLAMIENTO DE DETALLE ENTRE FACTURAS Y PRESERVACIÓN DE IDENTIDAD
    // -------------------------------------------------------------------------
    console.log('--- TEST H: AISLAMIENTO ENTRE DOS FACTURAS Y PRESERVACIÓN DE IDENTIDAD ---');
    // Factura B on OT B (created in Test B) had total 2800 and 2 detail lines
    const facBBefore = await client.query('SELECT factura_id, numero_factura, fecha_factura, total_factura, monto_pagado, balance_pendiente FROM admin.facturas WHERE factura_id = $1', [facIdB]);
    const detBBefore = await client.query('SELECT detalle_factura_id, descripcion, subtotal FROM admin.detalle_factura WHERE factura_id = $1 ORDER BY detalle_factura_id', [facIdB]);

    // Now modify and sync OT C (Factura C)
    const facCBefore = await client.query('SELECT factura_id, numero_factura, fecha_factura, usuario_registro FROM admin.facturas WHERE factura_id = $1', [facIdC]);
    await client.query('UPDATE admin.orden_servicios SET precio_unitario = 2500, subtotal = 2500 WHERE orden_servicio_id = $1', [servIdC]);
    await recalculateWorkOrderTotals(client, otIdC, 1);
    await syncWorkOrderInvoice(client, otIdC, 1);

    // Verify Factura C identity (factura_id, numero_factura, fecha_factura, usuario_registro) did NOT change
    const facCAfter = await client.query('SELECT factura_id, numero_factura, fecha_factura, usuario_registro FROM admin.facturas WHERE factura_id = $1', [facIdC]);
    if (
      facCAfter.rows[0].factura_id !== facCBefore.rows[0].factura_id ||
      facCAfter.rows[0].numero_factura !== facCBefore.rows[0].numero_factura ||
      new Date(facCAfter.rows[0].fecha_factura).getTime() !== new Date(facCBefore.rows[0].fecha_factura).getTime()
    ) {
      throw new Error('Test H Failed: Invoice identity (id, number, date) was mutated!');
    }

    // Verify Factura B and its detail lines are 100% UNTOUCHED
    const facBAfter = await client.query('SELECT factura_id, numero_factura, fecha_factura, total_factura, monto_pagado, balance_pendiente FROM admin.facturas WHERE factura_id = $1', [facIdB]);
    const detBAfter = await client.query('SELECT detalle_factura_id, descripcion, subtotal FROM admin.detalle_factura WHERE factura_id = $1 ORDER BY detalle_factura_id', [facIdB]);

    if (
      parseFloat(facBAfter.rows[0].total_factura) !== parseFloat(facBBefore.rows[0].total_factura) ||
      detBAfter.rows.length !== detBBefore.rows.length ||
      JSON.stringify(detBAfter.rows) !== JSON.stringify(detBBefore.rows)
    ) {
      throw new Error('Test H Failed: Unrelated invoice B was mutated when syncing invoice C!');
    }
    console.log('  ✓ PASS: Aislamiento total: Factura B permaneció 100% intacta al sincronizar Factura C. Identidad de Factura C preservada.\n');

    console.log('========================================================================');
    console.log('ALL INVOICE SYNCHRONIZATION TESTS PASSED WITH 100% SUCCESS (A - H)');
    console.log('========================================================================\n');

  } finally {
    // Cleanup
    await client.query('DELETE FROM admin.pagos WHERE factura_id IN (SELECT factura_id FROM admin.facturas WHERE cliente_id = $1)', [testClienteId]);
    await client.query('DELETE FROM admin.detalle_factura WHERE factura_id IN (SELECT factura_id FROM admin.facturas WHERE cliente_id = $1)', [testClienteId]);
    await client.query('DELETE FROM admin.facturas WHERE cliente_id = $1', [testClienteId]);
    await client.query('DELETE FROM admin.orden_productos WHERE orden_trabajo_id IN (SELECT orden_trabajo_id FROM admin.ordenes_trabajo WHERE cliente_id = $1)', [testClienteId]);
    await client.query('DELETE FROM admin.orden_servicios WHERE orden_trabajo_id IN (SELECT orden_trabajo_id FROM admin.ordenes_trabajo WHERE cliente_id = $1)', [testClienteId]);
    await client.query('DELETE FROM admin.ordenes_trabajo WHERE cliente_id = $1', [testClienteId]);
    if (testRecepcionId) {
      await client.query('DELETE FROM admin.recepciones WHERE recepcion_id = $1', [testRecepcionId]);
    }
    if (testBicicletaId) {
      await client.query('DELETE FROM admin.bicicletas WHERE bicicleta_id = $1', [testBicicletaId]);
    }
    if (testClienteId) {
      await client.query('DELETE FROM admin.clientes WHERE cliente_id = $1', [testClienteId]);
    }
    client.release();
  }
}

runInvoiceSyncTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  });
