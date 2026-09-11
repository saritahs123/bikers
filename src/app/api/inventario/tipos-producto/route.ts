import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// GET /api/inventario/tipos-producto
export async function GET() {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const permsInv = await getModulePermissions("INVENTARIO", session.usuario_id);
    const permsSeg = await getModulePermissions("SEGURIDAD", session.usuario_id);
    if (!permsInv.puede_ver && !permsSeg.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para ver los tipos de producto." }, { status: 403 });
    }

    const rows = await query(`
      SELECT
        tp.tipo_producto_id AS id,
        tp.tipo_producto_id,
        tp.codigo,
        tp.nombre,
        tp.descripcion,
        tp.estado,
        tp.fecha_registro,
        tp.fecha_actualizacion,
        tp.usuario_registro,
        tp.usuario_actualizacion,
        (
          SELECT COUNT(*)::int
          FROM admin.productos p
          WHERE p.tipo_producto_id = tp.tipo_producto_id
        ) AS total_productos
      FROM admin.tipo_producto tp
      ORDER BY tp.nombre ASC
    `);

    const mapped = (rows || []).map((r: any) => ({
      id: r.tipo_producto_id,
      tipo_producto_id: r.tipo_producto_id,
      codigo: r.codigo || "",
      nombre: r.nombre || "",
      descripcion: r.descripcion || "",
      estado: (r.estado || "ACTIVO").toUpperCase(),
      total_productos: Number(r.total_productos || 0),
      fecha_registro: r.fecha_registro ? String(r.fecha_registro).substring(0, 10) : null,
      fecha_actualizacion: r.fecha_actualizacion ? String(r.fecha_actualizacion).substring(0, 10) : null,
    }));

    const response = NextResponse.json(mapped);
    response.headers.set("x-perm-ver", "true");
    response.headers.set("x-perm-crear", String(permsSeg.puede_crear));
    response.headers.set("x-perm-editar", String(permsSeg.puede_editar));
    response.headers.set("x-perm-eliminar", String(permsSeg.puede_eliminar));

    return response;
  } catch (error: any) {
    console.error("Error in GET /api/inventario/tipos-producto:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al obtener tipos de producto." }, { status: 500 });
  }
}

// POST /api/inventario/tipos-producto
export async function POST(req: Request) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const permsSeg = await getModulePermissions("SEGURIDAD", session.usuario_id);
    if (!permsSeg.puede_crear) {
      return NextResponse.json({
        error: "FORBIDDEN",
        message: "No posee permisos de administrador para crear tipos de producto."
      }, { status: 403 });
    }

    const body = await req.json();
    const codigo = String(body.codigo || "").trim().toUpperCase();
    const nombre = String(body.nombre || "").trim();
    const descripcion = body.descripcion ? String(body.descripcion).trim() : null;
    const estado = String(body.estado || "ACTIVO").trim().toUpperCase() === "INACTIVO" ? "INACTIVO" : "ACTIVO";

    if (!codigo) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El código es obligatorio." }, { status: 400 });
    }
    if (codigo.length > 50) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El código no puede exceder 50 caracteres." }, { status: 400 });
    }
    if (!nombre) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El nombre es obligatorio." }, { status: 400 });
    }
    if (nombre.length > 100) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El nombre no puede exceder 100 caracteres." }, { status: 400 });
    }

    // Check unique codigo and nombre
    const dupCheck = await query(
      `SELECT codigo, nombre FROM admin.tipo_producto WHERE UPPER(codigo) = $1 OR UPPER(nombre) = $2 LIMIT 1`,
      [codigo, nombre.toUpperCase()]
    );
    if (dupCheck && dupCheck.length > 0) {
      const dup = dupCheck[0];
      if (dup.codigo.toUpperCase() === codigo) {
        return NextResponse.json({ error: "DUPLICATE_CODE", message: `Ya existe un tipo de producto con el código '${codigo}'.` }, { status: 409 });
      }
      return NextResponse.json({ error: "DUPLICATE_NAME", message: `Ya existe un tipo de producto con el nombre '${nombre}'.` }, { status: 409 });
    }

    const insertRes = await query(
      `INSERT INTO admin.tipo_producto (
         codigo, nombre, descripcion, estado, fecha_registro, usuario_registro
       )
       VALUES ($1, $2, $3, $4, NOW(), $5)
       RETURNING *`,
      [codigo, nombre, descripcion, estado, session.usuario_id]
    );

    return NextResponse.json({ success: true, item: insertRes[0] }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/inventario/tipos-producto:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al registrar tipo de producto." }, { status: 500 });
  }
}
