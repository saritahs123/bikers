import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { recordUserAudit } from "@/lib/auditLogger";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface NivelClienteRow {
  nivel_cliente_id: number;
  nombre: string;
  porciento_descuento: number | string;
  descripcion: string | null;
  activo: boolean;
  fecha_creacion: string | Date;
}

// GET /api/crm/niveles-cliente/[id]
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const nivelId = parseInt(id, 10);
    if (isNaN(nivelId) || nivelId <= 0) {
      return NextResponse.json(
        { error: "INVALID_ID", message: "ID de nivel de cliente no válido." },
        { status: 400 }
      );
    }

    const rows = await query<NivelClienteRow>(
      `SELECT * FROM admin.nivel_cliente WHERE nivel_cliente_id = $1`,
      [nivelId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Nivel de cliente no encontrado." },
        { status: 404 }
      );
    }

    const r = rows[0];
    return NextResponse.json({
      success: true,
      data: {
        nivel_cliente_id: Number(r.nivel_cliente_id),
        id: Number(r.nivel_cliente_id),
        nombre: r.nombre,
        porciento_descuento: Number(r.porciento_descuento),
        descripcion: r.descripcion || "",
        activo: Boolean(r.activo),
        fecha_creacion: r.fecha_creacion
      }
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error en GET /api/crm/niveles-cliente/[id]:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: `Error al obtener nivel de cliente: ${msg}` },
      { status: 500 }
    );
  }
}

// PUT /api/crm/niveles-cliente/[id]
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const perms = await getModulePermissions("CRM", session.usuario_id);
    if (!perms.puede_editar) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permisos para editar niveles de clientes." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const nivelId = parseInt(id, 10);
    if (isNaN(nivelId) || nivelId <= 0) {
      return NextResponse.json(
        { error: "INVALID_ID", message: "ID de nivel de cliente no válido." },
        { status: 400 }
      );
    }

    const beforeRows = await query<NivelClienteRow>(
      `SELECT * FROM admin.nivel_cliente WHERE nivel_cliente_id = $1`,
      [nivelId]
    );

    if (!beforeRows || beforeRows.length === 0) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Nivel de cliente no encontrado." },
        { status: 404 }
      );
    }

    const before = beforeRows[0];
    const body = await request.json();

    const nombre = (body.nombre !== undefined ? body.nombre : before.nombre).trim();
    const rawPorciento = body.porciento_descuento !== undefined ? body.porciento_descuento : before.porciento_descuento;
    const porciento_descuento = Number(rawPorciento);
    const descripcion = body.descripcion !== undefined ? (body.descripcion || "").trim() : before.descripcion;
    const activo = body.activo !== undefined ? Boolean(body.activo) : before.activo;

    // Validaciones
    if (!nombre) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "El nombre del nivel es obligatorio.", field: "nombre" },
        { status: 400 }
      );
    }

    if (nombre.length < 2 || nombre.length > 100) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "El nombre debe tener entre 2 y 100 caracteres.", field: "nombre" },
        { status: 400 }
      );
    }

    if (isNaN(porciento_descuento) || porciento_descuento < 0 || porciento_descuento > 100) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "El porcentaje de descuento debe estar entre 0 y 100.", field: "porciento_descuento" },
        { status: 400 }
      );
    }

    // Validar duplicado por nombre en otro registro
    const existing = await query<{ nivel_cliente_id: number }>(
      `SELECT nivel_cliente_id FROM admin.nivel_cliente WHERE UPPER(nombre) = UPPER($1) AND nivel_cliente_id <> $2`,
      [nombre, nivelId]
    );

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "DUPLICATE_NAME", message: `Ya existe otro nivel con el nombre "${nombre}".`, field: "nombre" },
        { status: 409 }
      );
    }

    const updateSql = `
      UPDATE admin.nivel_cliente
      SET nombre = $1,
          porciento_descuento = $2,
          descripcion = $3,
          activo = $4
      WHERE nivel_cliente_id = $5
      RETURNING *;
    `;

    const res = await query<NivelClienteRow>(updateSql, [
      nombre,
      porciento_descuento,
      descripcion || null,
      activo,
      nivelId
    ]);

    const updated = res[0];

    // Registro de auditoría
    await recordUserAudit({
      userId: session.usuario_id,
      adminId: session.usuario_id,
      accion: "CRM_NIVEL_CLIENTE_ACTUALIZADO",
      valorAnterior: {
        nombre: before.nombre,
        porciento_descuento: Number(before.porciento_descuento),
        descripcion: before.descripcion,
        activo: before.activo
      },
      valorNuevo: {
        nombre,
        porciento_descuento,
        descripcion,
        activo
      },
      motivo: `Actualización de nivel de cliente ${nombre}`,
      req: request
    });

    return NextResponse.json({
      success: true,
      message: "Nivel de cliente actualizado correctamente.",
      data: {
        nivel_cliente_id: Number(updated.nivel_cliente_id),
        id: Number(updated.nivel_cliente_id),
        nombre: updated.nombre,
        porciento_descuento: Number(updated.porciento_descuento),
        descripcion: updated.descripcion || "",
        activo: Boolean(updated.activo),
        fecha_creacion: updated.fecha_creacion
      }
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error en PUT /api/crm/niveles-cliente/[id]:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: `Error al actualizar nivel de cliente: ${msg}` },
      { status: 500 }
    );
  }
}

// DELETE /api/crm/niveles-cliente/[id]
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const perms = await getModulePermissions("CRM", session.usuario_id);
    if (!perms.puede_eliminar) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permisos para eliminar niveles de clientes." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const nivelId = parseInt(id, 10);
    if (isNaN(nivelId) || nivelId <= 0) {
      return NextResponse.json(
        { error: "INVALID_ID", message: "ID de nivel de cliente no válido." },
        { status: 400 }
      );
    }

    // Verificar si el nivel existe
    const beforeRes = await query<NivelClienteRow>(
      `SELECT * FROM admin.nivel_cliente WHERE nivel_cliente_id = $1`,
      [nivelId]
    );
    if (!beforeRes || beforeRes.length === 0) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Nivel de cliente no encontrado." },
        { status: 404 }
      );
    }
    const before = beforeRes[0];

    // Verificar si hay clientes vinculados
    const clientCountRes = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM admin.clientes WHERE nivel_cliente_id = $1 AND fecha_eliminacion IS NULL`,
      [nivelId]
    );

    const clientCount = Number(clientCountRes[0]?.count || 0);
    if (clientCount > 0) {
      // Si tiene clientes, no se permite eliminar físicamente; se desactiva
      await query(`UPDATE admin.nivel_cliente SET activo = false WHERE nivel_cliente_id = $1`, [nivelId]);
      return NextResponse.json({
        success: true,
        message: `El nivel está asignado a ${clientCount} cliente(s) y no puede eliminarse. Se ha desactivado automáticamente.`
      });
    }

    await query(`DELETE FROM admin.nivel_cliente WHERE nivel_cliente_id = $1`, [nivelId]);

    await recordUserAudit({
      userId: session.usuario_id,
      adminId: session.usuario_id,
      accion: "CRM_NIVEL_CLIENTE_ELIMINADO",
      valorAnterior: { nivel_cliente_id: nivelId, nombre: before.nombre },
      motivo: `Eliminación de nivel de cliente ${before.nombre}`,
      req: request
    });

    return NextResponse.json({
      success: true,
      message: "Nivel de cliente eliminado correctamente."
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error en DELETE /api/crm/niveles-cliente/[id]:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: `Error al eliminar nivel de cliente: ${msg}` },
      { status: 500 }
    );
  }
}
