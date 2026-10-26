import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { recordUserAudit } from "@/lib/auditLogger";

export const dynamic = "force-dynamic";

interface NivelClienteRow {
  nivel_cliente_id: number;
  nombre: string;
  descuento_servicio: number | string;
  descuento_producto: number | string;
  porciento_descuento?: number | string;
  descripcion: string | null;
  activo: boolean;
  fecha_creacion: string | Date;
  clientes_count?: number | string;
}

// GET /api/crm/niveles-cliente
export async function GET(request: NextRequest) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const perms = await getModulePermissions("CRM", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permisos para consultar niveles de cliente." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const soloActivos = searchParams.get("activos") === "true";

    const whereClause = soloActivos ? "WHERE nc.activo = true" : "";

    const sql = `
      SELECT 
        nc.nivel_cliente_id,
        nc.nombre,
        nc.descuento_servicio::numeric(5,2) AS descuento_servicio,
        nc.descuento_producto::numeric(5,2) AS descuento_producto,
        nc.descripcion,
        nc.activo,
        nc.fecha_creacion,
        COUNT(c.cliente_id)::int AS clientes_count
      FROM admin.nivel_cliente nc
      LEFT JOIN admin.clientes c ON nc.nivel_cliente_id = c.nivel_cliente_id AND c.fecha_eliminacion IS NULL
      ${whereClause}
      GROUP BY nc.nivel_cliente_id, nc.nombre, nc.descuento_servicio, nc.descuento_producto, nc.descripcion, nc.activo, nc.fecha_creacion
      ORDER BY nc.descuento_servicio DESC, nc.descuento_producto DESC, nc.nivel_cliente_id ASC;
    `;

    const rows = await query<NivelClienteRow>(sql);

    const formatted = (rows || []).map((r) => ({
      nivel_cliente_id: Number(r.nivel_cliente_id),
      id: Number(r.nivel_cliente_id),
      nombre: String(r.nombre),
      descuento_servicio: Number(r.descuento_servicio || 0),
      descuento_producto: Number(r.descuento_producto || 0),
      porciento_descuento: Number(r.descuento_servicio || 0),
      descripcion: r.descripcion || "",
      activo: Boolean(r.activo),
      fecha_creacion: r.fecha_creacion,
      clientes_count: Number(r.clientes_count || 0)
    }));

    return NextResponse.json(
      {
        success: true,
        data: formatted
      },
      {
        headers: {
          "x-perm-ver": String(perms.puede_ver),
          "x-perm-crear": String(perms.puede_crear),
          "x-perm-editar": String(perms.puede_editar),
          "x-perm-eliminar": String(perms.puede_eliminar),
          "x-perm-exportar": String(perms.puede_exportar)
        }
      }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error en GET /api/crm/niveles-cliente:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: `Error al obtener niveles de clientes: ${msg}` },
      { status: 500 }
    );
  }
}

// POST /api/crm/niveles-cliente
export async function POST(request: NextRequest) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const perms = await getModulePermissions("CRM", session.usuario_id);
    if (!perms.puede_crear && !perms.puede_editar) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permisos para crear niveles de clientes." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const nombre = (body.nombre || "").trim();

    // Permitir descuento_servicio y descuento_producto; si viene porciento_descuento usarlo como fallback
    const rawServicio = body.descuento_servicio !== undefined ? body.descuento_servicio : body.porciento_descuento;
    const rawProducto = body.descuento_producto !== undefined ? body.descuento_producto : body.porciento_descuento;
    const descuento_servicio = Number(rawServicio);
    const descuento_producto = Number(rawProducto);
    const descripcion = (body.descripcion || "").trim();
    const activo = body.activo !== undefined ? Boolean(body.activo) : true;

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

    if (isNaN(descuento_servicio) || descuento_servicio < 0 || descuento_servicio > 100) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "El descuento en servicios debe estar entre 0 y 100.", field: "descuento_servicio" },
        { status: 400 }
      );
    }

    if (isNaN(descuento_producto) || descuento_producto < 0 || descuento_producto > 100) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "El descuento en productos debe estar entre 0 y 100.", field: "descuento_producto" },
        { status: 400 }
      );
    }

    // Validar duplicado por nombre
    const existing = await query<{ nivel_cliente_id: number }>(
      `SELECT nivel_cliente_id FROM admin.nivel_cliente WHERE UPPER(nombre) = UPPER($1)`,
      [nombre]
    );

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "DUPLICATE_NAME", message: `Ya existe un nivel de cliente con el nombre "${nombre}".`, field: "nombre" },
        { status: 409 }
      );
    }

    const insertSql = `
      INSERT INTO admin.nivel_cliente (nombre, descuento_servicio, descuento_producto, descripcion, activo, fecha_creacion)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *;
    `;

    const res = await query<NivelClienteRow>(insertSql, [
      nombre,
      descuento_servicio,
      descuento_producto,
      descripcion || null,
      activo
    ]);

    const created = res[0];

    // Registro de auditoría
    await recordUserAudit({
      userId: session.usuario_id,
      adminId: session.usuario_id,
      accion: "CRM_NIVEL_CLIENTE_CREADO",
      valorNuevo: { nombre, descuento_servicio, descuento_producto, descripcion, activo },
      motivo: `Creación de nivel de cliente ${nombre}`,
      req: request
    });

    return NextResponse.json({
      success: true,
      message: "Nivel de cliente creado correctamente.",
      data: {
        nivel_cliente_id: Number(created.nivel_cliente_id),
        id: Number(created.nivel_cliente_id),
        nombre: created.nombre,
        descuento_servicio: Number(created.descuento_servicio),
        descuento_producto: Number(created.descuento_producto),
        porciento_descuento: Number(created.descuento_servicio),
        descripcion: created.descripcion || "",
        activo: Boolean(created.activo),
        fecha_creacion: created.fecha_creacion
      }
    }, { status: 201 });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error en POST /api/crm/niveles-cliente:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: `Error al crear nivel de cliente: ${msg}` },
      { status: 500 }
    );
  }
}
