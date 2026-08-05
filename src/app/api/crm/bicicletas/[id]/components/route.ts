import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/crm/bicicletas/[id]/components
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const bicicletaId = parseInt(id, 10);

    if (isNaN(bicicletaId)) {
      return NextResponse.json({ error: "ID de bicicleta inválido." }, { status: 400 });
    }

    const rows = await query(`
      SELECT 
        bc.bicicleta_componente_id AS id,
        bc.bicicleta_componente_id,
        bc.bicicleta_id,
        bc.categoria_componente_id,
        cat.nombre AS categoria_nombre,
        cat.codigo AS categoria_codigo,
        bc.estado_componente_id,
        est.nombre AS estado_nombre,
        est.codigo AS estado_codigo,
        est.nivel_desgaste,
        est.requiere_revision,
        bc.marca,
        bc.modelo,
        bc.numero_serie,
        bc.descripcion,
        bc.fecha_instalacion,
        bc.kilometraje_instalacion,
        bc.vigente,
        bc.observaciones,
        bc.activo,
        bc.fecha_creacion
      FROM admin.bicicleta_componentes bc
      LEFT JOIN admin.categoria_componente cat ON bc.categoria_componente_id = cat.categoria_componente_id
      LEFT JOIN admin.estado_componente est ON bc.estado_componente_id = est.estado_componente_id
      WHERE bc.bicicleta_id = $1 AND bc.fecha_eliminacion IS NULL AND (bc.activo = true OR bc.activo IS NULL)
      ORDER BY cat.orden_visual ASC, bc.bicicleta_componente_id DESC
    `, [bicicletaId]);

    const mapped = (rows || []).map((r: any) => ({
      id: r.bicicleta_componente_id,
      bicicleta_componente_id: r.bicicleta_componente_id,
      bicicleta_id: r.bicicleta_id,
      categoria_componente_id: r.categoria_componente_id,
      categoria_nombre: r.categoria_nombre || "General",
      categoria_codigo: r.categoria_codigo || "GEN",
      estado_componente_id: r.estado_componente_id,
      estado_nombre: r.estado_nombre || "Bueno",
      estado_codigo: r.estado_codigo || "BUENO",
      nivel_desgaste: r.nivel_desgaste !== undefined && r.nivel_desgaste !== null ? Number(r.nivel_desgaste) : 0,
      requiere_revision: Boolean(r.requiere_revision),
      marca: r.marca || "",
      modelo: r.modelo || "",
      especificacion: [r.marca, r.modelo].filter(Boolean).join(" ") || r.descripcion || "Sin modelo",
      numero_serie: r.numero_serie || "",
      descripcion: r.descripcion || "",
      fecha_instalacion: r.fecha_instalacion ? String(r.fecha_instalacion).substring(0, 10) : null,
      kilometraje_instalacion: Number(r.kilometraje_instalacion || 0),
      vigente: r.vigente !== false,
      observaciones: r.observaciones || ""
    }));

    return NextResponse.json(mapped);

  } catch (error: any) {
    console.error("Error in GET /api/crm/bicicletas/[id]/components:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/crm/bicicletas/[id]/components
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const bicicletaId = parseInt(id, 10);

    if (isNaN(bicicletaId)) {
      return NextResponse.json({ error: "ID de bicicleta inválido." }, { status: 400 });
    }

    const body = await req.json();
    const categoria_componente_id = parseInt(body.categoria_componente_id, 10);
    const estado_componente_id = parseInt(body.estado_componente_id || 1, 10);
    const marca = (body.marca || '').trim();
    const modelo = (body.modelo || '').trim();
    const numero_serie = (body.numero_serie || '').trim();
    const descripcion = (body.descripcion || '').trim();
    const fecha_instalacion = body.fecha_instalacion || new Date().toISOString();
    const kilometraje_instalacion = body.kilometraje_instalacion ? parseInt(body.kilometraje_instalacion, 10) : 0;
    const observaciones = (body.observaciones || '').trim();

    if (isNaN(categoria_componente_id)) {
      return NextResponse.json({ error: "Debe seleccionar una categoría de componente." }, { status: 400 });
    }

    const sql = `
      INSERT INTO admin.bicicleta_componentes (
        bicicleta_componente_id, bicicleta_id, categoria_componente_id, estado_componente_id,
        marca, modelo, numero_serie, descripcion, fecha_instalacion,
        kilometraje_instalacion, vigente, observaciones, activo, fecha_creacion
      ) VALUES (
        (SELECT COALESCE(MAX(bicicleta_componente_id), 0) + 1 FROM admin.bicicleta_componentes),
        $1, $2, $3,
        $4, $5, $6, $7, $8,
        $9, true, $10, true, NOW()
      )
      RETURNING *
    `;

    const result = await query(sql, [
      bicicletaId,
      categoria_componente_id,
      estado_componente_id,
      marca || null,
      modelo || null,
      numero_serie || null,
      descripcion || null,
      fecha_instalacion,
      kilometraje_instalacion,
      observaciones || null
    ]);

    return NextResponse.json(result[0]);

  } catch (error: any) {
    console.error("Error in POST /api/crm/bicicletas/[id]/components:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/crm/bicicletas/[id]/components
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const bicicletaId = parseInt(id, 10);
    const { searchParams } = new URL(req.url);
    const componentIdParam = searchParams.get("componentId");

    if (isNaN(bicicletaId) || !componentIdParam) {
      return NextResponse.json({ error: "ID de bicicleta o componente inválido." }, { status: 400 });
    }

    const componentId = parseInt(componentIdParam, 10);

    await query(`
      DELETE FROM admin.bicicleta_componentes
      WHERE bicicleta_componente_id = $1 AND bicicleta_id = $2
    `, [componentId, bicicletaId]);

    return NextResponse.json({ message: "Componente eliminado correctamente." });

  } catch (error: any) {
    console.error("Error in DELETE /api/crm/bicicletas/[id]/components:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
