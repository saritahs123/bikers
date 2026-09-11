import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// GET /api/inventario/marcas-producto
export async function GET() {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const permsInv = await getModulePermissions("INVENTARIO", session.usuario_id);
    const permsSeg = await getModulePermissions("SEGURIDAD", session.usuario_id);
    if (!permsInv.puede_ver && !permsSeg.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para ver las marcas de producto." }, { status: 403 });
    }

    const rows = await query(`
      SELECT
        mp.marca_producto_id AS id,
        mp.marca_producto_id,
        mp.codigo,
        mp.nombre,
        mp.descripcion,
        mp.pais_origen,
        mp.sitio_web,
        mp.estado,
        mp.fecha_registro,
        mp.fecha_actualizacion,
        (
          SELECT COUNT(*)::int
          FROM admin.productos p
          WHERE p.marca_producto_id = mp.marca_producto_id
        ) AS total_productos
      FROM admin.marca_producto mp
      ORDER BY mp.nombre ASC
    `);

    const mapped = (rows || []).map((r: any) => ({
      id: r.marca_producto_id,
      marca_producto_id: r.marca_producto_id,
      codigo: r.codigo || "",
      nombre: r.nombre || "",
      descripcion: r.descripcion || "",
      pais_origen: r.pais_origen || "",
      sitio_web: r.sitio_web || "",
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
    console.error("Error in GET /api/inventario/marcas-producto:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al obtener marcas de producto." }, { status: 500 });
  }
}

// POST /api/inventario/marcas-producto
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
        message: "No posee permisos de administrador para crear marcas de producto."
      }, { status: 403 });
    }

    const body = await req.json();
    const codigo = String(body.codigo || "").trim().toUpperCase();
    const nombre = String(body.nombre || "").trim();
    const descripcion = body.descripcion ? String(body.descripcion).trim() : null;
    const pais_origen = body.pais_origen ? String(body.pais_origen).trim() : null;
    const sitio_web = body.sitio_web ? String(body.sitio_web).trim() : null;
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

    // Check unique duplicate
    const dupCheck = await query(
      `SELECT codigo, nombre FROM admin.marca_producto WHERE UPPER(codigo) = $1 OR UPPER(nombre) = $2 LIMIT 1`,
      [codigo, nombre.toUpperCase()]
    );
    if (dupCheck && dupCheck.length > 0) {
      const dup = dupCheck[0];
      if (dup.codigo.toUpperCase() === codigo) {
        return NextResponse.json({ error: "DUPLICATE_CODE", message: `Ya existe una marca con el código '${codigo}'.` }, { status: 409 });
      }
      return NextResponse.json({ error: "DUPLICATE_NAME", message: `Ya existe una marca con el nombre '${nombre}'.` }, { status: 409 });
    }

    const insertRes = await query(
      `INSERT INTO admin.marca_producto (
         codigo, nombre, descripcion, pais_origen, sitio_web, estado, fecha_registro, usuario_registro
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
       RETURNING *`,
      [codigo, nombre, descripcion, pais_origen, sitio_web, estado, session.usuario_id]
    );

    return NextResponse.json({ success: true, item: insertRes[0] }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/inventario/marcas-producto:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al registrar marca de producto." }, { status: 500 });
  }
}
