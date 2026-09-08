import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getPool } from '../src/lib/db';
import { syncWorkOrderInvoice } from '../src/lib/workshop/syncWorkOrderInvoice';

async function testConcurrency() {
  console.log('========================================================================');
  console.log('PRUEBA DE CONCURRENCIA Y SECUENCIA: admin.detalle_factura');
  console.log('========================================================================\n');

  const pool = getPool();

  // -------------------------------------------------------------------------
  // 1. PRUEBA SECUENCIAL: INSERT SIN DETALLE_FACTURA_ID
  // -------------------------------------------------------------------------
  console.log('--- 1. PRUEBA SECUENCIAL: INSERT SIN DETALLE_FACTURA_ID ---');
  const clientSeq = await pool.connect();
  let seqDetalleId: number | null = null;
  let testFacIdSeq: number | null = null;
  let testCliIdSeq: number | null = null;

  try {
    const maxBefore = await clientSeq.query('SELECT COALESCE(MAX(detalle_factura_id), 0) AS max_id FROM admin.detalle_factura');
    const maxValBefore = Number(maxBefore.rows[0].max_id);
    console.log(`MAX(detalle_factura_id) previo: ${maxValBefore}`);

    const maxCli = await clientSeq.query('SELECT COALESCE(MAX(cliente_id), 0) + 1 AS next_id FROM admin.clientes');
    testCliIdSeq = Number(maxCli.rows[0].next_id);
    await clientSeq.query(`
      INSERT INTO admin.clientes (cliente_id, nombre, apellido, nombre_completo, identificacion, telefono_principal, correo, activo, fecha_creacion, empresa_id)
      VALUES ($1, 'ClientSeq', 'Test', 'Client Seq Test', $2, '809-555-0000', $3, true, NOW(), 1)
    `, [testCliIdSeq, `001-SEQ-${Date.now()}`, `seq_${Date.now()}@example.com`]);

    const maxFac = await clientSeq.query('SELECT COALESCE(MAX(factura_id), 0) + 1 AS next_id FROM admin.facturas');
    testFacIdSeq = Number(maxFac.rows[0].next_id);
    await clientSeq.query(`
      INSERT INTO admin.facturas (factura_id, tipo_factura_id, cliente_id, orden_trabajo_id, numero_factura, subtotal, descuento_total, impuesto_total, total_factura, monto_pagado, balance_pendiente, estado, fecha_factura, fecha_registro)
      VALUES ($1, 1, $2, NULL, $3, 100, 0, 0, 100, 100, 0, 'PAGADA', NOW(), NOW())
    `, [testFacIdSeq, testCliIdSeq, `FAC-SEQ-${testFacIdSeq}`]);

    // Insert line WITHOUT detalle_factura_id
    const insertRes = await clientSeq.query(`
      INSERT INTO admin.detalle_factura (
        factura_id,
        tipo_detalle,
        descripcion,
        cantidad,
        precio_unitario,
        descuento,
        subtotal,
        fecha_registro
      ) VALUES (
        $1, 'SERVICIO', 'Prueba Secuencia Sin ID', 1.00, 100.00, 0.00, 100.00, NOW()
      )
      RETURNING detalle_factura_id
    `, [testFacIdSeq]);

    seqDetalleId = Number(insertRes.rows[0].detalle_factura_id);
    console.log(`✓ Insert exitoso sin pasar ID. ID generado por SEQUENCE + DEFAULT: ${seqDetalleId}`);

    if (seqDetalleId <= maxValBefore) {
      throw new Error(`Fallo: ID generado (${seqDetalleId}) no es mayor al MAX anterior (${maxValBefore})`);
    }
    console.log(`✓ PASS: ID generado (${seqDetalleId}) > MAX previo (${maxValBefore}). 0 colisiones.\n`);
  } finally {
    if (seqDetalleId) {
      await clientSeq.query('DELETE FROM admin.detalle_factura WHERE detalle_factura_id = $1', [seqDetalleId]);
    }
    if (testFacIdSeq) {
      await clientSeq.query('DELETE FROM admin.facturas WHERE factura_id = $1', [testFacIdSeq]);
    }
    if (testCliIdSeq) {
      await clientSeq.query('DELETE FROM admin.clientes WHERE cliente_id = $1', [testCliIdSeq]);
    }
    clientSeq.release();
  }

  // -------------------------------------------------------------------------
  // 2. PRUEBA DE CONCURRENCIA: 10 TRANSACCIONES PARALELAS INDEPENDIENTES
  // -------------------------------------------------------------------------
  console.log('--- 2. PRUEBA DE CONCURRENCIA: 10 TRANSACCIONES PARALELAS ---');
  const clientSetup = await pool.connect();
  const N = 10;
  const createdClients: number[] = [];
  const createdOTs: number[] = [];
  const createdFacturas: number[] = [];

  try {
    for (let i = 0; i < N; i++) {
      const maxCli = await clientSetup.query('SELECT COALESCE(MAX(cliente_id), 0) + 1 AS next_id FROM admin.clientes');
      const cId = Number(maxCli.rows[0].next_id);
      createdClients.push(cId);
      await clientSetup.query(`
        INSERT INTO admin.clientes (cliente_id, nombre, apellido, nombre_completo, identificacion, telefono_principal, correo, activo, fecha_creacion, empresa_id)
        VALUES ($1, 'ClientConc', $2, 'Client Conc', $3, '809-555-0000', $4, true, NOW(), 1)
      `, [cId, `Conc${i}`, `001-CONC-${Date.now()}-${i}`, `conc${Date.now()}_${i}@example.com`]);

      const maxBic = await clientSetup.query('SELECT COALESCE(MAX(bicicleta_id), 0) + 1 AS next_id FROM admin.bicicletas');
      const bId = Number(maxBic.rows[0].next_id);
      await clientSetup.query(`
        INSERT INTO admin.bicicletas (bicicleta_id, cliente_id, codigo_qr, url_qr, marca, modelo, ano, color, numero_serie_cuadro, activo, fecha_creacion)
        VALUES ($1, $2, $3, $4, 'Trek', 'Conc', 2024, 'Rojo', $5, true, NOW())
      `, [bId, cId, `QR-CONC-${bId}`, `https://example.com/qr/${bId}`, `SN-CONC-${bId}`]);

      const recRes = await clientSetup.query(`
        INSERT INTO admin.recepciones (codigo_recepcion, cliente_id, bicicleta_id, estado_recepcion_id, diagnostico_preliminar, observaciones_cliente, observaciones_recepcion, presupuesto_estimado, requiere_aprobacion, activo, fecha_creacion, recibido_por_usuario_id, fecha_recepcion)
        VALUES ($1, $2, $3, 1, 'Diag', 'Obs', 'Sin obs', 2300, false, true, NOW(), 1, NOW())
        RETURNING recepcion_id
      `, [`REC-CONC-${Date.now()}-${i}`, cId, bId]);
      const rId = recRes.rows[0].recepcion_id;

      const maxOrd = await clientSetup.query('SELECT COALESCE(MAX(orden_trabajo_id), 0) + 1 AS next_id FROM admin.ordenes_trabajo');
      const otId = Number(maxOrd.rows[0].next_id);
      createdOTs.push(otId);
      await clientSetup.query(`
        INSERT INTO admin.ordenes_trabajo (orden_trabajo_id, codigo_orden, recepcion_id, cliente_id, bicicleta_id, estado_orden_id, prioridad_orden_id, mecanico_id, subtotal_servicios, subtotal_productos, subtotal_general, impuesto, total_orden, facturado, fecha_facturacion, usuario_facturacion_id, fecha_recepcion, activo, fecha_registro)
        VALUES ($1, $2, $3, $4, $5, 8, 1, 1, 1500, 800, 2300, 0, 2300, true, NOW(), 1, NOW(), true, NOW())
      `, [otId, `OT-CONC-${otId}`, rId, cId, bId]);

      await clientSetup.query(`
        INSERT INTO admin.orden_servicios (orden_trabajo_id, tipo_servicio_id, estado_orden_servicio_id, estado_aprobacion_id, cantidad, precio_unitario, subtotal, activo, fecha_registro)
        VALUES ($1, 1, 3, 1, 1, 1500, 1500, true, NOW())
      `, [otId]);

      await clientSetup.query(`
        INSERT INTO admin.orden_productos (orden_trabajo_id, producto_id, almacen_id, estado_aprobacion_id, cantidad, precio_unitario, subtotal, fecha_registro)
        VALUES ($1, 1, 1, 1, 1, 800, 800, NOW())
      `, [otId]);

      const maxFac = await clientSetup.query('SELECT COALESCE(MAX(factura_id), 0) + 1 AS next_id FROM admin.facturas');
      const facId = Number(maxFac.rows[0].next_id);
      createdFacturas.push(facId);
      await clientSetup.query(`
        INSERT INTO admin.facturas (factura_id, tipo_factura_id, cliente_id, orden_trabajo_id, numero_factura, subtotal, descuento_total, impuesto_total, total_factura, monto_pagado, balance_pendiente, estado, fecha_factura, fecha_registro)
        VALUES ($1, 1, $2, $3, $4, 2300, 0, 0, 2300, 2300, 0, 'PAGADA', NOW(), NOW())
      `, [facId, cId, otId, `FAC-CONC-${facId}`]);
    }
    clientSetup.release();

    console.log(`Creadas ${N} órdenes y facturas para prueba de sincronización concurrente.`);

    // Run N parallel synchronizations simultaneously using independent clients/transactions
    console.log(`Lanzando ${N} sincronizaciones paralelas en transacciones concurrentes (sin advisory locks)...`);
    const results = await Promise.all(
      createdOTs.map(async (otId, idx) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const res = await syncWorkOrderInvoice(client, otId, 1);
          await client.query('COMMIT');
          return { success: true, otId, res };
        } catch (err: any) {
          await client.query('ROLLBACK').catch(() => {});
          return { success: false, otId, error: err.message, code: err.code };
        } finally {
          client.release();
        }
      })
    );

    console.log('\nResultados de sincronizaciones paralelas:');
    let successfulCount = 0;
    results.forEach((r, idx) => {
      console.log(`  - Transacción #${idx + 1} (OT #${r.otId}): ${r.success ? '✓ Éxito' : `✗ Error [code: ${r.code}]: ${r.error}`}`);
      if (r.success) successfulCount++;
    });

    console.log(`\nResumen: ${successfulCount}/${N} inserciones/sincronizaciones concurrentes exitosas.`);

    if (successfulCount !== N) {
      throw new Error(`Fallo en concurrencia: solo ${successfulCount}/${N} fueron exitosas.`);
    }

    // Check for duplicate IDs in admin.detalle_factura
    const clientVerify = await pool.connect();
    try {
      const dupCheck = await clientVerify.query(`
        SELECT detalle_factura_id, COUNT(*)
        FROM admin.detalle_factura
        WHERE factura_id = ANY($1::integer[])
        GROUP BY detalle_factura_id
        HAVING COUNT(*) > 1
      `, [createdFacturas]);

      console.log(`Verificación de IDs duplicados en admin.detalle_factura: ${dupCheck.rows.length} duplicados.`);
      if (dupCheck.rows.length > 0) {
        throw new Error(`Se detectaron IDs duplicados: ${JSON.stringify(dupCheck.rows)}`);
      }

      const allDetails = await clientVerify.query(`
        SELECT detalle_factura_id, factura_id, tipo_detalle, subtotal
        FROM admin.detalle_factura
        WHERE factura_id = ANY($1::integer[])
        ORDER BY detalle_factura_id ASC
      `, [createdFacturas]);

      console.log(`Total de líneas insertadas en admin.detalle_factura: ${allDetails.rows.length} (Esperadas: ${N * 2})`);
      const uniqueIds = new Set(allDetails.rows.map(r => r.detalle_factura_id));
      console.log(`Total de IDs únicos: ${uniqueIds.size} / ${allDetails.rows.length}`);

      if (uniqueIds.size !== allDetails.rows.length || allDetails.rows.length !== N * 2) {
        throw new Error(`Inconsistencia en conteo de IDs únicos: ${uniqueIds.size} vs esperado ${N * 2}`);
      }

      console.log('\n========================================================================');
      console.log('✓ RESULTADO: 10/10 inserts concurrentes PASS');
      console.log('✓ 20/20 IDs únicos generados por PostgreSQL Sequence');
      console.log('✓ 0 duplicate key violations (23505)');
      console.log('✓ 0 colisiones');
      console.log('========================================================================\n');
    } finally {
      clientVerify.release();
    }

  } finally {
    const clientClean = await pool.connect();
    try {
      if (createdFacturas.length > 0) {
        await clientClean.query('DELETE FROM admin.detalle_factura WHERE factura_id = ANY($1::integer[])', [createdFacturas]);
        await clientClean.query('DELETE FROM admin.facturas WHERE factura_id = ANY($1::integer[])', [createdFacturas]);
      }
      if (createdOTs.length > 0) {
        await clientClean.query('DELETE FROM admin.orden_productos WHERE orden_trabajo_id = ANY($1::integer[])', [createdOTs]);
        await clientClean.query('DELETE FROM admin.orden_servicios WHERE orden_trabajo_id = ANY($1::integer[])', [createdOTs]);
        await clientClean.query('DELETE FROM admin.ordenes_trabajo WHERE orden_trabajo_id = ANY($1::integer[])', [createdOTs]);
      }
      if (createdClients.length > 0) {
        await clientClean.query('DELETE FROM admin.recepciones WHERE cliente_id = ANY($1::integer[])', [createdClients]);
        await clientClean.query('DELETE FROM admin.bicicletas WHERE cliente_id = ANY($1::integer[])', [createdClients]);
        await clientClean.query('DELETE FROM admin.clientes WHERE cliente_id = ANY($1::integer[])', [createdClients]);
      }
    } finally {
      clientClean.release();
    }
  }
}

testConcurrency()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test Concurrency Failed:', err);
    process.exit(1);
  });
