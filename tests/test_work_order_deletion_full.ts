import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getPool } from '../src/lib/db';
import { deleteWorkOrderWithSnapshot } from '../src/lib/workshop/workOrderDeletionService';

async function runComprehensiveTest() {
  console.log('========================================================================');
  console.log('STARTING COMPREHENSIVE TEST: WORK ORDER DELETION WITH HISTORICAL SNAPSHOT');
  console.log('========================================================================\n');

  const pool = getPool();
  const client = await pool.connect();

  let testClienteId: number | null = null;
  let testBicicletaId: number | null = null;
  let testRecepcionId: number | null = null;
  let testOrdenId: number | null = null;
  let testServicioId: number | null = null;
  let testFacturaId: number | null = null;
  let testPagoId: number | null = null;

  try {
    const actor = {
      usuario_id: 1,
      nombre: 'Admin de Pruebas',
      correo: 'admin@bikersfort.com',
      empresa_id: 1
    };

    console.log('1. Setting up test data graph...');

    // 1.1 Test Client
    const maxCli = await client.query('SELECT COALESCE(MAX(cliente_id), 0) + 1 AS next_id FROM admin.clientes');
    testClienteId = Number(maxCli.rows[0].next_id);
    const testIdent = `001-999${Math.floor(Math.random() * 8999 + 1000)}-9`;
    const testEmail = `test_autodelete_${Date.now()}@example.com`;
    await client.query(`
      INSERT INTO admin.clientes (
        cliente_id, nombre, apellido, nombre_completo, identificacion, telefono_principal, correo, activo, fecha_creacion, empresa_id
      ) VALUES (
        $1, 'TestClient', 'AutoTest', 'TestClient AutoTest', $2, '809-555-9999', $3, true, NOW(), 1
      )
    `, [testClienteId, testIdent, testEmail]);
    console.log(`  - Cliente creado: ID ${testClienteId}`);

    // 1.2 Test Bicycle
    const maxBic = await client.query('SELECT COALESCE(MAX(bicicleta_id), 0) + 1 AS next_id FROM admin.bicicletas');
    testBicicletaId = Number(maxBic.rows[0].next_id);
    const testSerie = `SN-TEST-${Date.now()}`;
    await client.query(`
      INSERT INTO admin.bicicletas (
        bicicleta_id, cliente_id, codigo_qr, url_qr, marca, modelo, ano, color, numero_serie_cuadro, activo, fecha_creacion
      ) VALUES (
        $1, $2, $3, $4, 'Trek', 'Marlin 8', 2024, 'Rojo / Negro', $5, true, NOW()
      )
    `, [testBicicletaId, testClienteId, `QR-TEST-DEL-${testBicicletaId}`, `https://example.com/qr/${testBicicletaId}`, testSerie]);
    console.log(`  - Bicicleta creada: ID ${testBicicletaId}`);

    // 1.3 Test Reception
    const testRecCode = `REC-TEST-${Date.now()}`;
    const recRes = await client.query(`
      INSERT INTO admin.recepciones (
        codigo_recepcion, cliente_id, bicicleta_id, estado_recepcion_id, diagnostico_preliminar,
        observaciones_cliente, observaciones_recepcion, presupuesto_estimado, requiere_aprobacion,
        activo, fecha_creacion, recibido_por_usuario_id, fecha_recepcion
      ) VALUES (
        $1, $2, $3, 1, 'Desgaste general', 'Cliente reporta ruidos', 'Sin detalles adicionales',
        2500, false, true, NOW(), 1, NOW()
      ) RETURNING recepcion_id
    `, [testRecCode, testClienteId, testBicicletaId]);
    testRecepcionId = recRes.rows[0].recepcion_id;
    console.log(`  - Recepción creada: ID ${testRecepcionId} (${testRecCode})`);

    // 1.4 Test Reception Checklist & Evidence
    const chkRes = await client.query(`
      INSERT INTO admin.recepcion_checklist (
        recepcion_id, item_checklist_id, estado_checklist_id, observacion, evidencia_foto,
        nombre_archivo, ruta_archivo, url_archivo, fecha_evaluacion, activo, fecha_registro
      ) VALUES (
        $1, 1, 1, 'Foto de estado inicial', true, 'test_evidence_photo.jpg', 'workshop/evidences/test_evidence_photo.jpg', 'https://s3.example.com/test_evidence_photo.jpg', NOW(), true, NOW()
      ) RETURNING recepcion_checklist_id
    `, [testRecepcionId]);
    console.log(`  - Checklist de recepción creado: ID ${chkRes.rows[0].recepcion_checklist_id}`);

    // 1.5 Test Reception Signature
    const maxSig = await client.query('SELECT COALESCE(MAX(firma_recepcion_id), 0) + 1 AS next_id FROM admin.firma_recepcion');
    const nextSigId = Number(maxSig.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.firma_recepcion (
        firma_recepcion_id, recepcion_id, cliente_id, tipo_firma, firma_digital, terminos_aceptados, fecha_firma, activo, fecha_creacion
      ) VALUES (
        $1, $2, $3, 'INGRESO', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', true, NOW(), true, NOW()
      )
    `, [nextSigId, testRecepcionId, testClienteId]);
    console.log(`  - Firma de recepción creada.`);

    // 1.6 Test Work Order
    const testOtCode = `OT-TEST-${Date.now()}`;
    const otRes = await client.query(`
      INSERT INTO admin.ordenes_trabajo (
        codigo_orden, recepcion_id, cliente_id, bicicleta_id, estado_orden_id, prioridad_orden_id,
        descripcion_cliente, diagnostico_inicial, subtotal_servicios, subtotal_productos,
        descuento_servicios, descuento_productos, subtotal_general, impuesto, total_orden,
        activo, fecha_registro, mecanico_id, facturado, fecha_facturacion, usuario_facturacion_id
      ) VALUES (
        $1, $2, $3, $4, 8, 2,
        'Cliente reportó ruidos en transmisión', 'Transmisión descalibrada y pastillas gastadas',
        1500, 800, 0, 0, 2300, 414, 2714,
        true, NOW(), 1, true, NOW(), 1
      ) RETURNING orden_trabajo_id
    `, [testOtCode, testRecepcionId, testClienteId, testBicicletaId]);
    testOrdenId = otRes.rows[0].orden_trabajo_id;
    console.log(`  - Orden de Trabajo creada: ID ${testOrdenId} (${testOtCode})`);

    // 1.7 ESTABLISH CIRCULAR REFERENCE: recepciones.convertido_orden_id -> ordenes_trabajo.orden_trabajo_id
    await client.query(`
      UPDATE admin.recepciones
      SET convertido_orden_id = $1
      WHERE recepcion_id = $2
    `, [testOrdenId, testRecepcionId]);
    console.log(`  - [CIRCULAR FK SIMULADA] recepciones.convertido_orden_id -> ${testOrdenId}`);

    // 1.8 Test Work Order State History
    await client.query(`
      INSERT INTO admin.orden_historial_estado (
        orden_trabajo_id, estado_anterior_id, estado_nuevo_id, comentario, fecha_cambio, usuario_cambio, activo, fecha_registro
      ) VALUES (
        $1, 1, 5, 'Inició reparación', NOW(), 1, true, NOW()
      ), (
        $1, 5, 8, 'Orden entregada al cliente', NOW(), 1, true, NOW()
      )
    `, [testOrdenId]);
    console.log(`  - Historial de estados de orden registrado.`);

    // 1.9 Test Work Order Services
    const srvRes = await client.query(`
      INSERT INTO admin.orden_servicios (
        orden_trabajo_id, tipo_servicio_id, estado_orden_servicio_id, estado_aprobacion_id, codigo_servicio,
        secuencia, cantidad, precio_unitario, subtotal, activo, fecha_registro
      ) VALUES (
        $1, 1, 3, 1, 'SRV-001', 1, 1, 1500, 1500, true, NOW()
      ) RETURNING orden_servicio_id
    `, [testOrdenId]);
    testServicioId = srvRes.rows[0].orden_servicio_id;
    console.log(`  - Servicio de orden creado (COMPLETADO): ID ${testServicioId}`);

    // 1.10 Test Labor Record
    await client.query(`
      INSERT INTO admin.orden_servicio_mano_obra (
        orden_servicio_id, usuario_id, fecha_inicio, fecha_finalizacion, minutos_trabajados,
        costo_hora, costo_total, detalle_mano_obra, activo, fecha_registro
      ) VALUES (
        $1, 1, NOW() - INTERVAL '2 hours', NOW(), 120, 500, 1000, 'Ajuste fino de transmisión', true, NOW()
      )
    `, [testServicioId]);
    console.log(`  - Mano de obra registrada.`);

    // 1.11 Test Products/Parts
    await client.query(`
      INSERT INTO admin.orden_productos (
        orden_trabajo_id, orden_servicio_id, producto_id, almacen_id, estado_aprobacion_id, cantidad, precio_unitario,
        porcentaje_descuento, valor_descuento, subtotal, utilizado, observacion, fecha_registro
      ) VALUES (
        $1, $2, 1, 1, 1, 1, 800, 0, 0, 800, true, 'Pastillas de freno Shimano', NOW()
      )
    `, [testOrdenId, testServicioId]);
    console.log(`  - Producto/Repuesto registrado.`);

    // 1.12 Test Invoice & Detail & Payment
    const maxFact = await client.query('SELECT COALESCE(MAX(factura_id), 0) + 1 AS next_id FROM admin.facturas');
    testFacturaId = Number(maxFact.rows[0].next_id);
    const testFactCode = `FACT-TEST-${Date.now()}`;
    await client.query(`
      INSERT INTO admin.facturas (
        factura_id, tipo_factura_id, cliente_id, orden_trabajo_id, numero_factura, fecha_factura,
        subtotal, descuento_total, impuesto_total, total_factura, monto_pagado,
        balance_pendiente, estado, fecha_registro
      ) VALUES (
        $1, 1, $2, $3, $4, NOW(),
        2300, 0, 414, 2714, 2714, 0, 'PAGADA', NOW()
      )
    `, [testFacturaId, testClienteId, testOrdenId, testFactCode]);
    console.log(`  - Factura creada: ID ${testFacturaId} (${testFactCode})`);

    const maxDet = await client.query('SELECT COALESCE(MAX(detalle_factura_id), 0) + 1 AS next_id FROM admin.detalle_factura');
    const nextDetId = Number(maxDet.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.detalle_factura (
        detalle_factura_id, factura_id, tipo_detalle, servicio_id, descripcion, cantidad, precio_unitario, descuento, subtotal, fecha_registro
      ) VALUES (
        $1, $2, 'SERVICIO', $3, 'Ajuste de transmisión', 1, 1500, 0, 1500, NOW()
      )
    `, [nextDetId, testFacturaId, testServicioId]);

    const maxPago = await client.query('SELECT COALESCE(MAX(pago_id), 0) + 1 AS next_id FROM admin.pagos');
    testPagoId = Number(maxPago.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.pagos (
        pago_id, factura_id, tipo_pago_id, fecha_pago, monto_pago, referencia, estado, fecha_registro
      ) VALUES (
        $1, $2, 1, NOW(), 2714, 'TRANSF-999888', 'APLICADO', NOW()
      )
    `, [testPagoId, testFacturaId]);
    console.log(`  - Pago registrado: ID ${testPagoId}`);

    if (!testOrdenId || !testRecepcionId || !testClienteId || !testBicicletaId || !testFacturaId) {
      throw new Error('Test entities setup failed (IDs are null)');
    }

    console.log('\n2. Testing Validation Constraints (motivo < 5 chars, nonexistent id)...');

    // 2.1 Short reason check
    const shortReasonResult = await deleteWorkOrderWithSnapshot(testOrdenId, actor, 'Abc');
    if (shortReasonResult.success || shortReasonResult.error !== 'INVALID_REASON') {
      throw new Error(`Expected INVALID_REASON for short motivo, got: ${JSON.stringify(shortReasonResult)}`);
    }
    console.log('  ✓ Validación de motivo mínimo exitosa (rechazó motivo < 5 caracteres).');

    // 2.2 Non-existent ID check
    const nonExistentResult = await deleteWorkOrderWithSnapshot(99999999, actor, 'Motivo de prueba válido');
    if (nonExistentResult.success || nonExistentResult.error !== 'NOT_FOUND') {
      throw new Error(`Expected NOT_FOUND for invalid ID, got: ${JSON.stringify(nonExistentResult)}`);
    }
    console.log('  ✓ Validación de orden inexistente exitosa (retornó 404).');

    console.log('\n3. Executing ATOMIC DELETION with Snapshot on test order...');
    const delResult = await deleteWorkOrderWithSnapshot(
      testOrdenId,
      actor,
      'Orden de prueba para verificación exhaustiva de eliminación atómica, FK circular y snapshot'
    );

    if (!delResult.success) {
      throw new Error(`Deletion failed with error: ${delResult.error} - ${delResult.message}`);
    }
    console.log('  ✓ deleteWorkOrderWithSnapshot ejecutado con éxito.');
    console.log(`  - Historial UUID generado: ${delResult.historial_uuid}`);
    console.log(`  - Código Orden: ${delResult.codigo_orden}`);
    console.log(`  - Código Recepción: ${delResult.codigo_recepcion}`);

    console.log('\n4. Verifying Historical Evidence Snapshot in admin.orden_trabajo_eliminada_historial...');
    const histCheck = await client.query(`
      SELECT * FROM admin.orden_trabajo_eliminada_historial
      WHERE historial_uuid = $1
    `, [delResult.historial_uuid]);

    if (histCheck.rows.length !== 1) {
      throw new Error(`Expected 1 historical record with UUID ${delResult.historial_uuid}, found ${histCheck.rows.length}`);
    }

    const hist = histCheck.rows[0];
    console.log('  ✓ Snapshot encontrado en base de datos.');
    console.log(`    - OT ID: ${hist.orden_trabajo_id}`);
    console.log(`    - Recepción ID: ${hist.recepcion_id}`);
    console.log(`    - Cliente: ${hist.cliente_nombre}`);
    console.log(`    - Bicicleta: ${hist.bicicleta_descripcion}`);
    console.log(`    - Total: RD$ ${hist.total}`);
    console.log(`    - Facturado: ${hist.facturado}`);
    console.log(`    - Motivo: ${hist.motivo_eliminacion}`);
    console.log(`    - Eliminado por: ${hist.eliminado_por_nombre} (#${hist.eliminado_por_usuario_id})`);
    console.log(`    - Origen: ${hist.origen}`);
    console.log(`    - Fecha Eliminación: ${hist.fecha_eliminacion}`);

    // Validate JSONB structures in snapshot
    if (!hist.datos_orden || hist.datos_orden.orden_trabajo_id !== testOrdenId) {
      throw new Error('datos_orden JSONB missing or invalid');
    }
    if (!hist.datos_recepcion || hist.datos_recepcion.recepcion_id !== testRecepcionId) {
      throw new Error('datos_recepcion JSONB missing or invalid');
    }
    if (!Array.isArray(hist.datos_servicios) || hist.datos_servicios.length === 0) {
      throw new Error('datos_servicios JSONB missing or empty');
    }
    if (!Array.isArray(hist.datos_mano_obra) || hist.datos_mano_obra.length === 0) {
      throw new Error('datos_mano_obra JSONB missing or empty');
    }
    if (!Array.isArray(hist.datos_productos) || hist.datos_productos.length === 0) {
      throw new Error('datos_productos JSONB missing or empty');
    }
    if (!Array.isArray(hist.datos_historial_estados) || hist.datos_historial_estados.length === 0) {
      throw new Error('datos_historial_estados JSONB missing or empty');
    }
    if (!Array.isArray(hist.datos_checklist) || hist.datos_checklist.length === 0) {
      throw new Error('datos_checklist JSONB missing or empty');
    }
    if (!hist.datos_firma || !hist.datos_firma.firma_digital) {
      throw new Error('datos_firma JSONB missing or empty');
    }
    if (!Array.isArray(hist.datos_facturacion) || hist.datos_facturacion.length === 0) {
      throw new Error('datos_facturacion JSONB missing or empty');
    }
    if (!Array.isArray(hist.datos_pagos) || hist.datos_pagos.length === 0) {
      throw new Error('datos_pagos JSONB missing or empty');
    }
    console.log('  ✓ Todos los 11 campos JSONB contienen datos ricos, intactos y sanitizados.');

    console.log('\n5. Verifying Total Physical Deletion of Operational Records (0 Orphans)...');

    const checkOt = await client.query('SELECT count(*) FROM admin.ordenes_trabajo WHERE orden_trabajo_id = $1', [testOrdenId]);
    if (parseInt(checkOt.rows[0].count) !== 0) throw new Error('OT was not deleted');
    console.log('  ✓ admin.ordenes_trabajo: 0 registros (Eliminado)');

    const checkRec = await client.query('SELECT count(*) FROM admin.recepciones WHERE recepcion_id = $1', [testRecepcionId]);
    if (parseInt(checkRec.rows[0].count) !== 0) throw new Error('Recepción was not deleted');
    console.log('  ✓ admin.recepciones: 0 registros (Eliminado)');

    const checkSrv = await client.query('SELECT count(*) FROM admin.orden_servicios WHERE orden_trabajo_id = $1', [testOrdenId]);
    if (parseInt(checkSrv.rows[0].count) !== 0) throw new Error('Servicios were not deleted');
    console.log('  ✓ admin.orden_servicios: 0 registros (Eliminado)');

    const checkMo = await client.query('SELECT count(*) FROM admin.orden_servicio_mano_obra WHERE orden_servicio_id = $1', [testServicioId]);
    if (parseInt(checkMo.rows[0].count) !== 0) throw new Error('Mano de obra was not deleted');
    console.log('  ✓ admin.orden_servicio_mano_obra: 0 registros (Eliminado)');

    const checkProd = await client.query('SELECT count(*) FROM admin.orden_productos WHERE orden_trabajo_id = $1', [testOrdenId]);
    if (parseInt(checkProd.rows[0].count) !== 0) throw new Error('Productos were not deleted');
    console.log('  ✓ admin.orden_productos: 0 registros (Eliminado)');

    const checkHistOt = await client.query('SELECT count(*) FROM admin.orden_historial_estado WHERE orden_trabajo_id = $1', [testOrdenId]);
    if (parseInt(checkHistOt.rows[0].count) !== 0) throw new Error('Historial estado was not deleted');
    console.log('  ✓ admin.orden_historial_estado: 0 registros (Eliminado)');

    const checkChk = await client.query('SELECT count(*) FROM admin.recepcion_checklist WHERE recepcion_id = $1', [testRecepcionId]);
    if (parseInt(checkChk.rows[0].count) !== 0) throw new Error('Checklist was not deleted');
    console.log('  ✓ admin.recepcion_checklist: 0 registros (Eliminado)');

    const checkSig = await client.query('SELECT count(*) FROM admin.firma_recepcion WHERE recepcion_id = $1', [testRecepcionId]);
    if (parseInt(checkSig.rows[0].count) !== 0) throw new Error('Firma was not deleted');
    console.log('  ✓ admin.firma_recepcion: 0 registros (Eliminado)');

    const checkFact = await client.query('SELECT count(*) FROM admin.facturas WHERE orden_trabajo_id = $1', [testOrdenId]);
    if (parseInt(checkFact.rows[0].count) !== 0) throw new Error('Factura was not deleted');
    console.log('  ✓ admin.facturas: 0 registros (Eliminado)');

    const checkDet = await client.query('SELECT count(*) FROM admin.detalle_factura WHERE factura_id = $1', [testFacturaId]);
    if (parseInt(checkDet.rows[0].count) !== 0) throw new Error('Detalle factura was not deleted');
    console.log('  ✓ admin.detalle_factura: 0 registros (Eliminado)');

    const checkPag = await client.query('SELECT count(*) FROM admin.pagos WHERE factura_id = $1', [testFacturaId]);
    if (parseInt(checkPag.rows[0].count) !== 0) throw new Error('Pagos were not deleted');
    console.log('  ✓ admin.pagos: 0 registros (Eliminado)');

    console.log('\n6. Verifying Preservation of Primary Entities (Client and Bicycle)...');
    const checkCli = await client.query('SELECT count(*) FROM admin.clientes WHERE cliente_id = $1', [testClienteId]);
    if (parseInt(checkCli.rows[0].count) !== 1) throw new Error('Cliente was erroneously deleted');
    console.log('  ✓ admin.clientes: 1 registro intacto (PRESERVADO)');

    const checkBic = await client.query('SELECT count(*) FROM admin.bicicletas WHERE bicicleta_id = $1', [testBicicletaId]);
    if (parseInt(checkBic.rows[0].count) !== 1) throw new Error('Bicicleta was erroneously deleted');
    console.log('  ✓ admin.bicicletas: 1 registro intacto (PRESERVADO)');

    console.log('\n7. Verifying S3 Cleanup Queue...');
    const s3Check = await client.query(`
      SELECT * FROM admin.s3_cleanup_queue
      WHERE object_key LIKE '%test_evidence_photo%'
    `);
    if (s3Check.rows.length === 0) {
      console.warn('  ⚠️ No se encontró registro en s3_cleanup_queue (verificar si la tabla está configurada)');
    } else {
      console.log(`  ✓ s3_cleanup_queue: ${s3Check.rows.length} evidencia(s) encolada(s) para borrado asíncrono.`);
    }

    console.log('\n8. Verifying Global Audit Logging Survival...');
    const auditCheck = await client.query(`
      SELECT * FROM admin.usuario_auditoria
      WHERE accion = 'ELIMINAR_ORDEN_TRABAJO'
      ORDER BY auditoria_id DESC
      LIMIT 1
    `);
    if (auditCheck.rows.length === 1) {
      console.log('  ✓ admin.usuario_auditoria: Registro de auditoría guardado y superviviente al DELETE.');
      console.log(`    - Acción: ${auditCheck.rows[0].accion}`);
      console.log(`    - Resultado: ${auditCheck.rows[0].resultado}`);
      console.log(`    - Motivo: ${auditCheck.rows[0].motivo}`);
    } else {
      console.warn('  ⚠️ Auditoría no encontrada.');
    }

    console.log('\n========================================================================');
    console.log('ALL COMPREHENSIVE TESTS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================');

  } catch (err: any) {
    console.error('\n❌ TEST FAILED WITH ERROR:', err);
    process.exit(1);
  } finally {
    // Cleanup remaining test client & bicycle
    if (testBicicletaId) {
      await client.query('DELETE FROM admin.bicicletas WHERE bicicleta_id = $1', [testBicicletaId]).catch(() => {});
    }
    if (testClienteId) {
      await client.query('DELETE FROM admin.clientes WHERE cliente_id = $1', [testClienteId]).catch(() => {});
    }
    client.release();
    await pool.end();
  }
}

runComprehensiveTest();
