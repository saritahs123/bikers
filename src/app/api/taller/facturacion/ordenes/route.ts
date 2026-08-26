import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// GET /api/taller/facturacion/ordenes
export async function GET(req: NextRequest) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "NO_SESSION", message: "No hay sesión activa." }, { status: 401 });
    }

    const empresaId = session.empresa_id;
    if (!empresaId) {
      return NextResponse.json({ error: "FORBIDDEN_COMPANY", message: "No se pudo determinar la empresa del usuario." }, { status: 403 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso de lectura para acceder a facturación." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const estadoId = searchParams.get("estado_id") || "";
    const prioridadId = searchParams.get("prioridad_id") || "";
    const facturadoFilter = searchParams.get("facturado"); // 'true' | 'false' | null
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const queryParams: any[] = [empresaId];
    const whereConditions: string[] = [
      `u_ot.empresa_id = $1`,
      `ot.activo = true`
    ];

    if (search) {
      queryParams.push(`%${search}%`);
      const idx = queryParams.length;
      whereConditions.push(`(
        ot.codigo_orden ILIKE $${idx} OR
        ot.orden_trabajo_id::text ILIKE $${idx} OR
        r.codigo_recepcion ILIKE $${idx} OR
        r.recepcion_id::text ILIKE $${idx} OR
        c.nombre ILIKE $${idx} OR
        c.apellido ILIKE $${idx} OR
        c.nombre_completo ILIKE $${idx} OR
        c.identificacion ILIKE $${idx} OR
        c.telefono_principal ILIKE $${idx} OR
        b.marca ILIKE $${idx} OR
        b.modelo ILIKE $${idx} OR
        b.numero_serie_cuadro ILIKE $${idx} OR
        b.codigo_qr ILIKE $${idx}
      )`);
    }

    if (estadoId) {
      queryParams.push(parseInt(estadoId, 10));
      whereConditions.push(`ot.estado_orden_id = $${queryParams.length}`);
    }

    if (prioridadId) {
      queryParams.push(parseInt(prioridadId, 10));
      whereConditions.push(`ot.prioridad_orden_id = $${queryParams.length}`);
    }

    if (facturadoFilter === "true") {
      whereConditions.push(`ot.facturado = true`);
    } else if (facturadoFilter === "false") {
      whereConditions.push(`(ot.facturado = false OR ot.facturado IS NULL)`);
    }

    const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

    const sql = `
      SELECT 
        ot.orden_trabajo_id AS orden_id,
        ot.orden_trabajo_id,
        ot.codigo_orden,
        ot.recepcion_id,
        r.codigo_recepcion,
        ot.estado_orden_id,
        eot.nombre AS estado_nombre,
        eot.codigo AS estado_codigo,
        eot.orden_visual AS estado_orden,
        ot.prioridad_orden_id AS prioridad_id,
        pot.nombre AS prioridad_nombre,
        pot.color_estado AS prioridad_color,
        ot.fecha_recepcion AS fecha_ingreso,
        ot.fecha_entrega_estimada AS fecha_prometida,
        ot.fecha_entrega_real AS fecha_entrega,
        COALESCE(ot.facturado, false) AS facturado,
        ot.fecha_facturacion,
        ot.usuario_facturacion_id,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui_fact.nombre, ui_fact.apellido)), ''), uf.estado, ('Usuario #' || uf.usuario_id::text)) AS usuario_facturacion_nombre,
        COALESCE(c.cliente_id, r.cliente_id) AS cliente_id,
        COALESCE(c.nombre_completo, 'Cliente General') AS cliente_nombre,
        c.identificacion AS cliente_identificacion,
        c.telefono_principal AS cliente_telefono,
        c.correo AS cliente_correo,
        COALESCE(b.bicicleta_id, r.bicicleta_id) AS bicicleta_id,
        COALESCE(b.marca, 'Bicicleta') AS bicicleta_marca,
        COALESCE(b.modelo, 'Sin Modelo') AS bicicleta_modelo,
        b.ano AS bicicleta_ano,
        b.color AS bicicleta_color,
        b.numero_serie_cuadro AS bicicleta_serie,
        b.codigo_qr AS bicicleta_qr,
        COALESCE(ot.total_orden, ot.subtotal_general, 0) AS total_orden,
        COALESCE(ot.subtotal_servicios, 0) AS subtotal_servicios,
        COALESCE(ot.subtotal_productos, 0) AS subtotal_repuestos,
        COALESCE(ot.descuento_servicios, 0) + COALESCE(ot.descuento_productos, 0) AS descuento_total,
        COALESCE(ot.impuesto, 0) AS impuesto,
        (SELECT COUNT(*) FROM admin.orden_servicios WHERE orden_trabajo_id = ot.orden_trabajo_id AND (activo IS DISTINCT FROM false)) AS total_servicios,
        (SELECT COUNT(*) FROM admin.orden_productos WHERE orden_trabajo_id = ot.orden_trabajo_id) AS total_repuestos,
        (
          SELECT COUNT(*)::int
          FROM admin.orden_servicios os_sub
          LEFT JOIN admin.estado_orden_servicio eos_sub ON os_sub.estado_orden_servicio_id = eos_sub.estado_orden_servicio_id
          WHERE os_sub.orden_trabajo_id = ot.orden_trabajo_id
            AND (os_sub.activo IS DISTINCT FROM false)
            AND (eos_sub.codigo NOT IN ('COMPLETADO', 'FINALIZADO', 'CANCELADO', 'ANULADO') OR os_sub.estado_orden_servicio_id IN (1, 2))
        ) AS servicios_incompletos_count,
        (
          SELECT COUNT(*)::int
          FROM admin.orden_servicio_mano_obra mo_sub
          JOIN admin.orden_servicios os_mo ON os_mo.orden_servicio_id = mo_sub.orden_servicio_id
          WHERE os_mo.orden_trabajo_id = ot.orden_trabajo_id
            AND (mo_sub.activo IS DISTINCT FROM false)
            AND mo_sub.fecha_finalizacion IS NULL
        ) AS cronometros_abiertos_count
      FROM admin.ordenes_trabajo ot
      JOIN admin.usuario u_ot ON u_ot.usuario_id = ot.usuario_registro
      LEFT JOIN admin.usuario uf ON uf.usuario_id = ot.usuario_facturacion_id
      LEFT JOIN admin.usuario_identidad ui_fact ON ui_fact.usuario_id = uf.usuario_id
      LEFT JOIN admin.recepciones r ON ot.recepcion_id = r.recepcion_id
      LEFT JOIN admin.clientes c ON COALESCE(ot.cliente_id, r.cliente_id) = c.cliente_id
      LEFT JOIN admin.bicicletas b ON COALESCE(ot.bicicleta_id, r.bicicleta_id) = b.bicicleta_id
      LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
      LEFT JOIN admin.prioridad_orden_trabajo pot ON ot.prioridad_orden_id = pot.prioridad_orden_trabajo_id
      ${whereClause}
      ORDER BY ot.orden_trabajo_id DESC
      LIMIT $${queryParams.length + 1}
    `;

    const rawItems = await query(sql, [...queryParams, limit]);

    // Calculate business rules for invoicing per item
    const items = (rawItems || []).map((r: any) => {
      const isFacturado = Boolean(r.facturado);
      const estadoId = Number(r.estado_orden_id);
      const totalAmount = parseFloat(r.total_orden || "0");
      const incompleteCount = Number(r.servicios_incompletos_count || 0);
      const openTimersCount = Number(r.cronometros_abiertos_count || 0);

      let puede_facturarse = false;
      let motivo_no_facturable: string | null = null;

      if (isFacturado) {
        puede_facturarse = false;
        motivo_no_facturable = "Esta orden ya fue facturada.";
      } else if (estadoId !== 7 && estadoId !== 8) {
        puede_facturarse = false;
        motivo_no_facturable = "La orden debe estar lista para entrega o entregada antes de facturarla.";
      } else if (incompleteCount > 0) {
        puede_facturarse = false;
        motivo_no_facturable = "Debes completar todos los servicios antes de facturar la orden.";
      } else if (openTimersCount > 0) {
        puede_facturarse = false;
        motivo_no_facturable = "No se puede facturar una orden con cronómetros activos.";
      } else if (totalAmount <= 0) {
        puede_facturarse = false;
        motivo_no_facturable = "El total de la orden debe ser mayor que cero para facturarla.";
      } else {
        puede_facturarse = true;
        motivo_no_facturable = null;
      }

      return {
        ...r,
        facturado: isFacturado,
        fecha_facturacion: r.fecha_facturacion ? String(r.fecha_facturacion) : null,
        usuario_facturacion_id: isFacturado ? r.usuario_facturacion_id : null,
        usuario_facturacion_nombre: isFacturado ? r.usuario_facturacion_nombre : null,
        puede_facturarse,
        motivo_no_facturable
      };
    });

    const operationalEstados = [
      { estado_orden_id: 1, codigo: "RECIBIDA", nombre: "Recibida", color_estado: "#38BDF8" },
      { estado_orden_id: 5, codigo: "REPARACION", nombre: "En Reparación", color_estado: "#F59E0B" },
      { estado_orden_id: 7, codigo: "LISTA_ENTREGA", nombre: "Lista para Entrega", color_estado: "#10B981" },
      { estado_orden_id: 8, codigo: "ENTREGADA", nombre: "Entregada", color_estado: "#64748B" }
    ];

    const prioridades = await query(
      `SELECT prioridad_orden_trabajo_id AS prioridad_id, nombre, codigo, color_estado AS color_hex 
       FROM admin.prioridad_orden_trabajo 
       WHERE activo = true 
       ORDER BY prioridad_orden_trabajo_id ASC`
    );

    return NextResponse.json({
      success: true,
      data: items,
      meta: {
        total: items.length,
        search
      },
      catalogs: {
        estados: operationalEstados,
        prioridades: prioridades || []
      }
    });
  } catch (error: any) {
    console.error("Error in GET /api/taller/facturacion/ordenes:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: error.message }, { status: 500 });
  }
}

// Disallow mutating methods directly on collection
export async function POST() {
  return NextResponse.json({ error: "METHOD_NOT_ALLOWED", message: "Operación no permitida en el módulo de facturación." }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: "METHOD_NOT_ALLOWED", message: "Operación no permitida en el módulo de facturación." }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: "METHOD_NOT_ALLOWED", message: "Operación no permitida en el módulo de facturación." }, { status: 405 });
}
