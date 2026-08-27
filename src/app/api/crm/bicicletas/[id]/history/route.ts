import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

async function verifyBikeOwnership(bicicletaId: number, empresaId: number) {
  const rows = await query(`
    SELECT b.bicicleta_id
    FROM admin.bicicletas b
    JOIN admin.clientes c ON b.cliente_id = c.cliente_id
    WHERE b.bicicleta_id = $1 AND c.empresa_id = $2 AND b.fecha_eliminacion IS NULL
  `, [bicicletaId, empresaId]);
  return rows && rows.length > 0;
}

// GET /api/crm/bicicletas/[id]/history
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("BICICLETA", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para ver el historial técnico de bicicletas." }, { status: 403 });
    }

    const { id } = await context.params;
    const bicicletaId = parseInt(id, 10);

    if (isNaN(bicicletaId)) {
      return NextResponse.json({ error: "ID de bicicleta inválido." }, { status: 400 });
    }

    const isOwned = await verifyBikeOwnership(bicicletaId, session.empresa_id);
    if (!isOwned) {
      return NextResponse.json({ error: "Bicicleta no encontrada." }, { status: 404 });
    }

    // 1. Fetch work orders
    const parentOrders = await query(`
      SELECT 
        ot.orden_trabajo_id AS id,
        ot.orden_trabajo_id,
        ot.codigo_orden,
        ot.bicicleta_id,
        ot.bicicleta_componente_id,
        ot.nuevo_estado_componente_id,
        ot.es_mantenimiento_general,
        ot.salud_global_porcentaje,
        ot.kilometraje_ingreso,
        ot.fecha_recepcion AS fecha_servicio,
        ot.descripcion_cliente AS titulo_servicio,
        ot.diagnostico_inicial AS descripcion_trabajo,
        ot.observacion_interna,
        ot.total_orden AS costo_total,
        eot.nombre AS estado_nombre,
        eot.codigo AS tipo_servicio,
        pot.nombre AS prioridad_nombre,
        bc.marca AS componente_marca,
        bc.modelo AS componente_modelo,
        cc.nombre AS categoria_nombre,
        nest.nombre AS nuevo_estado_nombre,
        nest.codigo AS nuevo_estado_codigo,
        nest.nivel_desgaste AS nuevo_estado_desgaste
      FROM admin.ordenes_trabajo ot
      LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
      LEFT JOIN admin.prioridad_orden_trabajo pot ON ot.prioridad_orden_id = pot.prioridad_orden_trabajo_id
      LEFT JOIN admin.bicicleta_componentes bc ON ot.bicicleta_componente_id = bc.bicicleta_componente_id
      LEFT JOIN admin.categoria_componente cc ON bc.categoria_componente_id = cc.categoria_componente_id
      LEFT JOIN admin.estado_componente nest ON ot.nuevo_estado_componente_id = nest.estado_componente_id
      WHERE ot.bicicleta_id = $1 AND (ot.activo = true OR ot.activo IS NULL)
      ORDER BY ot.fecha_recepcion DESC, ot.orden_trabajo_id DESC
    `, [bicicletaId]);

    // 2. Fetch sub-services for all these work orders
    const orderIds = (parentOrders || []).map((o: any) => o.orden_trabajo_id);
    let subServicesMap: Record<number, any[]> = {};

    if (orderIds.length > 0) {
      const subServicesRows = await query(`
        SELECT 
          os.orden_servicio_id,
          os.orden_trabajo_id,
          os.secuencia,
          os.descripcion_servicio,
          os.precio_unitario AS costo,
          os.bicicleta_componente_id,
          os.nuevo_estado_componente_id,
          bc.marca AS componente_marca,
          bc.modelo AS componente_modelo,
          cc.nombre AS categoria_nombre,
          nest.nombre AS nuevo_estado_nombre,
          nest.codigo AS nuevo_estado_codigo,
          nest.nivel_desgaste AS nuevo_estado_desgaste
        FROM admin.orden_servicios os
        LEFT JOIN admin.bicicleta_componentes bc ON os.bicicleta_componente_id = bc.bicicleta_componente_id
        LEFT JOIN admin.categoria_componente cc ON bc.categoria_componente_id = cc.categoria_componente_id
        LEFT JOIN admin.estado_componente nest ON os.nuevo_estado_componente_id = nest.estado_componente_id
        WHERE os.orden_trabajo_id IN (${orderIds.join(',')}) AND (os.activo = true OR os.activo IS NULL)
        ORDER BY os.secuencia ASC, os.orden_servicio_id ASC
      `);

      for (const row of (subServicesRows || [])) {
        const otId = Number(row.orden_trabajo_id);
        if (!subServicesMap[otId]) subServicesMap[otId] = [];
        
        let componente_nombre = null;
        if (row.categoria_nombre || row.componente_marca || row.componente_modelo) {
          componente_nombre = [row.categoria_nombre, [row.componente_marca, row.componente_modelo].filter(Boolean).join(" ")].filter(Boolean).join(" — ");
        }

        subServicesMap[otId].push({
          id: row.orden_servicio_id,
          descripcion_servicio: row.descripcion_servicio,
          costo: Number(row.costo || 0),
          bicicleta_componente_id: row.bicicleta_componente_id ? Number(row.bicicleta_componente_id) : null,
          nuevo_estado_componente_id: row.nuevo_estado_componente_id ? Number(row.nuevo_estado_componente_id) : null,
          componente_nombre,
          nuevo_estado_nombre: row.nuevo_estado_nombre || null,
          nuevo_estado_codigo: row.nuevo_estado_codigo || null,
          nuevo_estado_desgaste: row.nuevo_estado_desgaste !== undefined && row.nuevo_estado_desgaste !== null ? Number(row.nuevo_estado_desgaste) : null
        });
      }
    }

    // 3. Map final result
    const mapped = (parentOrders || []).map((r: any) => {
      let componente_nombre = null;
      if (r.categoria_nombre || r.componente_marca || r.componente_modelo) {
        componente_nombre = [r.categoria_nombre, [r.componente_marca, r.componente_modelo].filter(Boolean).join(" ")].filter(Boolean).join(" — ");
      }

      const orderId = Number(r.orden_trabajo_id);
      const servicios = subServicesMap[orderId] || [];

      return {
        id: r.orden_trabajo_id,
        codigo_orden: r.codigo_orden,
        bicicleta_id: r.bicicleta_id,
        bicicleta_componente_id: r.bicicleta_componente_id ? Number(r.bicicleta_componente_id) : null,
        nuevo_estado_componente_id: r.nuevo_estado_componente_id ? Number(r.nuevo_estado_componente_id) : null,
        es_mantenimiento_general: r.es_mantenimiento_general === true,
        salud_global_porcentaje: r.salud_global_porcentaje !== null && r.salud_global_porcentaje !== undefined ? Number(r.salud_global_porcentaje) : 80,
        kilometraje_servicio: r.kilometraje_ingreso !== null && r.kilometraje_ingreso !== undefined ? Number(r.kilometraje_ingreso) : 0,
        fecha_servicio: r.fecha_servicio ? String(r.fecha_servicio).substring(0, 10) : null,
        titulo_servicio: r.codigo_orden ? `${r.codigo_orden} — ${r.titulo_servicio || 'Orden de Trabajo'}` : (r.titulo_servicio || "Servicio Técnico"),
        descripcion_trabajo: [r.descripcion_trabajo, r.observacion_interna].filter(Boolean).join(" | ") || r.titulo_servicio || "Atención en taller.",
        tipo_servicio: (r.tipo_servicio || "PREVENTIVO").toUpperCase(),
        estado_nombre: r.estado_nombre || "Recibida",
        costo_total: Number(r.costo_total || 0),
        mecanico_responsable: "Taller Central",
        componente_nombre,
        nuevo_estado_nombre: r.nuevo_estado_nombre || null,
        nuevo_estado_codigo: r.nuevo_estado_codigo || null,
        nuevo_estado_desgaste: r.nuevo_estado_desgaste !== undefined && r.nuevo_estado_desgaste !== null ? Number(r.nuevo_estado_desgaste) : null,
        servicios
      };
    });

    return NextResponse.json(mapped);

  } catch (error: any) {
    console.error("Error in GET /api/crm/bicicletas/[id]/history:", error);
    return NextResponse.json({ error: error.message || "Error al obtener historial técnico" }, { status: 500 });
  }
}

// POST /api/crm/bicicletas/[id]/history
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("BICICLETA", session.usuario_id);
    if (!perms.puede_crear && !perms.puede_editar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para registrar servicios técnicos en bicicletas." }, { status: 403 });
    }

    const { id } = await context.params;
    const bicicletaId = parseInt(id, 10);

    if (isNaN(bicicletaId)) {
      return NextResponse.json({ error: "ID de bicicleta inválido." }, { status: 400 });
    }

    const isOwned = await verifyBikeOwnership(bicicletaId, session.empresa_id);
    if (!isOwned) {
      return NextResponse.json({ error: "Bicicleta no encontrada o no pertenece a su empresa." }, { status: 404 });
    }

    const body = await req.json();
    const modo_registro = body.modo_registro || "ESPECIFICO";
    const es_mantenimiento_general = modo_registro === "GENERAL_MULTI" || Boolean(body.es_mantenimiento_general);
    const titulo_servicio = (body.titulo_servicio || '').trim();
    const descripcion_trabajo = (body.descripcion_trabajo || '').trim();
    const kilometraje_servicio = body.kilometraje_servicio ? parseInt(body.kilometraje_servicio, 10) : 0;
    const costo_total = body.costo_total ? parseFloat(body.costo_total) : 0;
    const bicicleta_componente_id = body.bicicleta_componente_id ? parseInt(body.bicicleta_componente_id, 10) : null;
    const nuevo_estado_componente_id = body.nuevo_estado_componente_id ? parseInt(body.nuevo_estado_componente_id, 10) : null;
    const subServicios = Array.isArray(body.servicios) ? body.servicios : [];

    if (!titulo_servicio) {
      return NextResponse.json({ error: "El título o descripción del servicio es obligatorio." }, { status: 400 });
    }

    // Get bike owner
    const bikeRows = await query(`SELECT cliente_id, kilometraje_actual FROM admin.bicicletas WHERE bicicleta_id = $1`, [bicicletaId]);
    const clienteId = bikeRows?.[0]?.cliente_id || null;
    const currentKm = kilometraje_servicio || bikeRows?.[0]?.kilometraje_actual || 0;

    const countRows = await query(`SELECT COUNT(*) AS total FROM admin.ordenes_trabajo`);
    const nextSeq = parseInt(countRows?.[0]?.total || "0", 10) + 1;
    const codigo_orden = `OT-2026-${String(nextSeq).padStart(6, '0')}`;

    // Single Component Mode -> Update single component
    if (modo_registro === "ESPECIFICO" && bicicleta_componente_id && nuevo_estado_componente_id) {
      await query(`
        UPDATE admin.bicicleta_componentes
        SET estado_componente_id = $2::integer, fecha_modificacion = NOW()
        WHERE bicicleta_componente_id = $1::integer AND bicicleta_id = $3::integer
      `, [bicicleta_componente_id, nuevo_estado_componente_id, bicicletaId]);
    } 
    // Multi-Component Mode -> Update components
    else if (modo_registro === "GENERAL_MULTI" && subServicios.length > 0) {
      for (const item of subServicios) {
        const compId = item.bicicleta_componente_id ? parseInt(item.bicicleta_componente_id, 10) : null;
        const stateId = item.nuevo_estado_componente_id ? parseInt(item.nuevo_estado_componente_id, 10) : null;
        if (compId && stateId) {
          await query(`
            UPDATE admin.bicicleta_componentes
            SET estado_componente_id = $2::integer, fecha_modificacion = NOW()
            WHERE bicicleta_componente_id = $1::integer AND bicicleta_id = $3::integer
          `, [compId, stateId, bicicletaId]);
        }
      }
    }

    // Calculate current remaining health of bike post-service
    const healthRows = await query(`
      SELECT ROUND(AVG(100 - COALESCE(est.nivel_desgaste, 0))) AS salud
      FROM admin.bicicleta_componentes bc
      LEFT JOIN admin.estado_componente est ON bc.estado_componente_id = est.estado_componente_id
      WHERE bc.bicicleta_id = $1 AND (bc.activo = true OR bc.activo IS NULL) AND bc.fecha_eliminacion IS NULL
    `, [bicicletaId]);

    const calculatedHealth = healthRows?.[0]?.salud !== null && healthRows?.[0]?.salud !== undefined 
      ? Math.round(Number(healthRows[0].salud)) 
      : 80;

    // Insert Parent Work Order
    const sql = `
      INSERT INTO admin.ordenes_trabajo (
        orden_trabajo_id, codigo_orden, recepcion_id, cliente_id, bicicleta_id,
        bicicleta_componente_id, nuevo_estado_componente_id, es_mantenimiento_general, salud_global_porcentaje, kilometraje_ingreso,
        estado_orden_id, prioridad_orden_id, descripcion_cliente, diagnostico_inicial,
        total_orden, fecha_recepcion, activo, fecha_registro
      ) VALUES (
        (SELECT COALESCE(MAX(orden_trabajo_id), 0) + 1 FROM admin.ordenes_trabajo),
        $1, 1, $2::integer, $3::integer,
        $4::integer, $5::integer, $6::boolean, $7::integer, $8::integer,
        1, 1, $9, $10,
        $11::numeric, NOW(), true, NOW()
      )
      RETURNING *
    `;

    const result = await query(sql, [
      codigo_orden,
      clienteId,
      bicicletaId,
      modo_registro === "ESPECIFICO" ? bicicleta_componente_id : null,
      modo_registro === "ESPECIFICO" ? nuevo_estado_componente_id : null,
      es_mantenimiento_general,
      calculatedHealth,
      currentKm,
      titulo_servicio,
      descripcion_trabajo || null,
      costo_total
    ]);

    const createdOrder = result[0];
    const ordenTrabajoId = createdOrder.orden_trabajo_id;

    if (modo_registro === "ESPECIFICO" && bicicleta_componente_id && nuevo_estado_componente_id) {
      await query(`
        INSERT INTO admin.orden_servicios (
          orden_servicio_id, orden_trabajo_id, tipo_servicio_id, estado_orden_servicio_id,
          secuencia, descripcion_servicio, cantidad, precio_unitario, subtotal,
          bicicleta_componente_id, nuevo_estado_componente_id, activo, fecha_registro
        ) VALUES (
          (SELECT COALESCE(MAX(orden_servicio_id), 0) + 1 FROM admin.orden_servicios),
          $1::integer, 1, 1, 1, $2, 1, $3::numeric, $3::numeric,
          $4::integer, $5::integer, true, NOW()
        )
      `, [
        ordenTrabajoId,
        titulo_servicio,
        costo_total,
        bicicleta_componente_id,
        nuevo_estado_componente_id
      ]);
    } else if (modo_registro === "GENERAL_MULTI" && subServicios.length > 0) {
      let seq = 1;
      for (const item of subServicios) {
        const desc = (item.descripcion_servicio || '').trim();
        const compId = item.bicicleta_componente_id ? parseInt(item.bicicleta_componente_id, 10) : null;
        const stateId = item.nuevo_estado_componente_id ? parseInt(item.nuevo_estado_componente_id, 10) : null;
        const itemCosto = item.costo ? parseFloat(item.costo) : 0;

        if (desc || compId) {
          await query(`
            INSERT INTO admin.orden_servicios (
              orden_servicio_id, orden_trabajo_id, tipo_servicio_id, estado_orden_servicio_id,
              secuencia, descripcion_servicio, cantidad, precio_unitario, subtotal,
              bicicleta_componente_id, nuevo_estado_componente_id, activo, fecha_registro
            ) VALUES (
              (SELECT COALESCE(MAX(orden_servicio_id), 0) + 1 FROM admin.orden_servicios),
              $1::integer, 1, 1, $2::integer, $3, 1, $4::numeric, $4::numeric,
              $5::integer, $6::integer, true, NOW()
            )
          `, [ordenTrabajoId, seq++, desc || "Servicio Técnico", itemCosto, compId, stateId]);
        }
      }
    }

    // Update last revision date & mileage on bike
    await query(`
      UPDATE admin.bicicletas
      SET 
        fecha_ultima_revision = NOW()::date,
        kilometraje_actual = GREATEST(COALESCE(kilometraje_actual, 0), $2::integer)
      WHERE bicicleta_id = $1::integer
    `, [bicicletaId, currentKm]);

    return NextResponse.json(createdOrder);

  } catch (error: any) {
    console.error("Error in POST /api/crm/bicicletas/[id]/history:", error);
    return NextResponse.json({ error: error.message || "Error al registrar orden de trabajo" }, { status: 500 });
  }
}

// DELETE /api/crm/bicicletas/[id]/history
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("BICICLETA", session.usuario_id);
    if (!perms.puede_eliminar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para eliminar órdenes de trabajo." }, { status: 403 });
    }

    const { id } = await context.params;
    const bicicletaId = parseInt(id, 10);
    const { searchParams } = new URL(req.url);
    const historyIdParam = searchParams.get("historyId");

    if (isNaN(bicicletaId) || !historyIdParam) {
      return NextResponse.json({ error: "ID de bicicleta u orden inválido." }, { status: 400 });
    }

    const isOwned = await verifyBikeOwnership(bicicletaId, session.empresa_id);
    if (!isOwned) {
      return NextResponse.json({ error: "Bicicleta no encontrada o no pertenece a su empresa." }, { status: 404 });
    }

    const ordenId = parseInt(historyIdParam, 10);

    // Delete sub-services first
    await query(`DELETE FROM admin.orden_servicios WHERE orden_trabajo_id = $1`, [ordenId]);

    // Delete parent work order
    await query(`
      DELETE FROM admin.ordenes_trabajo
      WHERE orden_trabajo_id = $1 AND bicicleta_id = $2
    `, [ordenId, bicicletaId]);

    return NextResponse.json({ message: "Orden de trabajo eliminada correctamente." });

  } catch (error: any) {
    console.error("Error in DELETE /api/crm/bicicletas/[id]/history:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
