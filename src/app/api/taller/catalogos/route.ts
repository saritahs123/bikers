import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export async function GET() {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "NO_SESSION", message: "No hay sesión activa." }, { status: 401 });
    }

    // Check Módulo 5 (RECEPCIÓN) puede_ver permission
    const perms = await getModulePermissions(5, session.rol_principal_id);
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

    return NextResponse.json({
      success: true,
      data: {
        estados_recepcion: estadosRecepcion || [],
        items_checklist: itemsChecklist || [],
        estados_checklist: estadosChecklist || [],
        tipos_servicio: tiposServicio || []
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
