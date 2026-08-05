import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    let rows: any[] = [];
    try {
      rows = await query(`
        SELECT 
          tipo_usuario_id AS id,
          tipo_usuario_id,
          codigo,
          nombre,
          descripcion,
          nivel_acceso,
          estado,
          fecha_creacion,
          fecha_actualizacion
        FROM admin.tipo_usuario
        ORDER BY tipo_usuario_id ASC
      `);
    } catch (e) {
      console.warn("Fallback query for GET admin.tipo_usuario:", e);
      try {
        rows = await query(`SELECT * FROM admin.tipo_usuario ORDER BY 1 ASC`);
      } catch (e2) {
        console.error("Could not query admin.tipo_usuario:", e2);
      }
    }

    const mapped = (rows || []).map((r: any) => ({
      id: r.tipo_usuario_id ?? r.id,
      tipo_usuario_id: r.tipo_usuario_id ?? r.id,
      codigo: r.codigo || '',
      nombre: r.nombre || 'Sin Nombre',
      descripcion: r.descripcion || '',
      nivel_acceso: r.nivel_acceso !== undefined && r.nivel_acceso !== null ? Number(r.nivel_acceso) : 1,
      estado: (r.estado || 'ACTIVO').toString().toUpperCase(),
      fecha_creacion: r.fecha_creacion ? String(r.fecha_creacion).substring(0, 10) : null,
      fecha_actualizacion: r.fecha_actualizacion ? String(r.fecha_actualizacion).substring(0, 10) : null
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("Error in GET /api/tipos-usuario:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const codigo = (body.codigo || '').trim();
    const nombre = (body.nombre || '').trim();
    const descripcion = (body.descripcion || '').trim();
    const nivel_acceso = Math.max(1, parseInt(body.nivel_acceso || 1, 10));
    const estadoInput = (body.estado || 'ACTIVO').toString().trim().toUpperCase();
    const estado = (estadoInput === 'INACTIVO' || estadoInput === 'INACTIVOS') ? 'INACTIVO' : 'ACTIVO';

    if (!codigo) {
      return NextResponse.json({ error: "El Código del Tipo de Usuario es obligatorio." }, { status: 400 });
    }
    if (codigo.length > 50) {
      return NextResponse.json({ error: "El Código no puede exceder los 50 caracteres." }, { status: 400 });
    }
    if (!nombre) {
      return NextResponse.json({ error: "El Nombre del Tipo de Usuario es obligatorio." }, { status: 400 });
    }
    if (nombre.length > 100) {
      return NextResponse.json({ error: "El Nombre no puede exceder los 100 caracteres." }, { status: 400 });
    }
    if (descripcion.length > 500) {
      return NextResponse.json({ error: "La Descripción no puede exceder los 500 caracteres." }, { status: 400 });
    }

    // Attempt 1: Standard INSERT
    try {
      const sql1 = `
        INSERT INTO admin.tipo_usuario (
          codigo, nombre, descripcion, nivel_acceso, estado, fecha_creacion, fecha_actualizacion
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING *
      `;
      const res1 = await query(sql1, [codigo, nombre, descripcion, nivel_acceso, estado]);
      const r = res1[0] || {};
      return NextResponse.json({
        id: r.tipo_usuario_id ?? r.id,
        tipo_usuario_id: r.tipo_usuario_id ?? r.id,
        codigo: r.codigo || codigo,
        nombre: r.nombre || nombre,
        descripcion: r.descripcion || descripcion,
        nivel_acceso: r.nivel_acceso || nivel_acceso,
        estado: r.estado || estado,
        fecha_creacion: r.fecha_creacion || new Date().toISOString()
      });
    } catch (err1: any) {
      console.warn("POST Try 1 failed:", err1?.message);
      if (err1?.message?.includes("unique") || err1?.message?.includes("duplicate")) {
        if (err1?.message?.includes("codigo")) {
          return NextResponse.json({ error: "Ya existe un Tipo de Usuario con ese Código." }, { status: 400 });
        }
        return NextResponse.json({ error: "Ya existe un Tipo de Usuario con ese Nombre." }, { status: 400 });
      }

      // Attempt 2: Explicit ID auto-calculation
      try {
        const sql2 = `
          INSERT INTO admin.tipo_usuario (
            tipo_usuario_id, codigo, nombre, descripcion, nivel_acceso, estado, fecha_creacion, fecha_actualizacion
          )
          VALUES (
            (SELECT COALESCE(MAX(tipo_usuario_id), 0) + 1 FROM admin.tipo_usuario),
            $1, $2, $3, $4, $5, NOW(), NOW()
          )
          RETURNING *
        `;
        const res2 = await query(sql2, [codigo, nombre, descripcion, nivel_acceso, estado]);
        const r2 = res2[0] || {};
        return NextResponse.json({
          id: r2.tipo_usuario_id ?? r2.id,
          tipo_usuario_id: r2.tipo_usuario_id ?? r2.id,
          codigo: r2.codigo || codigo,
          nombre: r2.nombre || nombre,
          descripcion: r2.descripcion || descripcion,
          nivel_acceso: r2.nivel_acceso || nivel_acceso,
          estado: r2.estado || estado,
          fecha_creacion: r2.fecha_creacion || new Date().toISOString()
        });
      } catch (err2: any) {
        console.error("POST Try 2 failed:", err2);
        return NextResponse.json({ error: "Error al registrar tipo de usuario en PostgreSQL: " + (err2?.message || err1?.message) }, { status: 500 });
      }
    }
  } catch (error: any) {
    console.error("Error in POST /api/tipos-usuario:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
