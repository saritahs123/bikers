import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// GET /api/inventario/proveedores
export async function GET() {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("INVENTARIO", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para ver proveedores." }, { status: 403 });
    }

    const empresaId = session.empresa_id;

    const rows = await query(`
      SELECT
        pr.proveedor_id AS id,
        pr.proveedor_id,
        pr.codigo_proveedor,
        pr.nombre_comercial,
        pr.nombre_contacto,
        pr.telefono,
        pr.correo,
        pr.direccion,
        pr.rnc,
        pr.sitio_web,
        pr.estado,
        pr.observacion,
        pr.fecha_registro,
        pr.fecha_actualizacion,
        (
          SELECT COUNT(*)::int
          FROM admin.producto_proveedor pp
          JOIN admin.productos p ON pp.producto_id = p.producto_id
          WHERE pp.proveedor_id = pr.proveedor_id
            AND p.empresa_id = $1
            AND pp.estado = 'ACTIVO'
        ) AS total_productos
      FROM admin.proveedores pr
      WHERE pr.empresa_id = $1
      ORDER BY pr.nombre_comercial ASC
    `, [empresaId]);

    const mapped = (rows || []).map((r: any) => ({
      id: r.proveedor_id,
      proveedor_id: r.proveedor_id,
      codigo_proveedor: r.codigo_proveedor || "",
      nombre_comercial: r.nombre_comercial || "",
      nombre_contacto: r.nombre_contacto || "",
      telefono: r.telefono || "",
      correo: r.correo || "",
      direccion: r.direccion || "",
      rnc: r.rnc || "",
      sitio_web: r.sitio_web || "",
      estado: (r.estado || "ACTIVO").toUpperCase(),
      observacion: r.observacion || "",
      total_productos: Number(r.total_productos || 0),
      fecha_registro: r.fecha_registro ? String(r.fecha_registro).substring(0, 10) : null,
      fecha_actualizacion: r.fecha_actualizacion ? String(r.fecha_actualizacion).substring(0, 10) : null,
    }));

    const response = NextResponse.json(mapped);
    response.headers.set("x-perm-ver", String(perms.puede_ver));
    response.headers.set("x-perm-crear", String(perms.puede_crear));
    response.headers.set("x-perm-editar", String(perms.puede_editar));
    response.headers.set("x-perm-eliminar", String(perms.puede_eliminar));

    return response;
  } catch (error: any) {
    console.error("Error in GET /api/inventario/proveedores:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al obtener proveedores." }, { status: 500 });
  }
}

// POST /api/inventario/proveedores
export async function POST(req: Request) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("INVENTARIO", session.usuario_id);
    if (!perms.puede_crear) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para registrar proveedores." }, { status: 403 });
    }

    const empresaId = session.empresa_id;
    const body = await req.json();

    const codigo_proveedor = String(body.codigo_proveedor || "").trim().toUpperCase();
    const nombre_comercial = String(body.nombre_comercial || "").trim();
    const nombre_contacto = body.nombre_contacto ? String(body.nombre_contacto).trim() : null;
    const telefono = body.telefono ? String(body.telefono).trim() : null;
    const correo = body.correo ? String(body.correo).trim() : null;
    const direccion = body.direccion ? String(body.direccion).trim() : null;
    const rnc = body.rnc ? String(body.rnc).trim() : null;
    const sitio_web = body.sitio_web ? String(body.sitio_web).trim() : null;
    const estado = String(body.estado || "ACTIVO").trim().toUpperCase() === "INACTIVO" ? "INACTIVO" : "ACTIVO";
    const observacion = body.observacion ? String(body.observacion).trim() : null;

    if (!codigo_proveedor) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El código de proveedor es obligatorio." }, { status: 400 });
    }
    if (codigo_proveedor.length > 50) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El código de proveedor no puede exceder 50 caracteres." }, { status: 400 });
    }
    if (!nombre_comercial) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El nombre comercial / razón social es obligatorio." }, { status: 400 });
    }
    if (nombre_comercial.length > 150) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "El nombre comercial no puede exceder 150 caracteres." }, { status: 400 });
    }

    // Check unique duplicate in current empresa
    const dupCheck = await query(
      `SELECT codigo_proveedor, nombre_comercial
       FROM admin.proveedores
       WHERE empresa_id = $1 AND (UPPER(codigo_proveedor) = $2 OR UPPER(nombre_comercial) = $3)
       LIMIT 1`,
      [empresaId, codigo_proveedor, nombre_comercial.toUpperCase()]
    );
    if (dupCheck && dupCheck.length > 0) {
      const dup = dupCheck[0];
      if (dup.codigo_proveedor.toUpperCase() === codigo_proveedor) {
        return NextResponse.json({ error: "DUPLICATE_CODE", message: `Ya existe un proveedor con el código '${codigo_proveedor}'.` }, { status: 409 });
      }
      return NextResponse.json({ error: "DUPLICATE_NAME", message: `Ya existe un proveedor con el nombre '${nombre_comercial}'.` }, { status: 409 });
    }

    const insertRes = await query(
      `INSERT INTO admin.proveedores (
         empresa_id, codigo_proveedor, nombre_comercial, nombre_contacto,
         telefono, correo, direccion, rnc, sitio_web, estado, observacion,
         fecha_registro, usuario_registro
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12)
       RETURNING *`,
      [
        empresaId,
        codigo_proveedor,
        nombre_comercial,
        nombre_contacto,
        telefono,
        correo,
        direccion,
        rnc,
        sitio_web,
        estado,
        observacion,
        session.usuario_id
      ]
    );

    return NextResponse.json({ success: true, item: insertRes[0] }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/inventario/proveedores:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al registrar proveedor." }, { status: 500 });
  }
}
