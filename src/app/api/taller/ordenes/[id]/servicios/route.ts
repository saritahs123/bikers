import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { recalculateWorkOrderTotals } from "@/lib/workshop/recalculateWorkOrderTotals";
import crypto from "crypto";

function hashPayload(payload: any): string {
  if (!payload || typeof payload !== "object") return "";
  const sortKeys = (obj: any): any => {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(sortKeys);
    return Object.keys(obj)
      .sort()
      .reduce((result: any, key: string) => {
        result[key] = sortKeys(obj[key]);
        return result;
      }, {});
  };

  const sortedObj = sortKeys(payload);
  const jsonStr = JSON.stringify(sortedObj);
  return crypto.createHash("sha256").update(jsonStr).digest("hex");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let client: any = null;

  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "NO_SESSION", message: "No hay sesión activa." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_crear && !perms.puede_editar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permisos para agregar servicios a la orden." }, { status: 403 });
    }

    const { id: ordenIdParam } = await params;
    const ordenId = parseInt(ordenIdParam, 10);
    if (isNaN(ordenId)) {
      return NextResponse.json({ error: "ID de orden inválido." }, { status: 400 });
    }

    // Retrieve x-idempotency-key from headers and validate
    const idempotencyKey = request.headers.get("x-idempotency-key")?.trim() || null;
    if (!idempotencyKey) {
      return NextResponse.json({
        error: "IDEMPOTENCY_KEY_REQUIRED",
        message: "La clave de idempotencia 'x-idempotency-key' es obligatoria para realizar esta operación."
      }, { status: 400 });
    }

    const body = await request.json();
    const requestHash = hashPayload(body);

    const {
      tipo_servicio_id,
      cantidad,
      porcentaje_descuento,
      observaciones,
      observacion_tecnica,
      confirmar,
      motivo,
      bicicleta_componente_id,
      nuevo_componente
    } = body;

    const sessionUserId = session.usuario_id;

    if (!tipo_servicio_id) {
      return NextResponse.json({ error: "El tipo de servicio es obligatorio." }, { status: 400 });
    }

    // Mutually exclusive component validation
    const compId = bicicleta_componente_id ? parseInt(bicicleta_componente_id, 10) : null;
    if (compId && nuevo_componente) {
      return NextResponse.json({
        error: "MUTUALLY_EXCLUSIVE_COMPONENTS",
        message: "No se puede especificar un componente existente y un nuevo componente al mismo tiempo."
      }, { status: 400 });
    }

    // Connect to database pool after checks
    const pool = getPool();
    client = await pool.connect();

    await client.query("BEGIN");

    // 1. Enforce SQL idempotency verification using ON CONFLICT DO NOTHING
    const idempotencyInsert = await client.query(`
      INSERT INTO admin.idempotencia_operacion (
          empresa_id,
          usuario_id,
          clave_idempotencia,
          tipo_operacion,
          request_hash,
          estado,
          fecha_creacion,
          fecha_actualizacion
      ) VALUES ($1, $2, $3, 'CREAR_SERVICIO', $4, 'PROCESSING', NOW(), NOW())
      ON CONFLICT (empresa_id, usuario_id, tipo_operacion, clave_idempotencia)
      DO NOTHING
      RETURNING idempotencia_id;
    `, [session.empresa_id, sessionUserId, idempotencyKey, requestHash]);

    let idempotencyId: number | null = null;

    if (idempotencyInsert.rows.length > 0) {
      idempotencyId = parseInt(idempotencyInsert.rows[0].idempotencia_id, 10);
    } else {
      // Key exists, lock and query it
      const idemLock = await client.query(`
        SELECT idempotencia_id, request_hash, estado, codigo_http, respuesta_json
        FROM admin.idempotencia_operacion
        WHERE empresa_id = $1
          AND usuario_id = $2
          AND tipo_operacion = 'CREAR_SERVICIO'
          AND clave_idempotencia = $3
        FOR UPDATE;
      `, [session.empresa_id, sessionUserId, idempotencyKey]);

      if (idemLock.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "IDEMPOTENCY_QUERY_FAILED", message: "Error al verificar idempotencia." }, { status: 500 });
      }

      const existingRecord = idemLock.rows[0];
      idempotencyId = parseInt(existingRecord.idempotencia_id, 10);

      if (existingRecord.request_hash !== requestHash) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          error: "IDEMPOTENCY_KEY_REUSED",
          message: "Esta clave de idempotencia ya fue utilizada para una solicitud con parámetros diferentes."
        }, { status: 409 });
      }

      if (existingRecord.estado === "COMPLETED") {
        await client.query("ROLLBACK");
        return NextResponse.json(existingRecord.respuesta_json, { status: existingRecord.codigo_http });
      }

      if (existingRecord.estado === "PROCESSING") {
        await client.query("ROLLBACK");
        return NextResponse.json({
          error: "OPERATION_IN_PROGRESS",
          message: "La operación ya se encuentra en proceso. Inténtalo nuevamente en unos instantes."
        }, { status: 409 });
      }
    }

    // 2. Lock Order and fetch its data safely
    const otCheck = await client.query(`
      SELECT
          ot.orden_trabajo_id,
          ot.bicicleta_id,
          ot.estado_orden_id,
          u.empresa_id
      FROM admin.ordenes_trabajo ot
      JOIN admin.usuario u
        ON u.usuario_id = ot.usuario_registro
      WHERE ot.orden_trabajo_id = $1
        AND ot.activo IS DISTINCT FROM false
        AND u.empresa_id = $2
      FOR UPDATE OF ot;
    `, [ordenId, session.empresa_id]);

    if (otCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Orden de trabajo no encontrada." }, { status: 404 });
    }

    const estadoOrdenId = otCheck.rows[0].estado_orden_id;
    const bikeId = otCheck.rows[0].bicicleta_id;

    if (!bikeId) {
      await client.query("ROLLBACK");
      return NextResponse.json({
        error: "BICYCLE_NOT_ASSOCIATED",
        message: "La orden de trabajo no tiene una bicicleta vinculada."
      }, { status: 400 });
    }

    if (estadoOrdenId === 8) {
      await client.query("ROLLBACK");
      return NextResponse.json({
        error: "READ_ONLY_ORDER",
        message: "La orden se encuentra en estado ENTREGADA. Está en modo de solo lectura permanente."
      }, { status: 409 });
    }

    // Warning rule if order is already in Repair (5) or Ready for Delivery (7)
    if ((estadoOrdenId === 5 || estadoOrdenId === 7) && !confirmar) {
      await client.query("ROLLBACK");
      return NextResponse.json({
        warning: true,
        code: "REQUIRES_CONFIRMATION",
        message: "La orden de trabajo ya está en proceso. ¿Desea agregar este servicio adicional?",
        confirmRequired: true
      }, { status: 200 });
    }

    // Resolve estado_aprobacion_id from catalogs
    const appRes = await client.query(`
      SELECT estado_aprobacion_id
      FROM admin.estado_aprobacion
      WHERE UPPER(codigo) = 'APROBADO' AND (activo IS DISTINCT FROM false)
      LIMIT 1
    `);

    if (appRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({
        error: "APPROVAL_STATUS_NOT_CONFIGURED",
        message: "No fue posible agregar el servicio porque falta la configuración de aprobación."
      }, { status: 500 });
    }

    const estadoAprobacionId = appRes.rows[0].estado_aprobacion_id;

    // Generate sequence and codigo_servicio safely inside locked transaction
    const seqRes = await client.query(`
      SELECT COALESCE(MAX(secuencia), 0) + 1 AS next_seq,
             COALESCE(
               MAX(
                 CASE
                   WHEN codigo_servicio ~ '^SRV-[0-9]+$'
                   THEN SUBSTRING(codigo_servicio FROM '[0-9]+$')::integer
                   ELSE 0
                 END
               ),
               0
             ) + 1 AS siguiente_numero
      FROM admin.orden_servicios
      WHERE orden_trabajo_id = $1
    `, [ordenId]);

    const nextSecuencia = seqRes.rows[0].next_seq;
    const siguienteNumero = seqRes.rows[0].siguiente_numero;
    const codigoServicio = `SRV-${String(siguienteNumero).padStart(3, "0")}`;

    // Enforce catalog price protection from DB
    const tsRes = await client.query(`
      SELECT precio_base FROM admin.tipo_servicio WHERE tipo_servicio_id = $1 AND activo = true
    `, [tipo_servicio_id]);

    if (tsRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({
        error: "INVALID_SERVICE_TYPE",
        message: "El tipo de servicio seleccionado no existe o está inactivo."
      }, { status: 400 });
    }

    const finalPrecio = parseFloat(tsRes.rows[0].precio_base || "0");
    const finalCantidad = cantidad ? parseFloat(cantidad) : 1;
    const finalDescPct = porcentaje_descuento ? parseFloat(porcentaje_descuento) : 0;
    const grossTotal = finalCantidad * finalPrecio;
    const valDesc = (grossTotal * finalDescPct) / 100;
    const finalSubtotal = grossTotal - valDesc;

    let finalComponenteId: number | null = null;
    let componenteCreado = false;

    if (compId && compId > 0) {
      // Validate existing component
      const compCheck = await client.query(`
        SELECT bc.bicicleta_componente_id
        FROM admin.bicicleta_componentes bc
        JOIN admin.ordenes_trabajo ot ON ot.bicicleta_id = bc.bicicleta_id
        WHERE ot.orden_trabajo_id = $1
          AND bc.bicicleta_componente_id = $2
          AND bc.activo IS DISTINCT FROM false
          AND bc.fecha_eliminacion IS NULL
        FOR SHARE OF bc;
      `, [ordenId, compId]);

      if (compCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          error: "INVALID_BICYCLE_COMPONENT",
          message: "El componente seleccionado no pertenece a la bicicleta de esta orden."
        }, { status: 400 });
      }
      finalComponenteId = compId;
    } else if (nuevo_componente && typeof nuevo_componente === "object") {
      const catId = parseInt(nuevo_componente.categoria_componente_id, 10);
      const estId = parseInt(nuevo_componente.estado_componente_id, 10);
      const marca = (nuevo_componente.marca || "").trim() || null;
      const serial = (nuevo_componente.numero_serie || "").trim() || null;

      if (isNaN(catId) || catId <= 0 || isNaN(estId) || estId <= 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          error: "INVALID_NEW_COMPONENT_DATA",
          message: "La categoría y estado del nuevo componente son obligatorios."
        }, { status: 400 });
      }

      // Check category exists & active
      const catCheck = await client.query(`
        SELECT categoria_componente_id FROM admin.categoria_componente WHERE categoria_componente_id = $1 AND activo = true
      `, [catId]);
      if (catCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          error: "INVALID_COMPONENT_CATEGORY",
          message: "La categoría de componente seleccionada no existe o está inactiva."
        }, { status: 400 });
      }

      // Check duplicate category check for bike before insert
      const catDupCheck = await client.query(`
        SELECT bc.bicicleta_componente_id, bc.categoria_componente_id
        FROM admin.bicicleta_componentes bc
        WHERE bc.bicicleta_id = $1
          AND bc.categoria_componente_id = $2
          AND bc.fecha_eliminacion IS NULL
          AND (bc.activo IS DISTINCT FROM false)
        LIMIT 1
        FOR SHARE;
      `, [bikeId, catId]);

      if (catDupCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          success: false,
          error: "BICYCLE_COMPONENT_CATEGORY_EXISTS",
          message: "Esta bicicleta ya tiene un componente registrado en la categoría seleccionada.",
          data: {
            bicicleta_componente_id: catDupCheck.rows[0].bicicleta_componente_id,
            categoria_componente_id: catDupCheck.rows[0].categoria_componente_id
          }
        }, { status: 409 });
      }

      // Check state exists & active
      const estCheck = await client.query(`
        SELECT estado_componente_id FROM admin.estado_componente WHERE estado_componente_id = $1 AND activo = true
      `, [estId]);
      if (estCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          error: "INVALID_COMPONENT_STATE",
          message: "El estado de componente seleccionado no existe o está inactivo."
        }, { status: 400 });
      }

      // Check duplicate serial number if serial provided
      if (serial) {
        const dupCheck = await client.query(`
          SELECT bicicleta_componente_id
          FROM admin.bicicleta_componentes
          WHERE bicicleta_id = $1
            AND UPPER(TRIM(numero_serie)) = UPPER(TRIM($2))
            AND fecha_eliminacion IS NULL
            AND (activo IS DISTINCT FROM false)
        `, [bikeId, serial]);

        if (dupCheck.rows.length > 0) {
          await client.query("ROLLBACK");
          return NextResponse.json({
            error: "DUPLICATE_COMPONENT_SERIAL",
            message: "Ya existe un componente con este número de serie."
          }, { status: 409 });
        }
      }

      // Generate next component ID and INSERT into admin.bicicleta_componentes using bikeId exclusively
      const insertCompRes = await client.query(`
        INSERT INTO admin.bicicleta_componentes (
          bicicleta_componente_id,
          bicicleta_id,
          categoria_componente_id,
          estado_componente_id,
          marca,
          numero_serie,
          activo,
          fecha_creacion,
          usuario_creacion
        ) VALUES (
          (SELECT COALESCE(MAX(bicicleta_componente_id), 0) + 1 FROM admin.bicicleta_componentes),
          $1, $2, $3, $4, $5, true, NOW(), $6
        )
        RETURNING bicicleta_componente_id, bicicleta_id;
      `, [
        bikeId,
        catId,
        estId,
        marca,
        serial,
        sessionUserId
      ]);

      if (!insertCompRes.rows[0]?.bicicleta_componente_id) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          error: "COMPONENT_INSERT_FAILED",
          message: "No fue posible registrar el nuevo componente de la bicicleta."
        }, { status: 500 });
      }

      if (insertCompRes.rows[0].bicicleta_id !== bikeId) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          error: "COMPONENT_BICYCLE_MISMATCH",
          message: "Error de consistencia: La bicicleta del nuevo componente no coincide con la orden."
        }, { status: 409 });
      }

      finalComponenteId = insertCompRes.rows[0].bicicleta_componente_id;
      componenteCreado = true;
    }

    // Insert Service into admin.orden_servicios
    const insertServRes = await client.query(`
      INSERT INTO admin.orden_servicios (
        orden_servicio_id,
        orden_trabajo_id,
        codigo_servicio,
        tipo_servicio_id,
        estado_orden_servicio_id,
        estado_aprobacion_id,
        secuencia,
        usuario_id,
        cantidad,
        precio_unitario,
        porcentaje_descuento,
        valor_descuento,
        subtotal,
        observacion_tecnica,
        bicicleta_componente_id,
        nuevo_estado_componente_id,
        activo,
        fecha_registro,
        usuario_registro
      ) VALUES (
        (SELECT COALESCE(MAX(orden_servicio_id), 0) + 1 FROM admin.orden_servicios),
        $1, $2, $3, 1, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NULL, true, NOW(), $6
      )
      RETURNING orden_servicio_id, codigo_servicio, bicicleta_componente_id;
    `, [
      ordenId,
      codigoServicio,
      tipo_servicio_id,
      estadoAprobacionId,
      nextSecuencia,
      sessionUserId,
      finalCantidad,
      finalPrecio,
      finalDescPct,
      valDesc,
      finalSubtotal,
      motivo || observaciones || observacion_tecnica || null,
      finalComponenteId
    ]);

    const newServId = insertServRes.rows[0].orden_servicio_id;

    // PRE-COMMIT VERIFICATIONS
    if (finalComponenteId) {
      // Case A: Service with Component verification
      const crossCheck = await client.query(`
        SELECT os.orden_servicio_id, os.codigo_servicio, os.bicicleta_componente_id
        FROM admin.orden_servicios os
        JOIN admin.bicicleta_componentes bc ON bc.bicicleta_componente_id = os.bicicleta_componente_id
        WHERE os.orden_servicio_id = $1
          AND os.orden_trabajo_id = $2
          AND bc.bicicleta_id = $3;
      `, [newServId, ordenId, bikeId]);

      if (crossCheck.rows.length !== 1) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          error: "COMPONENT_ASSOCIATION_MISMATCH",
          message: "Error de integridad: El componente asociado no pertenece a la bicicleta de la orden."
        }, { status: 409 });
      }
    } else {
      // Case B: General Service verification
      const crossCheck = await client.query(`
        SELECT os.orden_servicio_id, os.codigo_servicio, os.bicicleta_componente_id
        FROM admin.orden_servicios os
        WHERE os.orden_servicio_id = $1
          AND os.orden_trabajo_id = $2
          AND os.bicicleta_componente_id IS NULL;
      `, [newServId, ordenId]);

      if (crossCheck.rows.length !== 1) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          error: "SERVICE_ASSOCIATION_FAILED",
          message: "Error de integridad: El servicio general no pudo ser verificado."
        }, { status: 409 });
      }
    }

    // Register Historial log
    await client.query(`
      INSERT INTO admin.orden_historial_estado (
        orden_historial_estado_id, orden_trabajo_id, estado_anterior_id, estado_nuevo_id, usuario_cambio, comentario, fecha_cambio, activo, fecha_registro
      ) VALUES (
        (SELECT COALESCE(MAX(orden_historial_estado_id), 0) + 1 FROM admin.orden_historial_estado),
        $1, $2, $2, $3, $4, NOW(), true, NOW()
      )
    `, [
      ordenId,
      estadoOrdenId,
      sessionUserId,
      `Servicio ${codigoServicio} agregado (ID #${newServId})${motivo ? `: ${motivo}` : ''}`
    ]);

    // Recalculate totals in transaction
    await recalculateWorkOrderTotals(client, ordenId);

    // Save final response payload
    const responseData = {
      success: true,
      message: "Servicio y componente agregados correctamente.",
      data: {
        servicio_id: newServId,
        orden_servicio_id: newServId,
        codigo_servicio: codigoServicio,
        bicicleta_componente_id: finalComponenteId,
        bicicleta_id: bikeId,
        componente_creado: componenteCreado
      }
    };

    // Update idempotency record to completed state
    if (idempotencyId) {
      const idemUpdate = await client.query(`
        UPDATE admin.idempotencia_operacion
        SET estado = 'COMPLETED',
            codigo_http = 201,
            respuesta_json = $1,
            recurso_id = $2,
            fecha_actualizacion = NOW()
        WHERE idempotencia_id = $3
          AND empresa_id = $4
          AND usuario_id = $5
          AND tipo_operacion = 'CREAR_SERVICIO'
          AND clave_idempotencia = $6
          AND request_hash = $7
          AND estado = 'PROCESSING'
      `, [responseData, newServId, idempotencyId, session.empresa_id, sessionUserId, idempotencyKey, requestHash]);

      if (idemUpdate.rowCount !== 1) {
        await client.query("ROLLBACK");
        return NextResponse.json({
          error: "IDEMPOTENCY_UPDATE_FAILED",
          message: "Error al confirmar el registro de idempotencia de la operación."
        }, { status: 500 });
      }
    }

    // Commit transaction permanently
    await client.query("COMMIT");

    return NextResponse.json(responseData, { status: 201 });

  } catch (err: any) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }
    console.error("POST /api/taller/ordenes/[id]/servicios Error:", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      constraint: err?.constraint,
      stack: err?.stack
    });

    if (err?.code === "23505") {
      if (err?.constraint?.includes("uk_orden_servicios_codigo") || err?.detail?.includes("codigo_servicio")) {
        return NextResponse.json({
          success: false,
          error: "DUPLICATE_SERVICE_CODE",
          message: "Ya existe un servicio con el mismo código asignado a esta orden."
        }, { status: 409 });
      }
      if (err?.constraint?.includes("uk_idempotencia_operacion")) {
        return NextResponse.json({
          success: false,
          error: "OPERATION_IN_PROGRESS",
          message: "La operación ya se encuentra en proceso (concurrente)."
        }, { status: 409 });
      }
    }

    const isCatDup = (err?.code === "23505" || err?.code === "BICYCLE_COMPONENT_CATEGORY_EXISTS") &&
      (err?.constraint?.includes("uk_bicicleta_componentes") || err?.detail?.includes("categoria_componente_id") || err?.message?.includes("BICYCLE_COMPONENT_CATEGORY_EXISTS"));

    const isDupSerial = err?.code === "DUPLICATE_COMPONENT_SERIAL" || err?.message?.includes("DUPLICATE_COMPONENT_SERIAL");

    if (isCatDup) {
      return NextResponse.json({
        success: false,
        error: "BICYCLE_COMPONENT_CATEGORY_EXISTS",
        message: "Esta bicicleta ya tiene un componente registrado en la categoría seleccionada."
      }, { status: 409 });
    }

    if (isDupSerial) {
      return NextResponse.json({
        success: false,
        error: "DUPLICATE_COMPONENT_SERIAL",
        message: "Ya existe un componente con este número de serie."
      }, { status: 409 });
    }

    return NextResponse.json({
      success: false,
      error: "SERVICE_ADD_FAILED",
      message: err.message || "Error al agregar servicio."
    }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}
