import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

async function getWorkshopSession() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("session_user_id")?.value;
    return { usuario_id: userId ? parseInt(userId, 10) : 1, rol_principal_id: 1 };
  } catch (err) {
    return { usuario_id: 1, rol_principal_id: 1 };
  }
}

// Allowed State Transitions Matrix (Only 4 operational states: 1: RECIBIDA, 5: REPARACION, 7: LISTA_ENTREGA, 8: ENTREGADA)
const ALLOWED_TRANSITIONS: Record<number, number[]> = {
  1: [5],       // RECIBIDA -> REPARACION
  5: [7],       // REPARACION -> LISTA_ENTREGA
  7: [5, 8],    // LISTA_ENTREGA -> REPARACION (devolución) or ENTREGADA
  8: []         // ENTREGADA is terminal
};

// GET /api/taller/ordenes/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ordenId = parseInt(id, 10);

    if (isNaN(ordenId)) {
      return NextResponse.json({ error: "ID de orden inválido." }, { status: 400 });
    }

    // Main Order Data
    const sql = `
      SELECT 
        ot.orden_trabajo_id AS orden_id,
        ot.codigo_orden,
        ot.recepcion_id,
        r.codigo_recepcion,
        r.fecha_recepcion,
        r.diagnostico_preliminar AS motivo_ingreso,
        r.observaciones_cliente AS recepcion_observaciones,
        ot.estado_orden_id,
        eot.nombre AS estado_nombre,
        eot.codigo AS estado_codigo,
        ot.prioridad_orden_id AS prioridad_id,
        pot.nombre AS prioridad_nombre,
        pot.color_estado AS prioridad_color,
        ot.fecha_recepcion AS fecha_ingreso,
        ot.fecha_entrega_estimada AS fecha_prometida,
        ot.fecha_inicio_trabajo AS fecha_inicio,
        ot.fecha_finalizacion AS fecha_termino,
        ot.diagnostico_inicial,
        ot.observacion_interna AS observaciones,
        ot.activo,
        COALESCE(c.cliente_id, r.cliente_id) AS cliente_id,
        COALESCE(c.nombre_completo, 'Cliente General') AS cliente_nombre,
        c.telefono_principal AS cliente_telefono,
        c.correo AS cliente_correo,
        COALESCE(b.bicicleta_id, r.bicicleta_id) AS bicicleta_id,
        COALESCE(b.marca, 'Bicicleta') AS bicicleta_marca,
        COALESCE(b.modelo, 'Sin Modelo') AS bicicleta_modelo,
        b.tipo_bicicleta,
        b.ano AS bicicleta_ano,
        b.color AS bicicleta_color,
        b.numero_serie_cuadro AS bicicleta_serie
      FROM admin.ordenes_trabajo ot
      LEFT JOIN admin.recepciones r ON ot.recepcion_id = r.recepcion_id
      LEFT JOIN admin.clientes c ON ot.cliente_id = c.cliente_id OR r.cliente_id = c.cliente_id
      LEFT JOIN admin.bicicletas b ON ot.bicicleta_id = b.bicicleta_id OR r.bicicleta_id = b.bicicleta_id
      LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
      LEFT JOIN admin.prioridad_orden_trabajo pot ON ot.prioridad_orden_id = pot.prioridad_orden_trabajo_id
      WHERE ot.orden_trabajo_id = $1 AND ot.activo = true
    `;

    const res = await query(sql, [ordenId]);

    if (res.length === 0) {
      return NextResponse.json({ error: "Orden de Trabajo no encontrada." }, { status: 404 });
    }

    const order = res[0];

    // Mechanics assigned to the Order's Services
    const mecanicosSql = `
      SELECT DISTINCT
        os.usuario_id,
        COALESCE(NULLIF(TRIM(ui.nombre || ' ' || ui.apellido), ''), ('Mecánico #' || u.usuario_id::text)) AS nombre
      FROM admin.orden_servicios os
      JOIN admin.usuario u ON os.usuario_id = u.usuario_id
      JOIN admin.tipo_usuario tu ON tu.tipo_usuario_id = u.tipo_usuario_id
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE os.orden_trabajo_id = $1 AND os.usuario_id IS NOT NULL AND tu.codigo = 'MECANICO' AND u.estado = 'ACTIVO' AND (os.activo IS DISTINCT FROM false)
      ORDER BY os.usuario_id ASC
    `;
    const mecanicosList = await query(mecanicosSql, [ordenId]);
    order.mecanicos = mecanicosList || [];

    const servicesSql = `
      SELECT 
        os.orden_servicio_id,
        os.orden_trabajo_id AS orden_id,
        os.tipo_servicio_id,
        ts.nombre AS tipo_servicio_nombre,
        ts.descripcion AS tipo_servicio_descripcion,
        os.tiempo_estimado_minutos,
        os.estado_orden_servicio_id AS estado_servicio_id,
        eos.nombre AS estado_servicio_nombre,
        eos.codigo AS estado_servicio_codigo,
        os.estado_aprobacion_id,
        ea.nombre AS estado_aprobacion_nombre,
        ea.codigo AS estado_aprobacion_codigo,
        os.usuario_id,
        u.tipo_usuario_id,
        tu.codigo AS tipo_usuario_codigo,
        tu.nombre AS tipo_usuario_nombre,
        COALESCE(NULLIF(TRIM(ui.nombre || ' ' || ui.apellido), ''), ('Usuario #' || u.usuario_id::text)) AS mecanico_nombre_raw,
        COALESCE(os.precio_unitario, ts.precio_base, 0) AS precio_acordado,
        os.observacion_tecnica AS observaciones,
        os.fecha_registro AS fecha_creacion,
        os.activo,
        COALESCE(
          (SELECT SUM(COALESCE(op.cantidad * op.precio_unitario, 0))
           FROM admin.orden_productos op
           WHERE op.orden_servicio_id = os.orden_servicio_id), 0
        ) AS total_productos
      FROM admin.orden_servicios os
      LEFT JOIN admin.tipo_servicio ts ON os.tipo_servicio_id = ts.tipo_servicio_id
      LEFT JOIN admin.estado_orden_servicio eos ON os.estado_orden_servicio_id = eos.estado_orden_servicio_id
      LEFT JOIN admin.estado_aprobacion ea ON os.estado_aprobacion_id = ea.estado_aprobacion_id
      LEFT JOIN admin.usuario u ON os.usuario_id = u.usuario_id
      LEFT JOIN admin.tipo_usuario tu ON u.tipo_usuario_id = tu.tipo_usuario_id
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      WHERE os.orden_trabajo_id = $1 AND (os.activo IS DISTINCT FROM false)
      ORDER BY os.orden_servicio_id ASC
    `;
    const services = await query(servicesSql, [ordenId]);

    // Format mechanic assignment validity per service
    for (const s of services) {
      if (s.usuario_id) {
        if (s.tipo_usuario_codigo === "MECANICO") {
          s.mecanico_nombre = s.mecanico_nombre_raw;
          s.es_asignacion_valida = true;
        } else {
          s.mecanico_nombre = `Asignación inválida (${s.mecanico_nombre_raw} - ${s.tipo_usuario_nombre || 'No Mecánico'})`;
          s.es_asignacion_valida = false;
        }
      } else {
        s.mecanico_nombre = "Sin mecánico asignado";
        s.es_asignacion_valida = false;
      }
    }

    // Labor entries & products
    for (const service of services) {
      const laborSql = `
        SELECT 
          mo.*,
          COALESCE(mo.observacion, 'Registro de mano de obra') AS descripcion,
          ROUND((COALESCE(mo.minutos_trabajados, 60) / 60.0), 1) AS horas_trabajadas
        FROM admin.orden_servicio_mano_obra mo
        WHERE mo.orden_servicio_id = $1
      `;
      service.mano_obra = await query(laborSql, [service.orden_servicio_id]);

      const productsSql = `
        SELECT 
          op.*,
          p.nombre AS producto_nombre,
          p.codigo_producto AS producto_sku,
          (COALESCE(op.cantidad, 1) * COALESCE(op.precio_unitario, 0)) AS subtotal
        FROM admin.orden_productos op
        JOIN admin.productos p ON op.producto_id = p.producto_id
        WHERE op.orden_servicio_id = $1
      `;
      service.productos = await query(productsSql, [service.orden_servicio_id]);
    }

    // Service & Labor Evaluation
    const serviceCheckSql = `
      SELECT
        os.orden_servicio_id,
        os.tipo_servicio_id,
        ts.nombre AS tipo_servicio_nombre,
        os.estado_orden_servicio_id,
        eos.codigo AS estado_codigo,
        eos.nombre AS estado_nombre,
        os.usuario_id,
        COUNT(osmo.orden_servicio_mano_obra_id)::int AS total_registros,
        COUNT(*) FILTER (WHERE osmo.minutos_trabajados > 0)::int AS registros_validos,
        COALESCE(SUM(osmo.minutos_trabajados) FILTER (WHERE osmo.minutos_trabajados > 0), 0)::int AS minutos_validos
      FROM admin.orden_servicios os
      LEFT JOIN admin.tipo_servicio ts ON ts.tipo_servicio_id = os.tipo_servicio_id
      LEFT JOIN admin.estado_orden_servicio eos ON eos.estado_orden_servicio_id = os.estado_orden_servicio_id
      LEFT JOIN admin.orden_servicio_mano_obra osmo ON osmo.orden_servicio_id = os.orden_servicio_id
      WHERE os.orden_trabajo_id = $1 AND (os.activo IS DISTINCT FROM false)
      GROUP BY os.orden_servicio_id, os.tipo_servicio_id, ts.nombre, os.estado_orden_servicio_id, eos.codigo, eos.nombre, os.usuario_id
      ORDER BY os.orden_servicio_id ASC
    `;

    const evalServices = await query(serviceCheckSql, [ordenId]);
    const applicableServices = evalServices.filter((s: any) => s.estado_codigo !== "CANCELADO");

    // Fetch ONLY the 4 operational order states (RECIBIDA: 1, REPARACION: 5, LISTA_ENTREGA: 7, ENTREGADA: 8)
    const allOrderStates = await query(`
      SELECT estado_orden_id, codigo, nombre
      FROM admin.estado_orden_trabajo
      WHERE activo = true AND estado_orden_id IN (1, 5, 7, 8)
      ORDER BY orden_visual ASC
    `);

    const validacionTransiciones: any[] = [];
    const currentEstadoId = order.estado_orden_id;
    const allowedTargets = ALLOWED_TRANSITIONS[currentEstadoId] || [];

    for (const targetState of allOrderStates) {
      const isAllowedByMatrix = allowedTargets.includes(targetState.estado_orden_id);
      const motivosGlobales: string[] = [];
      const blockers: any[] = [];
      const advertencias: string[] = [];

      if (isAllowedByMatrix) {
        // Transition RECIBIDA -> REPARACION (1 -> 5)
        if (targetState.estado_orden_id === 5) {
          if (applicableServices.length === 0) {
            motivosGlobales.push("SIN_SERVICIOS");
          } else {
            for (const svc of applicableServices) {
              if (!svc.usuario_id) {
                blockers.push({
                  orden_servicio_id: svc.orden_servicio_id,
                  tipo_servicio_nombre: svc.tipo_servicio_nombre || "Servicio",
                  estado: svc.estado_nombre || "Pendiente",
                  motivos: ["SIN_MECANICO"]
                });
              }
            }
          }
        }

        // Transition REPARACION -> LISTA_ENTREGA (5 -> 7)
        if (targetState.estado_orden_id === 7) {
          if (applicableServices.length === 0) {
            motivosGlobales.push("SIN_SERVICIOS");
          } else {
            for (const svc of applicableServices) {
              const svcMotivos: string[] = [];
              if (!svc.usuario_id) {
                svcMotivos.push("SIN_MECANICO");
              }
              if (!svc.estado_codigo || svc.estado_codigo !== "COMPLETADO") {
                svcMotivos.push("SERVICIO_NO_COMPLETADO");
              }
              if (svcMotivos.length > 0) {
                blockers.push({
                  orden_servicio_id: svc.orden_servicio_id,
                  tipo_servicio_nombre: svc.tipo_servicio_nombre || "Servicio",
                  estado: svc.estado_nombre || "Pendiente",
                  motivos: svcMotivos
                });
              }
            }
          }
        }
      }

      const requisitosCumplidos = motivosGlobales.length === 0 && blockers.length === 0;
      const permitida = isAllowedByMatrix && requisitosCumplidos;

      validacionTransiciones.push({
        estado_destino_id: targetState.estado_orden_id,
        codigo: targetState.codigo,
        nombre: targetState.nombre,
        transicion_permitida: isAllowedByMatrix,
        requisitos_cumplidos: requisitosCumplidos,
        permitida: permitida,
        motivos_globales: motivosGlobales,
        blockers: blockers,
        advertencias: advertencias
      });
    }

    // Status History
    const historySql = `
      SELECT 
        oh.orden_historial_estado_id AS historial_id,
        oh.orden_trabajo_id AS orden_id,
        oh.estado_anterior_id,
        e_ant.nombre AS estado_anterior_nombre,
        oh.estado_nuevo_id,
        e_nue.nombre AS estado_nuevo_nombre,
        oh.usuario_cambio AS usuario_id,
        ('Usuario #' || oh.usuario_cambio::text) AS usuario_nombre,
        oh.comentario AS observacion,
        oh.fecha_cambio
      FROM admin.orden_historial_estado oh
      JOIN admin.estado_orden_trabajo e_nue ON oh.estado_nuevo_id = e_nue.estado_orden_id
      LEFT JOIN admin.estado_orden_trabajo e_ant ON oh.estado_anterior_id = e_ant.estado_orden_id
      WHERE oh.orden_trabajo_id = $1
      ORDER BY oh.orden_historial_estado_id ASC
    `;
    const history = await query(historySql, [ordenId]);

    // Financial Summary & Metrics Calculations
    let totalServicios = 0;
    let totalProductos = 0;
    let totalTiempoEstimadoMinutos = 0;
    let totalHorasTrabajadas = 0;
    let completedServicesCount = 0;
    const allProductsInOrder: any[] = [];
    const lowStockAlerts: any[] = [];

    services.forEach((s: any) => {
      totalServicios += parseFloat(s.precio_acordado || 0);
      totalTiempoEstimadoMinutos += Number(s.tiempo_estimado_minutos || 0);

      if (s.estado_servicio_codigo === "COMPLETADO" || s.estado_servicio_id === 3) {
        completedServicesCount++;
      }

      s.mano_obra?.forEach((mo: any) => {
        totalHorasTrabajadas += Number(mo.horas_trabajadas || mo.horas || (mo.minutos_trabajados ? mo.minutos_trabajados / 60 : 1));
      });

      s.productos?.forEach((p: any) => {
        totalProductos += parseFloat(p.subtotal || 0);
        allProductsInOrder.push(p);
        if (p.stock_actual !== undefined && p.stock_minimo !== undefined && p.stock_actual <= p.stock_minimo) {
          lowStockAlerts.push({
            producto_id: p.producto_id,
            producto_nombre: p.producto_nombre,
            producto_sku: p.producto_sku || "SKU-N/A",
            stock_actual: p.stock_actual,
            stock_minimo: p.stock_minimo
          });
        }
      });
    });

    const progresoPorcentaje = services.length > 0 
      ? Math.round((completedServicesCount / services.length) * 100) 
      : 0;

    const totalEstimado = totalServicios + totalProductos;
    const horasEstimadas = Number((totalTiempoEstimadoMinutos / 60).toFixed(1));
    const horasRegistradas = Number(totalHorasTrabajadas.toFixed(1));

    return NextResponse.json({
      success: true,
      data: {
        ...order,
        servicios: services,
        productos: allProductsInOrder,
        historial: history,
        progreso_porcentaje: progresoPorcentaje,
        horas_estimadas: horasEstimadas,
        horas_registradas: horasRegistradas,
        alertas_repuestos: lowStockAlerts,
        estado_actual: {
          id: currentEstadoId,
          codigo: order.estado_codigo,
          nombre: order.estado_nombre
        },
        validacion_transiciones: validacionTransiciones,
        resumen_financiero: {
          subtotal_servicios: totalServicios,
          subtotal_productos: totalProductos,
          total_estimado: totalEstimado
        }
      }
    });
  } catch (err: any) {
    console.error("GET /api/taller/ordenes/[id] Error:", err);
    return NextResponse.json({ error: "Error al obtener el detalle de la orden de trabajo.", details: err.message }, { status: 500 });
  }
}

// PUT /api/taller/ordenes/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ordenId = parseInt(id, 10);

    if (isNaN(ordenId)) {
      return NextResponse.json({ error: "ID de orden inválido." }, { status: 400 });
    }

    const session = await getWorkshopSession();
    if (!session || !session.usuario_id) {
      return NextResponse.json(
        { error: "NO_SESSION", message: "Sesión no válida o expirada. Por favor inicie sesión." },
        { status: 401 }
      );
    }
    const sessionUserId = session.usuario_id;

    const body = await req.json();
    const {
      estado_orden_id,
      estado_anterior_esperado_id,
      prioridad_id,
      fecha_prometida,
      diagnostico_inicial,
      observaciones,
      observacion_cambio_estado
    } = body;

    await query("BEGIN");

    // Lock Order Parent Record FIRST
    const existingRes = await query(`
      SELECT 
        ot.orden_trabajo_id, 
        ot.estado_orden_id, 
        ot.prioridad_orden_id,
        ot.fecha_inicio_trabajo,
        ot.fecha_finalizacion,
        ot.fecha_entrega_real,
        eot.nombre AS estado_nombre,
        eot.codigo AS estado_codigo
      FROM admin.ordenes_trabajo ot
      LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
      WHERE ot.orden_trabajo_id = $1 AND ot.activo = true
      FOR UPDATE OF ot
    `, [ordenId]);

    if (existingRes.length === 0) {
      await query("ROLLBACK");
      return NextResponse.json({ error: "Orden de Trabajo no encontrada." }, { status: 404 });
    }

    const current = existingRes[0];
    const newEstadoId = estado_orden_id ? parseInt(estado_orden_id, 10) : current.estado_orden_id;

    // Concurrency check
    if (estado_anterior_esperado_id && parseInt(estado_anterior_esperado_id, 10) !== current.estado_orden_id) {
      await query("ROLLBACK");
      return NextResponse.json(
        { error: "La orden fue modificada concurrentemente por otro usuario. El estado actual ha cambiado.", conflict: true },
        { status: 409 }
      );
    }

    // Target status existence check (must be one of 1, 5, 7, 8)
    const targetStatusRes = await query(`
      SELECT estado_orden_id, codigo, nombre
      FROM admin.estado_orden_trabajo
      WHERE estado_orden_id = $1 AND activo = true AND estado_orden_id IN (1, 5, 7, 8)
    `, [newEstadoId]);

    if (targetStatusRes.length === 0) {
      await query("ROLLBACK");
      return NextResponse.json({ error: "El estado de destino seleccionado no es un estado operativo válido (Recibida, Reparación, Lista para Entrega, Entregada)." }, { status: 400 });
    }

    const targetStatus = targetStatusRes[0];

    // Check transition matrix validity
    if (newEstadoId !== current.estado_orden_id) {
      const allowedTargets = ALLOWED_TRANSITIONS[current.estado_orden_id] || [];
      if (!allowedTargets.includes(newEstadoId)) {
        await query("ROLLBACK");
        return NextResponse.json(
          { error: `Transición no permitida desde '${current.estado_nombre}' hacia '${targetStatus.nombre}'.` },
          { status: 409 }
        );
      }

      // Fetch active services for validation
      const serviceCheckSql = `
        SELECT
          os.orden_servicio_id,
          os.tipo_servicio_id,
          ts.nombre AS tipo_servicio_nombre,
          os.estado_orden_servicio_id,
          eos.codigo AS estado_codigo,
          eos.nombre AS estado_nombre,
          os.usuario_id
        FROM admin.orden_servicios os
        LEFT JOIN admin.tipo_servicio ts ON ts.tipo_servicio_id = os.tipo_servicio_id
        LEFT JOIN admin.estado_orden_servicio eos ON eos.estado_orden_servicio_id = os.estado_orden_servicio_id
        WHERE os.orden_trabajo_id = $1 AND (os.activo IS DISTINCT FROM false)
        ORDER BY os.orden_servicio_id ASC
      `;
      const evalServices = await query(serviceCheckSql, [ordenId]);
      const applicableServices = evalServices.filter((s: any) => s.estado_codigo !== "CANCELADO");

      // Rule 1: Transition RECIBIDA -> REPARACION (1 -> 5)
      if (newEstadoId === 5) {
        if (applicableServices.length === 0) {
          await query("ROLLBACK");
          return NextResponse.json({
            success: false,
            code: "NO_SERVICES",
            error: "Debes agregar al menos un servicio antes de iniciar la reparación.",
            message: "Debes agregar al menos un servicio antes de iniciar la reparación."
          }, { status: 409 });
        }
        const unassigned = applicableServices.filter((s: any) => !s.usuario_id);
        if (unassigned.length > 0) {
          await query("ROLLBACK");
          return NextResponse.json({
            success: false,
            code: "MISSING_MECHANIC",
            error: "Debes asignar un mecánico a todos los servicios antes de iniciar la reparación.",
            message: "Debes asignar un mecánico a todos los servicios antes de iniciar la reparación.",
            unassigned_services: unassigned
          }, { status: 409 });
        }
      }

      // Rule 2: Transition REPARACION -> LISTA_ENTREGA (5 -> 7)
      if (newEstadoId === 7) {
        if (applicableServices.length === 0) {
          await query("ROLLBACK");
          return NextResponse.json({
            success: false,
            code: "NO_SERVICES",
            error: "No puedes marcar la orden como lista para entrega porque existen servicios pendientes de finalizar.",
            message: "No puedes marcar la orden como lista para entrega porque existen servicios pendientes de finalizar."
          }, { status: 409 });
        }
        const incomplete = applicableServices.filter((s: any) => s.estado_codigo !== "COMPLETADO");
        if (incomplete.length > 0) {
          await query("ROLLBACK");
          return NextResponse.json({
            success: false,
            code: "SERVICES_NOT_COMPLETED",
            error: "No puedes marcar la orden como lista para entrega porque existen servicios pendientes de finalizar.",
            message: "No puedes marcar la orden como lista para entrega porque existen servicios pendientes de finalizar.",
            blockers: incomplete.map((s: any) => ({
              orden_servicio_id: s.orden_servicio_id,
              tipo_servicio_nombre: s.tipo_servicio_nombre || "Servicio",
              estado: s.estado_nombre || "Pendiente"
            }))
          }, { status: 409 });
        }
      }

      // Rule 3: Backward Transition LISTA_ENTREGA -> REPARACION (7 -> 5)
      if (current.estado_orden_id === 7 && newEstadoId === 5) {
        if (!observacion_cambio_estado || !observacion_cambio_estado.trim()) {
          await query("ROLLBACK");
          return NextResponse.json({
            success: false,
            code: "REASON_REQUIRED",
            error: "Debes proporcionar un motivo obligatorio para devolver la orden a reparación.",
            message: "Debes proporcionar un motivo obligatorio para devolver la orden a reparación."
          }, { status: 400 });
        }
      }
    }

    // Dynamic field updates
    const updateFields: string[] = [];
    const updateParams: any[] = [];

    updateParams.push(newEstadoId);
    updateFields.push(`estado_orden_id = $${updateParams.length}`);

    if (prioridad_id) {
      updateParams.push(parseInt(prioridad_id, 10));
      updateFields.push(`prioridad_orden_id = $${updateParams.length}`);
    }

    if (fecha_prometida) {
      updateParams.push(fecha_prometida);
      updateFields.push(`fecha_entrega_estimada = $${updateParams.length}`);
    }

    if (diagnostico_inicial !== undefined) {
      updateParams.push(diagnostico_inicial);
      updateFields.push(`diagnostico_inicial = $${updateParams.length}`);
    }

    if (observaciones !== undefined) {
      updateParams.push(observaciones);
      updateFields.push(`observacion_interna = $${updateParams.length}`);
    }

    // Transition timestamps
    if (newEstadoId === 5 && !current.fecha_inicio_trabajo) {
      updateFields.push(`fecha_inicio_trabajo = NOW()`);
    }

    if (newEstadoId === 7 && !current.fecha_finalizacion) {
      updateFields.push(`fecha_finalizacion = NOW()`);
    }

    if (newEstadoId === 8 && !current.fecha_entrega_real) {
      updateFields.push(`fecha_entrega_real = NOW()`);
    }

    updateParams.push(sessionUserId);
    updateFields.push(`fecha_actualizacion = NOW()`);
    updateFields.push(`usuario_actualizacion = $${updateParams.length}`);

    updateParams.push(ordenId);
    const updateSql = `
      UPDATE admin.ordenes_trabajo
      SET ${updateFields.join(", ")}
      WHERE orden_trabajo_id = $${updateParams.length}
    `;

    await query(updateSql, updateParams);

    // Insert History Record ONLY if order state actually changed
    if (newEstadoId !== current.estado_orden_id) {
      await query(`
        INSERT INTO admin.orden_historial_estado (
          orden_historial_estado_id,
          orden_trabajo_id,
          estado_anterior_id,
          estado_nuevo_id,
          usuario_cambio,
          comentario,
          fecha_cambio,
          activo,
          fecha_registro,
          usuario_registro
        ) VALUES (
          (SELECT COALESCE(MAX(orden_historial_estado_id), 0) + 1 FROM admin.orden_historial_estado),
          $1, $2, $3, $4, $5, NOW(), true, NOW(), $4
        )
      `, [
        ordenId,
        current.estado_orden_id,
        newEstadoId,
        sessionUserId,
        observacion_cambio_estado || `Cambio de estado a ${targetStatus.nombre}`
      ]);
    }

    await query("COMMIT");

    return NextResponse.json({
      success: true,
      data: {
        orden_id: ordenId,
        estado_anterior_id: current.estado_orden_id,
        estado_nuevo_id: newEstadoId,
        estado_nuevo_nombre: targetStatus.nombre
      },
      message: newEstadoId !== current.estado_orden_id
        ? `Orden de Trabajo movida exitosamente a ${targetStatus.nombre}.`
        : "Orden de Trabajo actualizada exitosamente."
    });
  } catch (err: any) {
    await query("ROLLBACK").catch(() => {});
    console.error("PUT /api/taller/ordenes/[id] Transaction Error:", err);
    return NextResponse.json({ error: "Error en la transacción al actualizar la orden de trabajo.", details: err.message }, { status: 500 });
  }
}
