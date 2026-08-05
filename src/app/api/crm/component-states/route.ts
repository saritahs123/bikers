import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/crm/component-states
export async function GET() {
  try {
    let rows: any[] = [];
    try {
      rows = await query(`
        SELECT 
          estado_componente_id AS id,
          estado_componente_id,
          codigo,
          nombre,
          descripcion,
          nivel_desgaste,
          requiere_revision,
          orden_visual,
          activo,
          fecha_creacion,
          fecha_modificacion
        FROM admin.estado_componente
        WHERE fecha_eliminacion IS NULL
        ORDER BY orden_visual ASC, estado_componente_id ASC
      `);
    } catch (e) {
      console.warn("Fallback query for GET admin.estado_componente:", e);
      try {
        rows = await query(`SELECT * FROM admin.estado_componente WHERE fecha_eliminacion IS NULL ORDER BY 1 ASC`);
      } catch (e2) {
        console.error("Could not query admin.estado_componente:", e2);
      }
    }

    const mapped = (rows || []).map((r: any) => ({
      id: r.estado_componente_id ?? r.id,
      estado_componente_id: r.estado_componente_id ?? r.id,
      codigo: r.codigo || '',
      nombre: r.nombre || '',
      descripcion: r.descripcion || '',
      nivel_desgaste: r.nivel_desgaste !== undefined && r.nivel_desgaste !== null ? Number(r.nivel_desgaste) : 0,
      requiere_revision: r.requiere_revision === true || r.requiere_revision === 't' || r.requiere_revision === 'true',
      orden_visual: r.orden_visual !== undefined && r.orden_visual !== null ? Number(r.orden_visual) : 0,
      activo: r.activo !== false,
      estado: r.activo !== false ? 'ACTIVO' : 'INACTIVO',
      fecha_creacion: r.fecha_creacion ? String(r.fecha_creacion).substring(0, 10) : null,
      fecha_modificacion: r.fecha_modificacion ? String(r.fecha_modificacion).substring(0, 10) : null
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("Error in GET /api/crm/component-states:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/crm/component-states
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const codigo = (body.codigo || '').trim().toUpperCase();
    const nombre = (body.nombre || '').trim();
    const descripcion = (body.descripcion || '').trim();
    const nivel_desgaste = body.nivel_desgaste !== undefined && body.nivel_desgaste !== null && body.nivel_desgaste !== '' ? parseInt(body.nivel_desgaste, 10) : 0;
    const requiere_revision = Boolean(body.requiere_revision);
    const orden_visual = body.orden_visual !== undefined && body.orden_visual !== null && body.orden_visual !== '' ? parseInt(body.orden_visual, 10) : 0;
    const activo = body.activo !== undefined ? Boolean(body.activo) : true;

    // Validations
    if (!codigo) {
      return NextResponse.json({ error: "El Código del estado es obligatorio." }, { status: 400 });
    }
    if (codigo.length > 50) {
      return NextResponse.json({ error: "El Código no puede exceder los 50 caracteres." }, { status: 400 });
    }
    if (!nombre) {
      return NextResponse.json({ error: "El Nombre del estado es obligatorio." }, { status: 400 });
    }
    if (nombre.length > 100) {
      return NextResponse.json({ error: "El Nombre no puede exceder los 100 caracteres." }, { status: 400 });
    }
    if (descripcion.length > 300) {
      return NextResponse.json({ error: "La Descripción no puede exceder los 300 caracteres." }, { status: 400 });
    }
    if (isNaN(nivel_desgaste) || nivel_desgaste < 0 || nivel_desgaste > 100) {
      return NextResponse.json({ error: "El Nivel de Desgaste es obligatorio y debe estar entre 0 y 100." }, { status: 400 });
    }
    if (isNaN(orden_visual) || orden_visual < 0) {
      return NextResponse.json({ error: "El Orden Visual es obligatorio y debe ser mayor o igual a cero." }, { status: 400 });
    }

    // Unique check for codigo
    const checkCodigo = await query(`
      SELECT estado_componente_id FROM admin.estado_componente
      WHERE UPPER(codigo) = $1 AND fecha_eliminacion IS NULL
    `, [codigo]);
    if (checkCodigo && checkCodigo.length > 0) {
      return NextResponse.json({ error: "Ya existe un estado registrado con este Código." }, { status: 400 });
    }

    // Unique check for nombre
    const checkNombre = await query(`
      SELECT estado_componente_id FROM admin.estado_componente
      WHERE LOWER(nombre) = $1 AND fecha_eliminacion IS NULL
    `, [nombre.toLowerCase()]);
    if (checkNombre && checkNombre.length > 0) {
      return NextResponse.json({ error: "Ya existe un estado registrado con este Nombre." }, { status: 400 });
    }

    // Try standard insert first
    try {
      const sql = `
        INSERT INTO admin.estado_componente (
          codigo, nombre, descripcion, nivel_desgaste, requiere_revision, orden_visual, activo, fecha_creacion
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *
      `;

      const result = await query(sql, [codigo, nombre, descripcion || null, nivel_desgaste, requiere_revision, orden_visual, activo]);
      const r = result[0] || {};

      return NextResponse.json({
        id: r.estado_componente_id ?? r.id,
        estado_componente_id: r.estado_componente_id ?? r.id,
        codigo: r.codigo || codigo,
        nombre: r.nombre || nombre,
        descripcion: r.descripcion || descripcion,
        nivel_desgaste: r.nivel_desgaste ?? nivel_desgaste,
        requiere_revision: r.requiere_revision ?? requiere_revision,
        orden_visual: r.orden_visual ?? orden_visual,
        activo: r.activo !== false,
        fecha_creacion: r.fecha_creacion || new Date().toISOString()
      });
    } catch (err1: any) {
      console.warn("POST Try 1 failed, attempting explicit ID calculation:", err1?.message);
      const sql2 = `
        INSERT INTO admin.estado_componente (
          estado_componente_id, codigo, nombre, descripcion, nivel_desgaste, requiere_revision, orden_visual, activo, fecha_creacion
        )
        VALUES (
          (SELECT COALESCE(MAX(estado_componente_id), 0) + 1 FROM admin.estado_componente),
          $1, $2, $3, $4, $5, $6, $7, NOW()
        )
        RETURNING *
      `;
      const result2 = await query(sql2, [codigo, nombre, descripcion || null, nivel_desgaste, requiere_revision, orden_visual, activo]);
      const r2 = result2[0] || {};

      return NextResponse.json({
        id: r2.estado_componente_id ?? r2.id,
        estado_componente_id: r2.estado_componente_id ?? r2.id,
        codigo: r2.codigo || codigo,
        nombre: r2.nombre || nombre,
        descripcion: r2.descripcion || descripcion,
        nivel_desgaste: r2.nivel_desgaste ?? nivel_desgaste,
        requiere_revision: r2.requiere_revision ?? requiere_revision,
        orden_visual: r2.orden_visual ?? orden_visual,
        activo: r2.activo !== false,
        fecha_creacion: r2.fecha_creacion || new Date().toISOString()
      });
    }

  } catch (error: any) {
    console.error("Error in POST /api/crm/component-states:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
