import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/crm/component-categories
export async function GET() {
  try {
    let rows: any[] = [];
    try {
      rows = await query(`
        SELECT 
          categoria_componente_id AS id,
          categoria_componente_id,
          codigo,
          nombre,
          descripcion,
          orden_visual,
          activo,
          fecha_creacion,
          fecha_modificacion
        FROM admin.categoria_componente
        WHERE fecha_eliminacion IS NULL
        ORDER BY orden_visual ASC, categoria_componente_id ASC
      `);
    } catch (e) {
      console.warn("Fallback query for GET admin.categoria_componente:", e);
      try {
        rows = await query(`SELECT * FROM admin.categoria_componente WHERE fecha_eliminacion IS NULL ORDER BY 1 ASC`);
      } catch (e2) {
        console.error("Could not query admin.categoria_componente:", e2);
      }
    }

    const mapped = (rows || []).map((r: any) => ({
      id: r.categoria_componente_id ?? r.id,
      categoria_componente_id: r.categoria_componente_id ?? r.id,
      codigo: r.codigo || '',
      nombre: r.nombre || '',
      descripcion: r.descripcion || '',
      orden_visual: r.orden_visual !== undefined && r.orden_visual !== null ? Number(r.orden_visual) : 0,
      activo: r.activo !== false,
      estado: r.activo !== false ? 'ACTIVO' : 'INACTIVO',
      fecha_creacion: r.fecha_creacion ? String(r.fecha_creacion).substring(0, 10) : null,
      fecha_modificacion: r.fecha_modificacion ? String(r.fecha_modificacion).substring(0, 10) : null
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("Error in GET /api/crm/component-categories:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/crm/component-categories
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const codigo = (body.codigo || '').trim().toUpperCase();
    const nombre = (body.nombre || '').trim();
    const descripcion = (body.descripcion || '').trim();
    const orden_visual = body.orden_visual !== undefined && body.orden_visual !== null && body.orden_visual !== '' ? parseInt(body.orden_visual, 10) : 0;
    const activo = body.activo !== undefined ? Boolean(body.activo) : true;

    // Validations
    if (!codigo) {
      return NextResponse.json({ error: "El Código de la categoría es obligatorio." }, { status: 400 });
    }
    if (codigo.length > 50) {
      return NextResponse.json({ error: "El Código no puede exceder los 50 caracteres." }, { status: 400 });
    }
    if (!nombre) {
      return NextResponse.json({ error: "El Nombre de la categoría es obligatorio." }, { status: 400 });
    }
    if (nombre.length > 100) {
      return NextResponse.json({ error: "El Nombre no puede exceder los 100 caracteres." }, { status: 400 });
    }
    if (descripcion.length > 300) {
      return NextResponse.json({ error: "La Descripción no puede exceder los 300 caracteres." }, { status: 400 });
    }
    if (isNaN(orden_visual) || orden_visual < 0) {
      return NextResponse.json({ error: "El Orden Visual debe ser un número entero mayor o igual a cero." }, { status: 400 });
    }

    // Unique check for codigo
    const checkCodigo = await query(`
      SELECT categoria_componente_id FROM admin.categoria_componente
      WHERE UPPER(codigo) = $1 AND fecha_eliminacion IS NULL
    `, [codigo]);
    if (checkCodigo && checkCodigo.length > 0) {
      return NextResponse.json({ error: "Ya existe una categoría registrada con este Código." }, { status: 400 });
    }

    // Unique check for nombre
    const checkNombre = await query(`
      SELECT categoria_componente_id FROM admin.categoria_componente
      WHERE LOWER(nombre) = $1 AND fecha_eliminacion IS NULL
    `, [nombre.toLowerCase()]);
    if (checkNombre && checkNombre.length > 0) {
      return NextResponse.json({ error: "Ya existe una categoría registrada con este Nombre." }, { status: 400 });
    }

    const sql = `
      INSERT INTO admin.categoria_componente (
        codigo, nombre, descripcion, orden_visual, activo, fecha_creacion
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;

    const result = await query(sql, [codigo, nombre, descripcion || null, orden_visual, activo]);
    const r = result[0] || {};

    return NextResponse.json({
      id: r.categoria_componente_id ?? r.id,
      categoria_componente_id: r.categoria_componente_id ?? r.id,
      codigo: r.codigo || codigo,
      nombre: r.nombre || nombre,
      descripcion: r.descripcion || descripcion,
      orden_visual: r.orden_visual ?? orden_visual,
      activo: r.activo !== false,
      fecha_creacion: r.fecha_creacion || new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Error in POST /api/crm/component-categories:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
