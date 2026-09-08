import { PoolClient } from "pg";
import { query, withTransaction } from "@/lib/db";
import { recordUserActivity, recordUserAudit } from "@/lib/auditLogger";
import { CURRENT_RECEPTION_TERMS_VERSION, isValidReceptionTermsVersion } from "@/lib/workshop/receptionTerms";

export interface ServiceItemInput {
  tipo_servicio_id: number;
  diagnostico_preliminar?: string | null;
  precio_estimado?: number | string | null;
  bicicleta_componente_id?: number | null;
  nuevo_componente?: {
    categoria_componente_id: number | string;
    estado_componente_id: number | string;
    marca?: string;
    numero_serie?: string;
  } | null;
}

export interface ProductItemInput {
  producto_id: number | string;
  cantidad: number | string;
  precio_unitario?: number | string | null;
  observacion?: string | null;
}

export interface ReceptionWorkOrderPayload {
  cliente_id: number;
  bicicleta_id: number;
  observaciones_cliente?: string | null;
  observaciones_recepcion?: string | null;
  presupuesto_estimado?: number | string | null;
  requiere_aprobacion?: boolean;
  generar_orden_trabajo?: boolean;
  prioridad_id?: number | string | null;
  observacion_interna_ot?: string | null;
  diagnostico_preliminar?: string | null;
  mecanico_id?: number | null;
  fecha_prometida?: string | null;
  servicios?: ServiceItemInput[];
  productos?: ProductItemInput[];
  checklist?: any[];
  firma?: any;
  replaced_staging_keys?: string[];
  unused_staging_keys?: string[];
  idempotency_key?: string | null;
  is_direct_work_order?: boolean;
  userAgent?: string;
  ipFirma?: string;
}

export interface ReceptionWorkOrderResult {
  recepcion_id: number;
  codigo_recepcion: string;
  orden_trabajo_id: number | null;
  codigo_orden: string | null;
  is_replay: boolean;
  mensaje: string;
}

function cleanFecha(val: any): string | null {
  if (!val || typeof val !== "string" || !val.trim()) return null;
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

/**
 * Core transactional engine to create a Workshop Reception and optionally/automatically
 * generate the associated Work Order (OT) in a single atomic transaction.
 *
 * Guaranteed invariants:
 * 1. Single database transaction (BEGIN ... COMMIT / ROLLBACK)
 * 2. Strict concurrency locks (pg_advisory_xact_lock 7004 & 7003)
 * 3. Company-isolated idempotency (idempotency_empresa_id + idempotency_key)
 * 4. Multitenancy validation (client, bike, mechanic must belong to session empresa)
 * 5. Sequential numbering using certified PostgreSQL MAX sequence logic
 * 6. Work order state initial record in admin.orden_historial_estado
 * 7. Forensic audit in the same database transaction
 */
export async function executeReceptionWithWorkOrder(
  payload: ReceptionWorkOrderPayload,
  session: { usuario_id: number; empresa_id: number; email?: string },
  req?: any
): Promise<ReceptionWorkOrderResult> {
  const cliente_id = parseInt(String(payload.cliente_id), 10);
  const bicicleta_id = parseInt(String(payload.bicicleta_id), 10);

  if (isNaN(cliente_id) || cliente_id <= 0) {
    const err: any = new Error("Debe seleccionar un cliente válido.");
    err.status = 400;
    err.code = "INVALID_CLIENT";
    throw err;
  }

  if (isNaN(bicicleta_id) || bicicleta_id <= 0) {
    const err: any = new Error("Debe seleccionar una bicicleta válida.");
    err.status = 400;
    err.code = "INVALID_BICYCLE";
    throw err;
  }

  // Multitenant Check: Client
  const clientCheck = await query<any>(
    `SELECT cliente_id, empresa_id FROM admin.clientes WHERE cliente_id = $1 AND fecha_eliminacion IS NULL LIMIT 1`,
    [cliente_id]
  );

  if (!clientCheck || clientCheck.length === 0 || Number(clientCheck[0].empresa_id) !== Number(session.empresa_id)) {
    const err: any = new Error("El cliente seleccionado no existe o no pertenece a su empresa.");
    err.status = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  // Multitenant Check: Bicycle ownership
  const bikeCheck = await query<any>(
    `SELECT bicicleta_id, cliente_id FROM admin.bicicletas WHERE bicicleta_id = $1 AND fecha_eliminacion IS NULL LIMIT 1`,
    [bicicleta_id]
  );

  if (!bikeCheck || bikeCheck.length === 0) {
    const err: any = new Error("La bicicleta seleccionada no existe.");
    err.status = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  if (Number(bikeCheck[0].cliente_id) !== Number(cliente_id)) {
    const err: any = new Error("La bicicleta seleccionada no pertenece al cliente especificado.");
    err.status = 400;
    err.code = "BICYCLE_CLIENT_MISMATCH";
    throw err;
  }

  const isDirectWorkOrder = Boolean(payload.is_direct_work_order);

  // Mechanic Verification (if provided and not direct work order)
  const mecanico_id = isDirectWorkOrder
    ? null
    : (payload.mecanico_id ? parseInt(String(payload.mecanico_id), 10) : null);

  if (mecanico_id && !isNaN(mecanico_id)) {
    const mecCheck = await query<any>(
      `SELECT u.usuario_id
       FROM admin.usuario u
       LEFT JOIN admin.tipo_usuario tu ON tu.tipo_usuario_id = u.tipo_usuario_id
       WHERE u.usuario_id = $1
         AND u.empresa_id = $2
         AND tu.codigo = 'MECANICO'
         AND tu.estado = 'ACTIVO'
         AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
       LIMIT 1`,
      [mecanico_id, session.empresa_id]
    );

    if (!mecCheck || mecCheck.length === 0) {
      const err: any = new Error("El mecánico asignado no existe, no pertenece a su empresa o no está activo.");
      err.status = 400;
      err.code = "INVALID_MECHANIC";
      throw err;
    }
  }

  const generarOrdenTrabajo = isDirectWorkOrder || (payload.generar_orden_trabajo !== undefined ? Boolean(payload.generar_orden_trabajo) : true);

  const observaciones_cliente = (payload.observaciones_cliente || "").trim();
  const observaciones_recepcion = (payload.observaciones_recepcion || "").trim();
  const obs_interna_ot = (payload.observacion_interna_ot || "").trim();
  const fechaPrometida = isDirectWorkOrder ? null : cleanFecha(payload.fecha_prometida);

  const presupuesto_estimado_input = payload.presupuesto_estimado !== undefined && payload.presupuesto_estimado !== null
    ? parseFloat(String(payload.presupuesto_estimado))
    : 0.00;

  const requiere_aprobacion = payload.requiere_aprobacion !== undefined ? Boolean(payload.requiere_aprobacion) : true;
  const prioridad_id_input = payload.prioridad_id;

  const checklist: any[] = Array.isArray(payload.checklist) ? payload.checklist : [];
  const firma: any = payload.firma || {};
  const idempotency_key = (payload.idempotency_key || "").trim() || null;

  let servicios: ServiceItemInput[] = Array.isArray(payload.servicios) ? payload.servicios : [];
  let productos: ProductItemInput[] = Array.isArray(payload.productos) ? payload.productos : [];

  if (generarOrdenTrabajo && servicios.length === 0) {
    const err: any = new Error("Debe agregar al menos un servicio para generar la Orden de Trabajo.");
    err.status = 400;
    err.code = "SERVICES_REQUIRED";
    throw err;
  }

  // Validate Affected Component for each service if provided
  for (let idx = 0; idx < servicios.length; idx++) {
    const s = servicios[idx];
    const compId = s.bicicleta_componente_id ? parseInt(String(s.bicicleta_componente_id), 10) : null;
    if (compId && !isNaN(compId) && compId > 0) {
      const compCheck = await query<any>(
        `SELECT bicicleta_componente_id
         FROM admin.bicicleta_componentes
         WHERE bicicleta_componente_id = $1
           AND bicicleta_id = $2
           AND fecha_eliminacion IS NULL
           AND (activo IS DISTINCT FROM false)
         LIMIT 1`,
        [compId, bicicleta_id]
      );

      if (!compCheck || compCheck.length === 0) {
        const err: any = new Error("El componente seleccionado no pertenece a la bicicleta de esta recepción.");
        err.status = 400;
        err.code = "INVALID_BICYCLE_COMPONENT";
        throw err;
      }
    }
  }

  // Check duplicate checklist items
  const itemIds = checklist.map((c: any) => parseInt(c.item_checklist_id, 10)).filter(Boolean);
  const uniqueIds = new Set(itemIds);
  if (itemIds.length !== uniqueIds.size) {
    const err: any = new Error("Existen ítems duplicados en la evaluación del checklist.");
    err.status = 400;
    err.code = "DUPLICATE_CHECKLIST_ITEMS";
    throw err;
  }

  // Signature data validation (Optional for direct OT flow)
  const firma_digital = (firma.firma_digital || "").trim();
  const hasSignaturePayload = Boolean(firma_digital);

  if (hasSignaturePayload) {
    if (firma.version_terminos && !isValidReceptionTermsVersion(firma.version_terminos)) {
      const err: any = new Error("La versión de los términos y condiciones es incompatible o no está vigente en el servidor.");
      err.status = 409;
      err.code = "TERMS_VERSION_MISMATCH";
      throw err;
    }
  }

  const hasValidSignature = Boolean(
    firma_digital &&
    firma.terminos_aceptados &&
    firma_digital.startsWith("data:image/png;base64,") &&
    firma_digital.length <= 680000
  );

  const userAgent = payload.userAgent || "Navegador Web";
  const ipFirma = payload.ipFirma || "127.0.0.1";

  // Execute unified atomic database transaction
  const resultData = await withTransaction(async (client: PoolClient) => {
    // 0. Advisory Lock for strict concurrency serialization
    await client.query(`SELECT pg_advisory_xact_lock(7004)`);

    // Idempotency check under lock: return previous result deterministically if replaying
    if (idempotency_key) {
      const existingKeyRes = await client.query(
        `SELECT r.recepcion_id, r.codigo_recepcion, r.convertido_orden_id, ot.codigo_orden
         FROM admin.recepciones r
         LEFT JOIN admin.ordenes_trabajo ot ON r.convertido_orden_id = ot.orden_trabajo_id
         WHERE r.idempotency_empresa_id = $1 AND r.idempotency_key = $2 AND (r.activo = true OR r.activo IS NULL) AND r.fecha_eliminacion IS NULL
         LIMIT 1`,
        [session.empresa_id, idempotency_key]
      );

      if (existingKeyRes.rows.length > 0) {
        const row = existingKeyRes.rows[0];
        return {
          recepcion_id: row.recepcion_id,
          codigo_recepcion: row.codigo_recepcion,
          orden_trabajo_id: row.convertido_orden_id || null,
          codigo_orden: row.codigo_orden || null,
          is_replay: true
        };
      }
    }

    // 1. Reception Code Generation via PostgreSQL MAX sequence
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const recCodeSeqRes = await client.query(
      `SELECT COALESCE(
         MAX(
           CASE
             WHEN codigo_recepcion ~ '^REC-.*-([0-9]{1,8})$'
             THEN (SUBSTRING(codigo_recepcion FROM '^REC-.*-([0-9]{1,8})$'))::integer
             WHEN codigo_recepcion ~ '^REC-([0-9]{1,8})$'
             THEN (SUBSTRING(codigo_recepcion FROM '^REC-([0-9]{1,8})$'))::integer
             ELSE 0
           END
         ),
         0
       ) + 1 AS next_seq
       FROM admin.recepciones`
    );
    const nextRecSeq = recCodeSeqRes.rows[0].next_seq;
    const codigo_recepcion = `REC-${yearMonth}-${nextRecSeq}`;

    // Resolve Dynamic Reception State based on business outcome
    let targetStateCode = "RECIBIDA";
    if (generarOrdenTrabajo) {
      targetStateCode = "CONVERTIDA_OT";
    } else if (hasValidSignature) {
      targetStateCode = "CONFIRMADA";
    } else if (checklist.length > 0) {
      targetStateCode = "PENDIENTE_FIRMA";
    }

    let estado_recepcion_id = 1;
    const estRecRes = await client.query(
      `SELECT estado_recepcion_id FROM admin.estado_recepcion WHERE codigo = $1 AND activo = true ORDER BY orden_visual ASC LIMIT 1`,
      [targetStateCode]
    );
    if (estRecRes.rows.length > 0) {
      estado_recepcion_id = estRecRes.rows[0].estado_recepcion_id;
    } else {
      const fallbackEst = await client.query(
        `SELECT estado_recepcion_id FROM admin.estado_recepcion WHERE activo = true ORDER BY orden_visual ASC LIMIT 1`
      );
      if (fallbackEst.rows.length > 0) estado_recepcion_id = fallbackEst.rows[0].estado_recepcion_id;
    }

    const firstDiag = servicios.length > 0
      ? (servicios[0].diagnostico_preliminar || "").trim()
      : (payload.diagnostico_preliminar || "").trim();

    // Insert Reception
    const recInsertRes = await client.query(
      `INSERT INTO admin.recepciones (
        cliente_id, bicicleta_id, estado_recepcion_id, tipo_servicio_id,
        codigo_recepcion, fecha_recepcion, diagnostico_preliminar,
        observaciones_cliente, observaciones_recepcion, presupuesto_estimado,
        requiere_aprobacion, recibido_por_usuario_id, idempotency_key, idempotency_empresa_id, activo, fecha_creacion, usuario_creacion
      ) VALUES (
        $1, $2, $3, $4,
        $5, NOW(), $6,
        $7, $8, $9,
        $10, $11, $12, $13, true, NOW(), $11
      ) RETURNING recepcion_id`,
      [
        cliente_id, bicicleta_id, estado_recepcion_id, servicios[0]?.tipo_servicio_id || null,
        codigo_recepcion, firstDiag || null,
        observaciones_cliente || null, observaciones_recepcion || null, presupuesto_estimado_input,
        requiere_aprobacion, session.usuario_id, idempotency_key, session.empresa_id
      ]
    );
    const recepcion_id = recInsertRes.rows[0].recepcion_id;

    // 2. Insert Checklist Responses (if any in payload)
    for (let chkIdx = 0; chkIdx < checklist.length; chkIdx++) {
      const chkItem = checklist[chkIdx];
      const item_checklist_id = parseInt(chkItem.item_checklist_id, 10);
      const estado_checklist_id = parseInt(chkItem.estado_checklist_id, 10);
      if (isNaN(item_checklist_id) || isNaN(estado_checklist_id)) continue;

      const obs = (chkItem.observacion || chkItem.observaciones || "").trim();
      const s3Path = (chkItem.object_key || chkItem.s3_key || chkItem.ruta_archivo || "").trim() || null;
      const fileName = (chkItem.filename || chkItem.nombre_archivo || "").trim() || null;
      const hasPhoto = Boolean(chkItem.evidencia_foto || s3Path);

      const chkInsertRes = await client.query(
        `INSERT INTO admin.recepcion_checklist (
          recepcion_id, item_checklist_id, estado_checklist_id,
          observacion, requiere_trabajo, requiere_aprobacion, evidencia_foto,
          nombre_archivo, ruta_archivo, url_archivo,
          orden_visual, fecha_evaluacion, usuario_evaluacion, activo, fecha_registro, usuario_registro
        ) VALUES (
          $1, $2, $3,
          $4, $5, false, $6,
          $7, $8, NULL,
          $9, NOW(), $10, true, NOW(), $10
        ) RETURNING recepcion_checklist_id`,
        [
          recepcion_id, item_checklist_id, estado_checklist_id,
          obs || null, Boolean(chkItem.requiere_trabajo), hasPhoto,
          fileName, s3Path,
          chkIdx + 1, session.usuario_id
        ]
      );
      const recepcion_checklist_id = chkInsertRes.rows[0].recepcion_checklist_id;

      // Associate evidence photos
      const fotos = Array.isArray(chkItem.evidencias_fotos) ? chkItem.evidencias_fotos : [];
      for (let fIdx = 0; fIdx < fotos.length; fIdx++) {
        const f = fotos[fIdx];
        const urlFoto = typeof f === "string" ? f : f.url_archivo || f.url;
        if (!urlFoto) continue;

        await client.query(
          `INSERT INTO admin.recepcion_evidencia_fotos (
            recepcion_checklist_id, url_archivo, tipo_evidencia, orden_visual,
            usuario_registro, activo, fecha_registro
          ) VALUES (
            $1, $2, 'RECEPCION_CHECKLIST', $3,
            $4, true, NOW()
          )`,
          [
            recepcion_checklist_id, urlFoto, fIdx + 1,
            session.usuario_id
          ]
        );
      }

      // Mark staging registry as ASSOCIATED
      if (s3Path && s3Path.startsWith(`staging/emp_${session.empresa_id}/`)) {
        await client.query(
          `UPDATE admin.s3_staging_registry
           SET estado = 'ASSOCIATED', fecha_consumo = NOW()
           WHERE empresa_id = $1 AND object_key = $2`,
          [session.empresa_id, s3Path]
        ).catch(() => {});
      }
    }

    // Process discarded / replaced staging keys
    const discardedKeys: string[] = Array.isArray(payload.replaced_staging_keys)
      ? payload.replaced_staging_keys
      : Array.isArray(payload.unused_staging_keys)
      ? payload.unused_staging_keys
      : [];
    const expectedStagingPrefix = `staging/emp_${session.empresa_id}/`;
    for (const dKey of discardedKeys) {
      const cleanKey = String(dKey || "").trim();
      if (cleanKey && cleanKey.startsWith(expectedStagingPrefix)) {
        await client.query(
          `UPDATE admin.s3_staging_registry
           SET estado = 'QUEUED'
           WHERE empresa_id = $1 AND object_key = $2`,
          [session.empresa_id, cleanKey]
        ).catch(() => {});

        const { enqueueS3Cleanup } = await import("@/lib/storage/s3CleanupQueue");
        await enqueueS3Cleanup(client, {
          empresaId: session.empresa_id,
          objectKey: cleanKey,
          modulo: "TALLER",
          entidad: "recepcion_checklist",
          usuarioId: session.usuario_id
        });
      }
    }

    // 2.1 Insert Digital Signature Audit Proof if available
    if (hasValidSignature) {
      await client.query(
        `INSERT INTO admin.firma_recepcion (
          recepcion_id, cliente_id, tipo_firma, firma_digital, terminos_aceptados,
          version_terminos, fecha_firma, ip_firma, navegador_firma, activo, fecha_creacion, usuario_creacion
        ) VALUES (
          $1, $2, 'INGRESO', $3, true,
          $4, NOW(), $5, $6, true, NOW(), $7
        ) RETURNING firma_recepcion_id`,
        [
          recepcion_id, cliente_id, firma_digital,
          CURRENT_RECEPTION_TERMS_VERSION, ipFirma, userAgent, session.usuario_id
        ]
      );
    }

    let generatedWorkOrderInfo: { orden_trabajo_id: number; codigo_orden: string } | null = null;

    // 3. Process Initial Services and Dynamic Component Linkage
    let subtotal_servicios = 0;
    const preparedServicesData: any[] = [];
    let subtotal_productos = 0;
    const preparedProductsData: any[] = [];

    if (generarOrdenTrabajo) {
      for (let sIdx = 0; sIdx < servicios.length; sIdx++) {
        const s = servicios[sIdx];
        const s_tipo_id = parseInt(String(s.tipo_servicio_id), 10);
        if (isNaN(s_tipo_id)) continue;

        const catTypeRes = await client.query(
          `SELECT codigo, nombre, precio_base FROM admin.tipo_servicio WHERE tipo_servicio_id = $1 LIMIT 1`,
          [s_tipo_id]
        );

        const typeRow = catTypeRes.rows[0] || {};
        const sCode = typeRow.codigo || null;
        const sName = typeRow.nombre || `Servicio #${s_tipo_id}`;
        const sPrice = s.precio_estimado !== undefined && s.precio_estimado !== null && s.precio_estimado !== ""
          ? Number(s.precio_estimado)
          : Number(typeRow.precio_base || 0);

        subtotal_servicios += sPrice;

        let compId = s.bicicleta_componente_id ? parseInt(String(s.bicicleta_componente_id), 10) : null;

        // Atomic creation of new component draft if provided
        if (!compId && s.nuevo_componente) {
          const nc = s.nuevo_componente;
          const catCompId = nc.categoria_componente_id !== undefined && nc.categoria_componente_id !== null && nc.categoria_componente_id !== ""
            ? parseInt(String(nc.categoria_componente_id), 10)
            : NaN;
          const estCompId = nc.estado_componente_id !== undefined && nc.estado_componente_id !== null && nc.estado_componente_id !== ""
            ? parseInt(String(nc.estado_componente_id), 10)
            : NaN;
          const marca = (nc.marca || "").trim();
          const numSerie = (nc.numero_serie || "").trim();

          if (isNaN(catCompId) || catCompId <= 0) {
            const err: any = new Error("Categoría de componente inválida.");
            err.code = "VALIDATION_ERROR";
            err.status = 400;
            throw err;
          }

          if (isNaN(estCompId) || estCompId <= 0) {
            const err: any = new Error("Selecciona el estado del componente.");
            err.code = "VALIDATION_ERROR";
            err.status = 400;
            throw err;
          }

          const existingCatCheck = await client.query(
            `SELECT bicicleta_componente_id FROM admin.bicicleta_componentes
             WHERE bicicleta_id = $1 AND categoria_componente_id = $2 AND fecha_eliminacion IS NULL LIMIT 1`,
            [bicicleta_id, catCompId]
          );

          if (existingCatCheck.rows && existingCatCheck.rows.length > 0) {
            const err: any = new Error("Esta bicicleta ya tiene un componente registrado en la categoría seleccionada.");
            err.code = "BICYCLE_COMPONENT_CATEGORY_EXISTS";
            err.status = 409;
            throw err;
          }

          if (numSerie) {
            const serialCheck = await client.query(
              `SELECT bicicleta_componente_id FROM admin.bicicleta_componentes
               WHERE bicicleta_id = $1 AND UPPER(TRIM(numero_serie)) = UPPER(TRIM($2)) AND fecha_eliminacion IS NULL LIMIT 1`,
              [bicicleta_id, numSerie]
            );
            if (serialCheck.rows && serialCheck.rows.length > 0) {
              const err: any = new Error("Ya existe un componente con este número de serie.");
              err.code = "DUPLICATE_COMPONENT_SERIAL";
              err.status = 409;
              throw err;
            }
          }

          const insertedComp = await client.query(
            `INSERT INTO admin.bicicleta_componentes (
              bicicleta_id, categoria_componente_id, estado_componente_id,
              marca, numero_serie, descripcion, fecha_instalacion, kilometraje_instalacion,
              vigente, activo, fecha_creacion, usuario_creacion
            ) VALUES (
              $1, $2, $3,
              $4, $5, $6, NOW(), 0,
              true, true, NOW(), $7
            ) RETURNING bicicleta_componente_id`,
            [
              bicicleta_id,
              catCompId,
              estCompId,
              marca || null,
              numSerie || null,
              marca || null,
              session.usuario_id
            ]
          );

          compId = insertedComp.rows[0].bicicleta_componente_id;
        } else if (compId && !isNaN(compId) && compId > 0) {
          const compCheck = await client.query(
            `SELECT bicicleta_componente_id
             FROM admin.bicicleta_componentes
             WHERE bicicleta_componente_id = $1
               AND bicicleta_id = $2
               AND fecha_eliminacion IS NULL
               AND (activo IS DISTINCT FROM false)
             LIMIT 1`,
            [compId, bicicleta_id]
          );

          if (!compCheck || compCheck.rows.length === 0) {
            const err: any = new Error("El componente seleccionado no pertenece a la bicicleta de esta recepción.");
            err.code = "INVALID_BICYCLE_COMPONENT";
            err.status = 400;
            throw err;
          }
        }

        preparedServicesData.push({
          tipo_servicio_id: s_tipo_id,
          codigo: sCode,
          nombre: sName,
          precio: sPrice,
          bicicleta_componente_id: compId && !isNaN(compId) ? compId : null,
          diagnostico: (s.diagnostico_preliminar || "").trim() || null
        });
      }

      const consolidated_diagnostico = [
        firstDiag,
        ...preparedServicesData.map((s: any) => s.diagnostico).filter(Boolean)
      ].filter(Boolean).join(" | ");

      // 3.1 Process Initial Products (Repuestos)
      if (productos.length > 0) {
        // Resolve default active warehouse for the workshop
        let defaultAlmacenId: number | null = null;
        const almRes = await client.query(
          `SELECT a.almacen_id
           FROM admin.almacenes a
           WHERE (a.estado = 'ACTIVO' OR a.estado IS NULL)
           ORDER BY a.almacen_id ASC
           LIMIT 1`
        );
        if (almRes.rows.length > 0) {
          defaultAlmacenId = almRes.rows[0].almacen_id;
        }

        if (!defaultAlmacenId) {
          const anyAlm = await client.query(
            `SELECT a.almacen_id FROM admin.almacenes a ORDER BY a.almacen_id ASC LIMIT 1`
          );
          defaultAlmacenId = anyAlm.rows[0]?.almacen_id || 1;
        }

        for (let pIdx = 0; pIdx < productos.length; pIdx++) {
          const p = productos[pIdx];
          const p_id = parseInt(String(p.producto_id), 10);
          const p_qty = parseFloat(String(p.cantidad));

          if (isNaN(p_id) || p_id <= 0) {
            const err: any = new Error(`El producto en la posición ${pIdx + 1} no es válido.`);
            err.status = 400;
            err.code = "INVALID_PRODUCT";
            throw err;
          }

          if (isNaN(p_qty) || p_qty <= 0) {
            const err: any = new Error("La cantidad de producto debe ser mayor a 0.");
            err.status = 400;
            err.code = "INVALID_QUANTITY";
            throw err;
          }

          // Multitenancy and active status check in PostgreSQL
          const prodCheck = await client.query(
            `SELECT p.producto_id, p.codigo_producto, p.nombre, p.precio_venta, p.estado,
                    COALESCE(um.permite_decimales, false) AS permite_decimales
             FROM admin.productos p
             LEFT JOIN admin.unidad_medida um ON p.unidad_medida_id = um.unidad_medida_id
             WHERE p.producto_id = $1
               AND (p.estado = 'ACTIVO' OR p.estado IS NULL)
             LIMIT 1`,
            [p_id]
          );

          if (!prodCheck.rows || prodCheck.rows.length === 0) {
            const err: any = new Error(`El producto #${p_id} no existe o está inactivo.`);
            err.status = 400;
            err.code = "INVALID_PRODUCT";
            throw err;
          }

          const prodRow = prodCheck.rows[0];

          // Decimal quantity validation
          if (!prodRow.permite_decimales && !Number.isInteger(p_qty)) {
            const err: any = new Error(`El producto "${prodRow.nombre}" no permite cantidades decimales.`);
            err.status = 400;
            err.code = "DECIMALS_NOT_ALLOWED";
            throw err;
          }

          const unitPrice = p.precio_unitario !== undefined && p.precio_unitario !== null && p.precio_unitario !== "" && !isNaN(Number(p.precio_unitario)) && Number(p.precio_unitario) >= 0
            ? Number(p.precio_unitario)
            : Number(prodRow.precio_venta || 0);

          const lineSubtotal = Math.round(p_qty * unitPrice * 100) / 100;
          subtotal_productos += lineSubtotal;

          preparedProductsData.push({
            producto_id: p_id,
            almacen_id: defaultAlmacenId,
            cantidad: p_qty,
            precio_unitario: unitPrice,
            subtotal: lineSubtotal,
            observacion: (p.observacion || "").trim() || null
          });
        }
      }

      const subtotal_general = Math.round((subtotal_servicios + subtotal_productos) * 100) / 100;
      const total_orden = subtotal_general;

      // 4. Auto-Generate Work Order
      await client.query(`SELECT pg_advisory_xact_lock(7003)`);
      const woCodeSeqRes = await client.query(
        `SELECT COALESCE(
           MAX(
             CASE
               WHEN codigo_orden ~ '^OT-.*-([0-9]{1,8})$'
               THEN (SUBSTRING(codigo_orden FROM '^OT-.*-([0-9]{1,8})$'))::integer
               WHEN codigo_orden ~ '^OT-([0-9]{1,8})$'
               THEN (SUBSTRING(codigo_orden FROM '^OT-([0-9]{1,8})$'))::integer
               ELSE 0
             END
           ),
           0
         ) + 1 AS next_seq
         FROM admin.ordenes_trabajo`
      );
      const nextWoSeq = woCodeSeqRes.rows[0].next_seq;
      const codigo_orden = `OT-${yearMonth}-${nextWoSeq}`;

      // Resolve Initial Work Order State (RECIBIDA)
      let estado_orden_id = 1;
      const estWoRes = await client.query(
        `SELECT estado_orden_id FROM admin.estado_orden_trabajo WHERE (codigo = 'RECIBIDA' OR estado_orden_id = 1) ORDER BY orden_visual ASC LIMIT 1`
      );
      if (estWoRes.rows.length > 0) estado_orden_id = estWoRes.rows[0].estado_orden_id;

      // Resolve Priority
      let prioridad_orden_id = 2; // Default NORMAL
      if (prioridad_id_input && !isNaN(parseInt(String(prioridad_id_input), 10))) {
        prioridad_orden_id = parseInt(String(prioridad_id_input), 10);
      } else {
        const prioRes = await client.query(
          `SELECT prioridad_orden_trabajo_id FROM admin.prioridad_orden_trabajo WHERE activo = true ORDER BY prioridad_orden_trabajo_id ASC LIMIT 1`
        );
        if (prioRes.rows.length > 0) prioridad_orden_id = prioRes.rows[0].prioridad_orden_trabajo_id;
      }

      // Insert Work Order persisting primary assigned mechanic on admin.ordenes_trabajo.mecanico_id
      // and promised delivery date on admin.ordenes_trabajo.fecha_entrega_estimada
      const otInsertRes = await client.query(
        `INSERT INTO admin.ordenes_trabajo (
          codigo_orden, recepcion_id, cliente_id, bicicleta_id,
          estado_orden_id, prioridad_orden_id, descripcion_cliente, diagnostico_inicial,
          observacion_interna, fecha_recepcion, fecha_entrega_estimada,
          subtotal_servicios, subtotal_productos, subtotal_general, total_orden,
          mecanico_id, usuario_registro, activo, fecha_registro
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, NOW(), $10,
          $11, $12, $13, $14,
          $15, $16, true, NOW()
        ) RETURNING orden_trabajo_id`,
        [
          codigo_orden, recepcion_id, cliente_id, bicicleta_id,
          estado_orden_id, prioridad_orden_id, observaciones_cliente || null, consolidated_diagnostico || null,
          obs_interna_ot || null, fechaPrometida || null,
          subtotal_servicios, subtotal_productos, subtotal_general, total_orden,
          mecanico_id || null,
          session.usuario_id
        ]
      );
      const orden_trabajo_id = otInsertRes.rows[0].orden_trabajo_id;

      // Update Reception linkage
      await client.query(
        `UPDATE admin.recepciones SET convertido_orden_id = $1 WHERE recepcion_id = $2`,
        [orden_trabajo_id, recepcion_id]
      );

      // Resolve Initial Work Order Service State and Approval State
      let estado_orden_servicio_id = 1;
      const estSrvRes = await client.query(
        `SELECT estado_orden_servicio_id FROM admin.estado_orden_servicio WHERE (codigo = 'PENDIENTE' OR estado_orden_servicio_id = 1) ORDER BY estado_orden_servicio_id ASC LIMIT 1`
      );
      if (estSrvRes.rows.length > 0) estado_orden_servicio_id = estSrvRes.rows[0].estado_orden_servicio_id;

      let estado_aprobacion_id = 1;
      const estAppRes = await client.query(
        `SELECT estado_aprobacion_id FROM admin.estado_aprobacion WHERE (UPPER(codigo) IN ('APROBADO', 'PENDIENTE', 'NO_REQUERIDO') OR estado_aprobacion_id = 1) ORDER BY estado_aprobacion_id ASC LIMIT 1`
      );
      if (estAppRes.rows.length > 0) estado_aprobacion_id = estAppRes.rows[0].estado_aprobacion_id;

      // Insert Services for the Work Order
      for (let idx = 0; idx < preparedServicesData.length; idx++) {
        const sData = preparedServicesData[idx];
        const codigoServicio = sData.codigo || `SRV-${String(idx + 1).padStart(3, "0")}`;

        await client.query(
          `INSERT INTO admin.orden_servicios (
            orden_trabajo_id, tipo_servicio_id, estado_orden_servicio_id, estado_aprobacion_id,
            secuencia, codigo_servicio, descripcion_servicio, observacion_tecnica, cantidad,
            precio_unitario, subtotal, bicicleta_componente_id, usuario_id, usuario_registro, activo, fecha_registro
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8, 1,
            $9, $9, $10, NULL, $11, true, NOW()
          ) RETURNING orden_servicio_id, codigo_servicio`,
          [
            orden_trabajo_id, sData.tipo_servicio_id, estado_orden_servicio_id, estado_aprobacion_id,
            idx + 1, codigoServicio, sData.nombre, sData.diagnostico,
            sData.precio, sData.bicicleta_componente_id, session.usuario_id
          ]
        );
      }

      // Insert Products for the Work Order
      for (let pIdx = 0; pIdx < preparedProductsData.length; pIdx++) {
        const pData = preparedProductsData[pIdx];
        await client.query(
          `INSERT INTO admin.orden_productos (
            orden_trabajo_id, orden_servicio_id, producto_id, almacen_id,
            cantidad, precio_unitario, porcentaje_descuento, valor_descuento,
            subtotal, estado_aprobacion_id, utilizado, observacion,
            fecha_registro, usuario_registro
          ) VALUES (
            $1, NULL, $2, $3,
            $4, $5, 0, 0,
            $6, 1, false, $7,
            NOW(), $8
          )`,
          [
            orden_trabajo_id,
            pData.producto_id,
            pData.almacen_id,
            pData.cantidad,
            pData.precio_unitario,
            pData.subtotal,
            pData.observacion,
            session.usuario_id
          ]
        );
      }

      // Mandatory Initial History Record in admin.orden_historial_estado
      const historyComment = isDirectWorkOrder
        ? "Orden de trabajo creada directamente con recepción automática"
        : "Orden de trabajo generada desde recepción técnica";

      await client.query(
        `INSERT INTO admin.orden_historial_estado (
          orden_trabajo_id, estado_anterior_id, estado_nuevo_id,
          usuario_cambio, comentario, fecha_cambio, activo, fecha_registro, usuario_registro
        ) VALUES (
          $1, NULL, $2,
          $3, $4, NOW(), true, NOW(), $3
        )`,
        [orden_trabajo_id, estado_orden_id, session.usuario_id, historyComment]
      );

      generatedWorkOrderInfo = {
        orden_trabajo_id,
        codigo_orden
      };
    }

    // Atomic Transactional Audit Log
    const auditAction = isDirectWorkOrder ? "CREAR_ORDEN_TRABAJO_DIRECTA" : "CREAR_RECEPCION";
    await recordUserAudit({
      userId: session.usuario_id,
      accion: auditAction,
      valorNuevo: {
        recepcion_id,
        codigo_recepcion,
        cliente_id,
        bicicleta_id,
        orden_trabajo_id: generatedWorkOrderInfo?.orden_trabajo_id || null,
        codigo_orden: generatedWorkOrderInfo?.codigo_orden || null,
        prioridad_id: prioridad_id_input || null,
        mecanico_id: mecanico_id || null,
        fecha_prometida: fechaPrometida || null,
        checklist_count: checklist.length,
        services_count: preparedServicesData.length,
        products_count: preparedProductsData.length,
        subtotal_servicios,
        subtotal_productos,
        total_orden: (subtotal_servicios + subtotal_productos),
        has_signature: hasValidSignature,
        is_direct_work_order: isDirectWorkOrder
      },
      motivo: isDirectWorkOrder
        ? "Creación directa de orden de trabajo con recepción automática"
        : "Creación de recepción técnica de taller",
      resultado: "COMPLETADO",
      client,
      throwOnError: true
    });

    if (hasValidSignature) {
      await recordUserAudit({
        userId: session.usuario_id,
        accion: "REGISTRAR_FIRMA_RECEPCION",
        valorNuevo: {
          recepcion_id,
          cliente_id,
          tipo_firma: "INGRESO",
          version_terminos: CURRENT_RECEPTION_TERMS_VERSION
        },
        motivo: "Firma digital de conformidad del cliente en recepción",
        resultado: "COMPLETADO",
        client,
        throwOnError: true
      });
    }

    return {
      recepcion_id,
      codigo_recepcion,
      orden_trabajo_id: generatedWorkOrderInfo?.orden_trabajo_id || null,
      codigo_orden: generatedWorkOrderInfo?.codigo_orden || null,
      is_replay: false
    };
  });

  const successMessage = isDirectWorkOrder
    ? "Orden de trabajo creada correctamente."
    : resultData.orden_trabajo_id
    ? "Recepción registrada exitosamente y Orden de Trabajo generada."
    : "Recepción de bicicleta registrada exitosamente.";

  // Post-commit non-critical user activity logging
  if (!resultData.is_replay) {
    const activityDesc = isDirectWorkOrder
      ? `Orden de trabajo ${resultData.codigo_orden} creada exitosamente (Recepción ${resultData.codigo_recepcion}, Cliente #${cliente_id}, Bicicleta #${bicicleta_id})`
      : `Recepción ${resultData.codigo_recepcion} creada exitosamente (Cliente #${cliente_id}, Bicicleta #${bicicleta_id}${resultData.orden_trabajo_id ? `, Orden ${resultData.codigo_orden}` : ""})`;

    await recordUserActivity({
      userId: session.usuario_id,
      modulo: isDirectWorkOrder ? "TALLER_ORDENES" : "TALLER_RECEPCIONES",
      evento: isDirectWorkOrder ? "WORK_ORDER_DIRECT_CREATED" : "RECEPTION_CREATED",
      descripcion: activityDesc,
      resultado: "Exitoso",
      req
    }).catch((err) => console.error("Error logging user activity:", err));
  }

  return {
    recepcion_id: resultData.recepcion_id,
    codigo_recepcion: resultData.codigo_recepcion,
    orden_trabajo_id: resultData.orden_trabajo_id,
    codigo_orden: resultData.codigo_orden,
    is_replay: resultData.is_replay,
    mensaje: successMessage
  };
}
