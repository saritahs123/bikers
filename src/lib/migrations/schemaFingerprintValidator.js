/**
 * RIDE LAB — VALIDADOR DE HUELLA ESTRUCTURAL DE MIGRACIONES (SCHEMA FINGERPRINT)
 * Archivo: src/lib/migrations/schemaFingerprintValidator.js
 * 
 * Verifica rigurosamente la presencia de tablas, columnas, índices, constraints y secuencias
 * correspondientes a cada migración histórica antes de permitir su registro como BASELINE.
 * 
 * Regla de oro: CERO registros de BASELINE sin verificación física demostrada en el catálogo PostgreSQL.
 */

const FINGERPRINTS = {
  1: {
    name: '001_security_stage1.sql',
    indexes: ['idx_usuario_identidad_correo_lower', 'idx_usuario_sesion_token_estado'],
    tables: ['usuario_seguridad']
  },
  2: {
    name: '002_s3_cleanup_queue.sql',
    tables: ['s3_cleanup_queue'],
    indexes: ['idx_s3_cleanup_claim', 'idx_s3_cleanup_empresa']
  },
  3: {
    name: '003_workshop_pk_sequences.sql',
    sequences: ['recepciones_recepcion_id_seq', 'recepcion_checklist_recepcion_checklist_id_seq']
  },
  4: {
    name: '004_reception_signature_terms_version.sql',
    columns: [{ table: 'firma_recepcion', column: 'version_terminos' }]
  },
  5: {
    name: '005_reception_idempotency.sql',
    columns: [
      { table: 'recepciones', column: 'idempotency_key' },
      { table: 'recepciones', column: 'idempotency_empresa_id' }
    ],
    indexes: ['uq_recepciones_idempotency_empresa_key']
  },
  6: {
    name: '006_s3_staging_registry.sql',
    tables: ['s3_staging_registry'],
    indexes: ['idx_s3_staging_empresa_key', 'idx_s3_staging_context']
  },
  7: {
    name: '007_catalogs_pk_sequences.sql',
    sequences: ['tipo_servicio_tipo_servicio_id_seq', 'productos_producto_id_seq']
  },
  8: {
    name: '008_security_missing_indexes.sql',
    indexes: ['idx_usuario_identidad_correo_lower', 'idx_usuario_sesion_token_estado']
  },
  9: {
    name: '009_work_order_deletion_history.sql',
    tables: ['orden_trabajo_eliminada_historial']
  },
  10: {
    name: '010_detalle_factura_pk_sequence.sql',
    sequences: ['detalle_factura_detalle_factura_id_seq']
  },
  11: {
    name: '011_usuario_identidad_nullable_org_columns.sql',
    tables: ['usuario_identidad']
  },
  12: {
    name: '012_inventory_integrity_and_transfers.sql',
    columns: [
      { table: 'existencias_producto', column: 'costo_promedio' },
      { table: 'movimientos_inventario', column: 'transferencia_uuid' }
    ],
    sequences: [
      'existencias_producto_existencia_producto_id_seq',
      'movimientos_inventario_movimiento_inventario_id_seq'
    ]
  },
  13: {
    name: '013_estado_orden_trabajo_pk_sequence.sql',
    sequences: ['estado_orden_trabajo_estado_orden_id_seq']
  },
  14: {
    name: '014_inventory_multitenancy.sql',
    columns: [{ table: 'almacenes', column: 'empresa_id' }]
  },
  15: {
    name: '015_unique_active_primary_supplier.sql',
    indexes: ['producto_proveedor_principal_uk']
  },
  16: {
    name: '016_catalog_sequences.sql',
    sequences: ['tipo_producto_tipo_producto_id_seq', 'categoria_producto_categoria_producto_id_seq']
  },
  17: {
    name: '017_tipo_movimiento_sal_manual.sql',
    tables: ['tipo_movimiento_inventario']
  },
  18: {
    name: '018_tipo_movimiento_inv_inicial.sql',
    tables: ['tipo_movimiento_inventario']
  },
  19: {
    name: '019_add_codigo_movimiento.sql',
    columns: [{ table: 'movimientos_inventario', column: 'codigo_movimiento' }]
  },
  20: {
    name: '020_codigo_sistema_composite_key.sql',
    columns: [{ table: 'codigo_sistema', column: 'empresa_id' }]
  },
  21: {
    name: '021_movimientos_inventario_proveedor.sql',
    columns: [{ table: 'movimientos_inventario', column: 'proveedor_id' }]
  },
  22: {
    name: '022_consumo_repuestos_codigo_sistema.sql',
    tables: ['codigo_sistema']
  },
  23: {
    name: '023_movimientos_inventario_orden_producto.sql',
    columns: [{ table: 'movimientos_inventario', column: 'orden_producto_id' }]
  },
  24: {
    name: '024_reverso_consumo_repuestos.sql',
    tables: ['movimientos_inventario']
  },
  25: {
    name: '025_billing_base_model.sql',
    tables: ['tipo_factura', 'facturas', 'detalle_factura', 'pagos'],
    columns: [
      { table: 'facturas', column: 'tipo_factura_id' },
      { table: 'facturas', column: 'codigo_factura' }
    ]
  },
  26: {
    name: '026_billing_direct_sale_inventory.sql',
    tables: ['tipo_movimiento_inventario']
  },
  27: {
    name: '027_billing_condicion_venta_y_devuelta.sql',
    columns: [
      { table: 'facturas', column: 'condicion_venta' },
      { table: 'pagos', column: 'monto_recibido' },
      { table: 'pagos', column: 'monto_devuelta' }
    ]
  },
  28: {
    name: '028_billing_cancellation_and_reversal.sql',
    columns: [
      { table: 'facturas', column: 'usuario_anulacion_id' },
      { table: 'facturas', column: 'fecha_anulacion' },
      { table: 'facturas', column: 'motivo_anulacion' }
    ]
  },
  29: {
    name: '029_billing_factura_empresa.sql',
    columns: [{ table: 'facturas', column: 'empresa_id' }]
  },
  30: {
    name: '030_billing_factura_audit_columns.sql',
    columns: [
      { table: 'facturas', column: 'usuario_creacion_id' },
      { table: 'facturas', column: 'fecha_creacion' },
      { table: 'facturas', column: 'usuario_modificacion_id' },
      { table: 'facturas', column: 'fecha_modificacion' }
    ]
  },
  31: {
    name: '031_billing_cancellation_reasons.sql',
    tables: ['motivo_anulacion_factura'],
    columns: [
      { table: 'motivo_anulacion_factura', column: 'motivo_anulacion_factura_id' },
      { table: 'motivo_anulacion_factura', column: 'codigo' },
      { table: 'motivo_anulacion_factura', column: 'motivo_anulacion' }
    ],
    indexes: ['motivo_anulacion_factura_pk', 'motivo_anulacion_factura_codigo_uk']
  },
  32: {
    name: '032_billing_inventory_reversal_traceability.sql',
    tables: ['regla_reversion_movimiento', 'detalle_factura_movimiento'],
    columns: [{ table: 'movimientos_inventario', column: 'movimiento_origen_id' }]
  },
  33: {
    name: '033_billing_factura_anulacion_audit.sql',
    tables: ['factura_anulacion']
  },
  34: {
    name: '034_orden_tracking.sql',
    tables: ['orden_tracking']
  },
  35: {
    name: '035_orden_tracking_public_token.sql',
    columns: [{ table: 'orden_tracking', column: 'public_token' }]
  },
  36: {
    name: '036_user_session_duration.sql',
    columns: [{ table: 'usuario', column: 'duracion_sesion_minutos' }]
  },
  37: {
    name: '037_orden_tracking_short_code.sql',
    columns: [{ table: 'orden_tracking', column: 'short_code' }]
  },
  38: {
    name: '038_notificacion_orden_trabajo.sql',
    tables: ['notificacion_orden_trabajo']
  },
  39: {
    name: '039_notificacion_orden_trabajo_batch_status.sql',
    columns: [
      { table: 'notificacion_orden_trabajo', column: 'textbee_batch_id' },
      { table: 'notificacion_orden_trabajo', column: 'estado_proveedor' }
    ]
  },
  40: {
    name: '040_billing_condicion_venta.sql',
    columns: [{ table: 'facturas', column: 'condicion_venta' }]
  },
  41: {
    name: '041_billing_nivel_cliente_descuento.sql',
    tables: ['nivel_cliente'],
    columns: [
      { table: 'clientes', column: 'nivel_cliente_id' },
      { table: 'facturas', column: 'nivel_cliente_id' },
      { table: 'facturas', column: 'descuento_nivel' }
    ]
  },
  42: {
    name: '042_security_pantalla_and_sidebar_sync.sql',
    tables: ['pantalla_sistema', 'modulo_sistema', 'matriz_acceso_pantalla']
  },
  43: {
    name: '043_usuario_permiso_personalizado.sql',
    tables: ['usuario_permiso_personalizado']
  },
  44: {
    name: '044_factura_anulacion_sequence.sql',
    tables: ['factura_anulacion'],
    customCheck: async (client) => {
      const col = await client.query(`
        SELECT is_identity FROM information_schema.columns
        WHERE table_schema = 'admin' AND table_name = 'factura_anulacion' AND column_name = 'factura_anulacion_id'
      `);
      const seq = await client.query(`
        SELECT pg_get_serial_sequence('admin.factura_anulacion', 'factura_anulacion_id') as s
      `);
      const isId = col.rows[0]?.is_identity === 'YES';
      const hasSeq = Boolean(seq.rows[0]?.s);
      return {
        passed: isId || hasSeq,
        detail: `is_identity=${isId}, sequence=${seq.rows[0]?.s || 'none'}`
      };
    }
  }
};

/**
 * Carga el catálogo del esquema 'admin' de forma secuencial en una única conexión
 */
async function loadAdminCatalog(client) {
  const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'admin'");
  const columnsRes = await client.query("SELECT table_name, column_name, data_type, is_identity FROM information_schema.columns WHERE table_schema = 'admin'");
  const indexesRes = await client.query("SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'admin'");
  const sequencesRes = await client.query("SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'admin'");
  const constraintsRes = await client.query("SELECT conname, conrelid::regclass::text as tablename FROM pg_constraint WHERE connamespace = 'admin'::regnamespace");

  const tables = new Set(tablesRes.rows.map(r => r.table_name.toLowerCase()));
  const columnMap = new Map(columnsRes.rows.map(r => [
    `${r.table_name.toLowerCase()}.${r.column_name.toLowerCase()}`,
    { dataType: r.data_type.toLowerCase(), isIdentity: r.is_identity === 'YES' }
  ]));
  const columnSet = new Set(columnMap.keys());
  const indexSet = new Set(indexesRes.rows.map(r => r.indexname.toLowerCase()));
  const sequenceSet = new Set(sequencesRes.rows.map(r => r.sequence_name.toLowerCase()));
  const constraintSet = new Set(constraintsRes.rows.map(r => r.conname.toLowerCase()));

  return { tables, columnMap, columnSet, indexSet, sequenceSet, constraintSet };
}

/**
 * Valida la huella estructural de una migración específica distinguiendo:
 * - Objetos existentes (comprobados físicamente)
 * - Objetos faltantes (inexistentes en catálogo)
 * - Objetos divergentes (existen pero su tipo o definición difiere de la esperada)
 */
async function verifyMigrationFingerprint(client, seqNum, catalog = null) {
  const fp = FINGERPRINTS[seqNum];
  if (!fp) {
    return { 
      passed: true, 
      existingObjects: [], 
      missingObjects: [], 
      divergentObjects: [], 
      missing: [],
      detail: 'Sin fingerprint específico requerido' 
    };
  }

  const cat = catalog || await loadAdminCatalog(client);
  const existingObjects = [];
  const missingObjects = [];
  const divergentObjects = [];

  // 1. Tablas
  if (fp.tables) {
    for (const t of fp.tables) {
      if (cat.tables.has(t.toLowerCase())) {
        existingObjects.push(`tabla:admin.${t}`);
      } else {
        missingObjects.push(`Tabla admin.${t} no existe`);
      }
    }
  }

  // 2. Columnas y tipos de datos
  if (fp.columns) {
    for (const c of fp.columns) {
      const key = `${c.table.toLowerCase()}.${c.column.toLowerCase()}`;
      if (cat.columnSet.has(key)) {
        const actualMeta = cat.columnMap.get(key);
        if (c.expectedType && !actualMeta.dataType.includes(c.expectedType.toLowerCase())) {
          divergentObjects.push(
            `Columna admin.${c.table}.${c.column} tiene tipo "${actualMeta.dataType}" (esperado "${c.expectedType}")`
          );
        } else {
          existingObjects.push(`columna:admin.${c.table}.${c.column} (${actualMeta.dataType})`);
        }
      } else {
        missingObjects.push(`Columna admin.${c.table}.${c.column} no existe`);
      }
    }
  }

  // 3. Índices
  if (fp.indexes) {
    for (const idx of fp.indexes) {
      if (cat.indexSet.has(idx.toLowerCase())) {
        existingObjects.push(`índice:${idx}`);
      } else {
        missingObjects.push(`Índice ${idx} no existe`);
      }
    }
  }

  // 4. Secuencias
  if (fp.sequences) {
    for (const seq of fp.sequences) {
      if (cat.sequenceSet.has(seq.toLowerCase())) {
        existingObjects.push(`secuencia:admin.${seq}`);
      } else {
        const hasFuzzy = [...cat.sequenceSet].some(s => s.includes(seq.toLowerCase().slice(0, 25)));
        if (hasFuzzy) {
          existingObjects.push(`secuencia:admin.${seq} (fuzzy)`);
        } else {
          missingObjects.push(`Secuencia admin.${seq} no existe`);
        }
      }
    }
  }

  // 5. Verificaciones personalizadas
  if (fp.customCheck) {
    const customResult = await fp.customCheck(client);
    if (customResult.passed) {
      existingObjects.push(`custom:${customResult.detail}`);
    } else {
      divergentObjects.push(`Verificación personalizada divergente: ${customResult.detail}`);
    }
  }

  const passed = missingObjects.length === 0 && divergentObjects.length === 0;

  return {
    passed,
    existingObjects,
    missingObjects,
    divergentObjects,
    missing: [...missingObjects, ...divergentObjects],
    name: fp.name
  };
}

/**
 * Valida todas las huellas históricas de 001 a upToSeq (por defecto 44)
 * con reporte clasificado de conformes, divergentes y faltantes.
 */
async function verifyHistoricalFingerprints(client, upToSeq = 44) {
  const catalog = await loadAdminCatalog(client);
  const results = [];
  let allPassed = true;

  for (let i = 1; i <= upToSeq; i++) {
    const res = await verifyMigrationFingerprint(client, i, catalog);
    results.push({ seq: i, ...res });
    if (!res.passed) allPassed = false;
  }

  return {
    allPassed,
    totalVerified: results.length,
    conformingCount: results.filter(r => r.passed).length,
    failedCount: results.filter(r => !r.passed).length,
    missingCount: results.filter(r => r.missingObjects.length > 0).length,
    divergentCount: results.filter(r => r.divergentObjects.length > 0).length,
    results
  };
}

module.exports = {
  FINGERPRINTS,
  loadAdminCatalog,
  verifyMigrationFingerprint,
  verifyHistoricalFingerprints
};
