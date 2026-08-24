import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export async function GET() {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "NO_SESSION", message: "No hay sesión activa." }, { status: 401 });
    }

    // Check Módulo TALLER puede_ver permission
    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso de lectura para acceder a los catálogos de recepción." }, { status: 403 });
    }

    const estadosRecepcion = await query(
      `SELECT estado_recepcion_id, codigo, nombre, descripcion FROM admin.estado_recepcion WHERE activo = true ORDER BY orden_visual ASC`
    );
    const itemsChecklist = await query(
      `SELECT item_checklist_id, codigo, nombre, descripcion, categoria, requiere_foto, permite_observacion FROM admin.item_checklist_recepcion WHERE activo = true ORDER BY orden_visual ASC`
    );
    const estadosChecklist = await query(
      `SELECT estado_checklist_id, codigo, nombre, descripcion, nivel_alerta, requiere_accion FROM admin.estado_checklist WHERE activo = true ORDER BY orden_visual ASC`
    );
    const tiposServicio = await query(
      `SELECT tipo_servicio_id, codigo, nombre, descripcion, duracion_estimada_horas, precio_base FROM admin.tipo_servicio WHERE activo = true ORDER BY orden_visual ASC`
    );
    const productos = await query(
      `SELECT p.producto_id,
              p.codigo_producto AS codigo,
              p.nombre,
              p.precio_venta,
              um.codigo AS unidad_medida,
              COALESCE(SUM(ep.cantidad_actual), 0)::numeric AS stock_disponible
       FROM admin.productos p
       LEFT JOIN admin.unidad_medida um ON p.unidad_medida_id = um.unidad_medida_id
       LEFT JOIN admin.existencias_producto ep ON p.producto_id = ep.producto_id
       WHERE (p.estado = 'ACTIVO' OR p.estado IS NULL)
       GROUP BY p.producto_id, p.codigo_producto, p.nombre, p.precio_venta, um.codigo
       ORDER BY p.nombre ASC`
    );
    const estadosServicio = await query(
      `SELECT estado_orden_servicio_id, codigo, nombre, descripcion FROM admin.estado_orden_servicio WHERE (activo = true OR activo IS NULL) ORDER BY estado_orden_servicio_id ASC`
    );
    const estadosOrdenTrabajo = await query(
      `SELECT estado_orden_id, codigo, nombre, descripcion FROM admin.estado_orden_trabajo WHERE activo = true ORDER BY orden_visual ASC`
    );
    const prioridades = await query(
      `SELECT prioridad_orden_trabajo_id AS prioridad_id, codigo, nombre FROM admin.prioridad_orden_trabajo WHERE activo = true ORDER BY prioridad_orden_trabajo_id ASC`
    );
    const mecanicos = await query(
      `SELECT u.usuario_id,
              COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), ui.correo_electronico, ('Mecánico #' || u.usuario_id::text)) AS nombre_completo
       FROM admin.usuario u
       LEFT JOIN admin.tipo_usuario tu ON tu.tipo_usuario_id = u.tipo_usuario_id
       LEFT JOIN admin.usuario_identidad ui ON ui.usuario_id = u.usuario_id
       WHERE (tu.codigo = 'MECANICO' OR u.tipo_usuario_id = 2) AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
       ORDER BY ui.nombre, ui.apellido, u.usuario_id`
    );
    const estadosComponente = await query(
      `SELECT estado_componente_id, codigo, nombre, nivel_desgaste, requiere_revision
       FROM admin.estado_componente
       WHERE activo = true
       ORDER BY orden_visual ASC, estado_componente_id ASC`
    );
    const categoriasComponente = await query(
      `SELECT categoria_componente_id, codigo, nombre, descripcion
       FROM admin.categoria_componente
       WHERE activo = true
       ORDER BY orden_visual ASC, nombre ASC`
    );

    return NextResponse.json({
      success: true,
      productos: productos || [],
      estados_servicio: estadosServicio || [],
      estados_orden_trabajo: estadosOrdenTrabajo || [],
      prioridades: prioridades || [],
      mecanicos: mecanicos || [],
      estados_componente: estadosComponente || [],
      categorias_componente: categoriasComponente || [],
      data: {
        estados_recepcion: estadosRecepcion || [],
        items_checklist: itemsChecklist || [],
        estados_checklist: estadosChecklist || [],
        tipos_servicio: tiposServicio || [],
        productos: productos || [],
        estados_servicio: estadosServicio || [],
        estados_orden_trabajo: estadosOrdenTrabajo || [],
        prioridades: prioridades || [],
        mecanicos: mecanicos || [],
        estados_componente: estadosComponente || [],
        categorias_componente: categoriasComponente || []
      }
    });
  } catch (error: any) {
    console.error("Error in GET /api/taller/catalogos:", error);
    const safeMessage = (error?.message && !error.message.includes("Position:") && !error.message.includes("SQLState"))
      ? error.message
      : "No fue posible cargar los catálogos de taller. Inténtalo nuevamente.";
    return NextResponse.json({ error: safeMessage, message: safeMessage }, { status: 500 });
  }
}
