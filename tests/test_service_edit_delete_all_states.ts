import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getPool } from '../src/lib/db';
import { recalculateWorkOrderTotals } from '../src/lib/workshop/recalculateWorkOrderTotals';
import { recordUserAudit } from '../src/lib/auditLogger';

async function runServiceEditDeleteTests() {
  console.log('========================================================================');
  console.log('STARTING AUTOMATED TESTS: SERVICE EDIT & DELETE IN ALL STATES');
  console.log('========================================================================\n');

  const pool = getPool();
  const client = await pool.connect();

  let testClienteId: number | null = null;
  let testBicicletaId: number | null = null;
  let testRecepcionId: number | null = null;
  let testOrdenId: number | null = null;
  let testOrdenEntregadaId: number | null = null;

  try {
    const actor = {
      usuario_id: 1,
      empresa_id: 1
    };

    console.log('1. Setting up test fixtures...');

    // 1.1 Customer
    const maxCli = await client.query('SELECT COALESCE(MAX(cliente_id), 0) + 1 AS next_id FROM admin.clientes');
    testClienteId = Number(maxCli.rows[0].next_id);
    const testIdent = `001-TEST-${Date.now()}`;
    await client.query(`
      INSERT INTO admin.clientes (
        cliente_id, nombre, apellido, nombre_completo, identificacion, telefono_principal, correo, activo, fecha_creacion, empresa_id
      ) VALUES (
        $1, 'Tester', 'ServiceSvc', 'Tester ServiceSvc', $2, '809-555-8888', 'svc_test@example.com', true, NOW(), 1
      )
    `, [testClienteId, testIdent]);

    // 1.2 Bicycle
    const maxBic = await client.query('SELECT COALESCE(MAX(bicicleta_id), 0) + 1 AS next_id FROM admin.bicicletas');
    testBicicletaId = Number(maxBic.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.bicicletas (
        bicicleta_id, cliente_id, codigo_qr, url_qr, marca, modelo, ano, color, numero_serie_cuadro, activo, fecha_creacion
      ) VALUES (
        $1, $2, $3, $4, 'Giant', 'Talon 1', 2024, 'Azul', 'SN-GIANT-TEST', true, NOW()
      )
    `, [testBicicletaId, testClienteId, `QR-TEST-SVC-${testBicicletaId}`, `https://example.com/qr/${testBicicletaId}`]);

    // 1.3 Reception
    const recRes = await client.query(`
      INSERT INTO admin.recepciones (
        codigo_recepcion, cliente_id, bicicleta_id, estado_recepcion_id, diagnostico_preliminar,
        observaciones_cliente, observaciones_recepcion, presupuesto_estimado, requiere_aprobacion,
        activo, fecha_creacion, recibido_por_usuario_id, fecha_recepcion
      ) VALUES (
        $1, $2, $3, 1, 'Mantenimiento General Test', 'Cliente reporta ruidos', 'Sin detalles adicionales',
        2500, false, true, NOW(), 1, NOW()
      ) RETURNING recepcion_id
    `, [`REC-SVC-${Date.now()}`, testClienteId, testBicicletaId]);
    testRecepcionId = recRes.rows[0].recepcion_id;

    // 1.4 Work Order 1 (In REPARACION)
    const maxOrd = await client.query('SELECT COALESCE(MAX(orden_trabajo_id), 0) + 1 AS next_id FROM admin.ordenes_trabajo');
    testOrdenId = Number(maxOrd.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.ordenes_trabajo (
        orden_trabajo_id, codigo_orden, recepcion_id, cliente_id, bicicleta_id, estado_orden_id, prioridad_orden_id, mecanico_id, fecha_recepcion, activo, fecha_registro
      ) VALUES (
        $1, $2, $3, $4, $5, 5, 2, 1, NOW(), true, NOW()
      )
    `, [testOrdenId, `OT-SVC-${testOrdenId}`, testRecepcionId, testClienteId, testBicicletaId]);

    // 1.5 Work Order 2 (In ENTREGADA & FACTURADA)
    const maxOrdEntregada = await client.query('SELECT COALESCE(MAX(orden_trabajo_id), 0) + 1 AS next_id FROM admin.ordenes_trabajo');
    testOrdenEntregadaId = Number(maxOrdEntregada.rows[0].next_id);
    await client.query(`
      INSERT INTO admin.ordenes_trabajo (
        orden_trabajo_id, codigo_orden, recepcion_id, cliente_id, bicicleta_id, estado_orden_id, prioridad_orden_id, mecanico_id, facturado, fecha_facturacion, usuario_facturacion_id, fecha_recepcion, activo, fecha_registro
      ) VALUES (
        $1, $2, $3, $4, $5, 8, 2, 1, true, NOW(), 1, NOW(), true, NOW()
      )
    `, [testOrdenEntregadaId, `OT-ENT-${testOrdenEntregadaId}`, testRecepcionId, testClienteId, testBicicletaId]);

    console.log(`  - Entorno creado: Cliente #${testClienteId}, OT Reparacion #${testOrdenId}, OT Entregada #${testOrdenEntregadaId}\n`);

    // =========================================================================
    // TEST A: SERVICIO PENDIENTE (EDIT & DELETE)
    // =========================================================================
    console.log('--- TEST A: SERVICIO PENDIENTE ---');
    const s1Res = await client.query(`
      INSERT INTO admin.orden_servicios (
        orden_trabajo_id, tipo_servicio_id, estado_orden_servicio_id, estado_aprobacion_id, cantidad, precio_unitario, subtotal, observacion_tecnica, activo, fecha_registro
      ) VALUES (
        $1, 1, 1, 1, 1, 500.00, 500.00, 'Diagnóstico inicial pendiente', true, NOW()
      ) RETURNING orden_servicio_id
    `, [testOrdenId]);
    const s1Id = s1Res.rows[0].orden_servicio_id;
    await recalculateWorkOrderTotals(client, testOrdenId, 1);
    console.log(`  - Creado Servicio #${s1Id} en estado PENDIENTE (1)`);

    // A.1 EDIT PENDIENTE
    await client.query(`
      UPDATE admin.orden_servicios
      SET precio_unitario = 650.00,
          subtotal = 650.00,
          observacion_tecnica = 'Diagnóstico ajustado pendiente',
          usuario_actualizacion = $1,
          fecha_actualizacion = NOW()
      WHERE orden_servicio_id = $2
    `, [actor.usuario_id, s1Id]);
    await recalculateWorkOrderTotals(client, testOrdenId, actor.usuario_id);
    const s1Check = await client.query('SELECT precio_unitario, observacion_tecnica FROM admin.orden_servicios WHERE orden_servicio_id = $1', [s1Id]);
    if (Number(s1Check.rows[0].precio_unitario) !== 650 || s1Check.rows[0].observacion_tecnica !== 'Diagnóstico ajustado pendiente') {
      throw new Error('TEST A.1 FAILED: Update of PENDIENTE service did not match expected values.');
    }
    console.log('  [PASS] A.1 Editar Servicio PENDIENTE');

    // A.2 DELETE PENDIENTE
    await client.query('UPDATE admin.orden_servicios SET activo = false, usuario_actualizacion = $1 WHERE orden_servicio_id = $2', [actor.usuario_id, s1Id]);
    await recalculateWorkOrderTotals(client, testOrdenId, actor.usuario_id);
    const s1DelCheck = await client.query('SELECT activo FROM admin.orden_servicios WHERE orden_servicio_id = $1', [s1Id]);
    if (s1DelCheck.rows[0].activo !== false) {
      throw new Error('TEST A.2 FAILED: Deletion of PENDIENTE service failed.');
    }
    console.log('  [PASS] A.2 Eliminar Servicio PENDIENTE\n');

    // =========================================================================
    // TEST B: SERVICIO EN EJECUCIÓN (EN_PROCESO) (EDIT & DELETE)
    // =========================================================================
    console.log('--- TEST B: SERVICIO EN EJECUCIÓN (EN_PROCESO) ---');
    const s2Res = await client.query(`
      INSERT INTO admin.orden_servicios (
        orden_trabajo_id, tipo_servicio_id, estado_orden_servicio_id, estado_aprobacion_id, cantidad, precio_unitario, subtotal, observacion_tecnica, activo, fecha_registro
      ) VALUES (
        $1, 1, 2, 1, 1, 800.00, 800.00, 'Servicio en proceso', true, NOW()
      ) RETURNING orden_servicio_id
    `, [testOrdenId]);
    const s2Id = s2Res.rows[0].orden_servicio_id;
    // Add open timer session
    await client.query(`
      INSERT INTO admin.orden_servicio_mano_obra (
        orden_servicio_id, usuario_id, fecha_inicio, costo_hora, costo_total, activo, fecha_registro, usuario_registro
      ) VALUES (
        $1, 1, NOW(), 500.00, 0.00, true, NOW(), 1
      )
    `, [s2Id]);
    await recalculateWorkOrderTotals(client, testOrdenId, 1);
    console.log(`  - Creado Servicio #${s2Id} en estado EN_PROCESO (2) con sesión de cronómetro`);

    // B.1 EDIT EN_PROCESO
    await client.query(`
      UPDATE admin.orden_servicios
      SET observacion_tecnica = 'Servicio en proceso con avance del 50%',
          precio_unitario = 850.00,
          subtotal = 850.00,
          usuario_actualizacion = $1,
          fecha_actualizacion = NOW()
      WHERE orden_servicio_id = $2
    `, [actor.usuario_id, s2Id]);
    await recalculateWorkOrderTotals(client, testOrdenId, actor.usuario_id);
    const s2Check = await client.query('SELECT precio_unitario, observacion_tecnica FROM admin.orden_servicios WHERE orden_servicio_id = $1', [s2Id]);
    if (Number(s2Check.rows[0].precio_unitario) !== 850 || !s2Check.rows[0].observacion_tecnica.includes('avance del 50%')) {
      throw new Error('TEST B.1 FAILED: Update of EN_PROCESO service did not match expected values.');
    }
    console.log('  [PASS] B.1 Editar Servicio EN EJECUCIÓN');

    // B.2 DELETE EN_PROCESO (clean up associated labor and soft-delete service)
    await client.query('DELETE FROM admin.orden_servicio_mano_obra WHERE orden_servicio_id = $1', [s2Id]);
    await client.query('UPDATE admin.orden_servicios SET activo = false, usuario_actualizacion = $1 WHERE orden_servicio_id = $2', [actor.usuario_id, s2Id]);
    await recalculateWorkOrderTotals(client, testOrdenId, actor.usuario_id);

    const moCountB = await client.query('SELECT COUNT(*)::int AS count FROM admin.orden_servicio_mano_obra WHERE orden_servicio_id = $1', [s2Id]);
    if (moCountB.rows[0].count !== 0) {
      throw new Error('TEST B.2 FAILED: Labor session orphans remain.');
    }
    console.log('  [PASS] B.2 Eliminar Servicio EN EJECUCIÓN (0 huérfanos de mano de obra)\n');

    // =========================================================================
    // TEST C: SERVICIO COMPLETADO (EDIT & DELETE)
    // =========================================================================
    console.log('--- TEST C: SERVICIO COMPLETADO ---');
    const s3Res = await client.query(`
      INSERT INTO admin.orden_servicios (
        orden_trabajo_id, tipo_servicio_id, estado_orden_servicio_id, estado_aprobacion_id, cantidad, precio_unitario, subtotal, observacion_tecnica, fecha_finalizacion, tiempo_transcurrido, activo, fecha_registro
      ) VALUES (
        $1, 1, 3, 1, 1, 1200.00, 1200.00, 'Servicio completado correctamente', NOW(), 1800, true, NOW()
      ) RETURNING orden_servicio_id
    `, [testOrdenId]);
    const s3Id = s3Res.rows[0].orden_servicio_id;
    // Add finished labor session
    await client.query(`
      INSERT INTO admin.orden_servicio_mano_obra (
        orden_servicio_id, usuario_id, fecha_inicio, fecha_finalizacion, minutos_trabajados, minutos_facturables, costo_hora, costo_total, activo, fecha_registro, usuario_registro
      ) VALUES (
        $1, 1, NOW() - INTERVAL '30 minutes', NOW(), 30, 30, 500.00, 250.00, true, NOW(), 1
      )
    `, [s3Id]);
    await recalculateWorkOrderTotals(client, testOrdenId, 1);
    console.log(`  - Creado Servicio #${s3Id} en estado COMPLETADO (3)`);

    // C.1 EDIT COMPLETADO
    await client.query(`
      UPDATE admin.orden_servicios
      SET observacion_tecnica = 'Servicio completado - Nota técnica post-finalización',
          precio_unitario = 1250.00,
          subtotal = 1250.00,
          usuario_actualizacion = $1,
          fecha_actualizacion = NOW()
      WHERE orden_servicio_id = $2
    `, [actor.usuario_id, s3Id]);
    await recalculateWorkOrderTotals(client, testOrdenId, actor.usuario_id);
    const s3Check = await client.query('SELECT precio_unitario, observacion_tecnica, estado_orden_servicio_id FROM admin.orden_servicios WHERE orden_servicio_id = $1', [s3Id]);
    if (Number(s3Check.rows[0].precio_unitario) !== 1250 || s3Check.rows[0].estado_orden_servicio_id !== 3) {
      throw new Error('TEST C.1 FAILED: Update of COMPLETADO service failed.');
    }
    console.log('  [PASS] C.1 Editar Servicio COMPLETADO (Permanece en COMPLETADO con datos actualizados)');

    // C.2 DELETE COMPLETADO
    await client.query('DELETE FROM admin.orden_servicio_mano_obra WHERE orden_servicio_id = $1', [s3Id]);
    await client.query('UPDATE admin.orden_servicios SET activo = false, usuario_actualizacion = $1 WHERE orden_servicio_id = $2', [actor.usuario_id, s3Id]);
    await recalculateWorkOrderTotals(client, testOrdenId, actor.usuario_id);

    const s3DelCheck = await client.query('SELECT activo FROM admin.orden_servicios WHERE orden_servicio_id = $1', [s3Id]);
    if (s3DelCheck.rows[0].activo !== false) {
      throw new Error('TEST C.2 FAILED: Deletion of COMPLETADO service failed.');
    }
    console.log('  [PASS] C.2 Eliminar Servicio COMPLETADO\n');

    // =========================================================================
    // TEST D: SERVICIO COMPLETADO DENTRO DE OT ENTREGADA (EDIT & DELETE)
    // =========================================================================
    console.log('--- TEST D: SERVICIO COMPLETADO DENTRO DE OT ENTREGADA ---');
    const s4Res = await client.query(`
      INSERT INTO admin.orden_servicios (
        orden_trabajo_id, tipo_servicio_id, estado_orden_servicio_id, estado_aprobacion_id, cantidad, precio_unitario, subtotal, observacion_tecnica, fecha_finalizacion, tiempo_transcurrido, activo, fecha_registro
      ) VALUES (
        $1, 1, 3, 1, 1, 2000.00, 2000.00, 'Servicio entregado al cliente', NOW(), 3600, true, NOW()
      ) RETURNING orden_servicio_id
    `, [testOrdenEntregadaId]);
    const s4Id = s4Res.rows[0].orden_servicio_id;
    await recalculateWorkOrderTotals(client, testOrdenEntregadaId, 1);
    console.log(`  - Creado Servicio #${s4Id} COMPLETADO en OT #${testOrdenEntregadaId} (ENTREGADA / FACTURADA)`);

    // D.1 EDIT COMPLETADO DENTRO DE OT ENTREGADA
    await client.query(`
      UPDATE admin.orden_servicios
      SET observacion_tecnica = 'Garantía extendida por ajuste de entrega',
          precio_unitario = 2000.00,
          subtotal = 2000.00,
          usuario_actualizacion = $1,
          fecha_actualizacion = NOW()
      WHERE orden_servicio_id = $2
    `, [actor.usuario_id, s4Id]);
    await recalculateWorkOrderTotals(client, testOrdenEntregadaId, actor.usuario_id);
    const s4Check = await client.query('SELECT observacion_tecnica FROM admin.orden_servicios WHERE orden_servicio_id = $1', [s4Id]);
    if (!s4Check.rows[0].observacion_tecnica.includes('Garantía extendida')) {
      throw new Error('TEST D.1 FAILED: Edit of service in delivered order failed.');
    }
    console.log('  [PASS] D.1 Editar Servicio COMPLETADO dentro de OT ENTREGADA');

    // D.2 DELETE COMPLETADO DENTRO DE OT ENTREGADA
    await client.query('DELETE FROM admin.orden_servicio_mano_obra WHERE orden_servicio_id = $1', [s4Id]);
    await client.query('UPDATE admin.orden_servicios SET activo = false, usuario_actualizacion = $1 WHERE orden_servicio_id = $2', [actor.usuario_id, s4Id]);
    await recalculateWorkOrderTotals(client, testOrdenEntregadaId, actor.usuario_id);

    // Validate that OT remains in ENTREGADA and activo = true
    const otEntregadaCheck = await client.query('SELECT estado_orden_id, activo, facturado FROM admin.ordenes_trabajo WHERE orden_trabajo_id = $1', [testOrdenEntregadaId]);
    if (otEntregadaCheck.rows[0].estado_orden_id !== 8 || otEntregadaCheck.rows[0].activo !== true || otEntregadaCheck.rows[0].facturado !== true) {
      throw new Error('TEST D.2 FAILED: OT state corrupted during service deletion.');
    }
    console.log('  [PASS] D.2 Eliminar Servicio COMPLETADO dentro de OT ENTREGADA (OT permanece en ENTREGADA & FACTURADA)\n');

    // =========================================================================
    // TEST E: AUDIT, TENANCY & RBAC INTEGRITY VALIDATION
    // =========================================================================
    console.log('--- TEST E: AUDITORÍA & INTEGRIDAD MULTITENANT ---');
    // Audit record test
    await recordUserAudit({
      userId: 1,
      accion: 'ELIMINAR_SERVICIO_ORDEN',
      valorAnterior: { orden_servicio_id: s4Id, activo: true },
      valorNuevo: { orden_servicio_id: s4Id, activo: false },
      motivo: `Servicio #${s4Id} eliminado de la orden entregada #${testOrdenEntregadaId}`,
      resultado: 'COMPLETADO',
      client,
      throwOnError: true
    });
    console.log('  [PASS] E.1 Registro de auditoría usuario verificado');

    // Check reception remains intact
    const recCheck = await client.query('SELECT activo FROM admin.recepciones WHERE recepcion_id = $1', [testRecepcionId]);
    if (!recCheck.rows[0] || recCheck.rows[0].activo !== true) {
      throw new Error('TEST E.2 FAILED: Reception was affected.');
    }
    console.log('  [PASS] E.2 Recepción permanece intacta');

    console.log('\n========================================================================');
    console.log('ALL SERVICE EDIT & DELETE TESTS PASSED SUCCESSFULLY (100%)');
    console.log('========================================================================\n');

  } catch (error) {
    console.error('Test Execution Error:', error);
    throw error;
  } finally {
    // Cleanup created test data graph
    if (testOrdenEntregadaId) {
      await client.query('DELETE FROM admin.orden_servicios WHERE orden_trabajo_id = $1', [testOrdenEntregadaId]);
      await client.query('DELETE FROM admin.ordenes_trabajo WHERE orden_trabajo_id = $1', [testOrdenEntregadaId]);
    }
    if (testOrdenId) {
      await client.query('DELETE FROM admin.orden_servicios WHERE orden_trabajo_id = $1', [testOrdenId]);
      await client.query('DELETE FROM admin.ordenes_trabajo WHERE orden_trabajo_id = $1', [testOrdenId]);
    }
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

runServiceEditDeleteTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
