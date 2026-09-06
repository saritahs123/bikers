import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export async function GET() {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("SEGURIDAD", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para realizar esta acción." }, { status: 403 });
    }

    let rows: any[] = [];
    try {
      rows = await query(`
        SELECT 
          departamento_id AS id,
          departamento_id,
          nombre,
          estado,
          fecha_creacion,
          fecha_actualizacion
        FROM admin.departamento
        ORDER BY departamento_id ASC
      `);
    } catch (e) {
      console.warn("Fallback query for GET admin.departamento:", e);
      try {
        rows = await query(`SELECT * FROM admin.departamento ORDER BY 1 ASC`);
      } catch (e2) {
        console.error("Could not query admin.departamento:", e2);
      }
    }

    const mapped = (rows || []).map((r: any) => ({
      id: r.departamento_id ?? r.id,
      departamento_id: r.departamento_id ?? r.id,
      nombre: r.nombre || 'Sin Nombre',
      estado: (r.estado || 'ACTIVO').toString().toUpperCase(),
      fecha_creacion: r.fecha_creacion ? String(r.fecha_creacion).substring(0, 10) : null,
      fecha_actualizacion: r.fecha_actualizacion ? String(r.fecha_actualizacion).substring(0, 10) : null
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("Error in GET /api/departamentos:", error);
    return NextResponse.json({ success: false, error: "SERVER_ERROR", message: "Error al obtener la lista de departamentos." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("SEGURIDAD", session.usuario_id);
    if (!perms.puede_crear) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para realizar esta acción." }, { status: 403 });
    }

    const body = await req.json();
    const nombre = (body.nombre || '').trim();
    const estadoInput = (body.estado || 'ACTIVO').toString().trim().toUpperCase();
    const estado = (estadoInput === 'INACTIVO' || estadoInput === 'INACTIVOS') ? 'INACTIVO' : 'ACTIVO';

    if (!nombre) {
      return NextResponse.json({ error: "El Nombre del Departamento es obligatorio." }, { status: 400 });
    }
    if (nombre.length > 100) {
      return NextResponse.json({ error: "El Nombre no puede exceder los 100 caracteres." }, { status: 400 });
    }

    // Attempt 1: Standard INSERT
    try {
      const sql1 = `
        INSERT INTO admin.departamento (
          nombre, estado, fecha_creacion, fecha_actualizacion
        )
        VALUES ($1, $2, NOW(), NOW())
        RETURNING *
      `;
      const res1 = await query(sql1, [nombre, estado]);
      const r = res1[0] || {};
      return NextResponse.json({
        id: r.departamento_id ?? r.id,
        departamento_id: r.departamento_id ?? r.id,
        nombre: r.nombre || nombre,
        estado: r.estado || estado,
        fecha_creacion: r.fecha_creacion || new Date().toISOString()
      });
    } catch (err1: any) {
      console.warn("POST Try 1 failed:", err1?.message);

      // Attempt 2: Explicit ID auto-calculation
      try {
        const sql2 = `
          INSERT INTO admin.departamento (
            departamento_id, nombre, estado, fecha_creacion, fecha_actualizacion
          )
          VALUES (
            (SELECT COALESCE(MAX(departamento_id), 0) + 1 FROM admin.departamento),
            $1, $2, NOW(), NOW()
          )
          RETURNING *
        `;
        const res2 = await query(sql2, [nombre, estado]);
        const r2 = res2[0] || {};
        return NextResponse.json({
          id: r2.departamento_id ?? r2.id,
          departamento_id: r2.departamento_id ?? r2.id,
          nombre: r2.nombre || nombre,
          estado: r2.estado || estado,
          fecha_creacion: r2.fecha_creacion || new Date().toISOString()
        });
      } catch (err2: any) {
        console.error("POST Try 2 failed:", err2);
        return NextResponse.json({ success: false, error: "SERVER_ERROR", message: "Error al registrar el departamento." }, { status: 500 });
      }
    }
  } catch (error: any) {
    console.error("Error in POST /api/departamentos:", error);
    return NextResponse.json({ success: false, error: "SERVER_ERROR", message: "Error al procesar la creación del departamento." }, { status: 500 });
  }
}
