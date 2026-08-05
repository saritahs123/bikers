import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/crm/bicicletas/[id]
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const bicicletaId = parseInt(id, 10);

    if (isNaN(bicicletaId)) {
      return NextResponse.json({ error: "ID de bicicleta inválido." }, { status: 400 });
    }

    const rows = await query(`
      SELECT 
        b.*,
        c.nombre_completo AS cliente_nombre,
        c.correo AS cliente_correo,
        c.telefono_principal AS cliente_telefono,
        c.tipo_cliente AS cliente_nivel,
        f.url_archivo AS foto_url
      FROM admin.bicicletas b
      LEFT JOIN admin.clientes c ON b.cliente_id = c.cliente_id
      LEFT JOIN LATERAL (
        SELECT url_archivo
        FROM admin.bicicleta_fotos
        WHERE bicicleta_id = b.bicicleta_id AND (activo = true OR activo IS NULL)
        ORDER BY es_principal DESC, bicicleta_foto_id DESC
        LIMIT 1
      ) f ON true
      WHERE b.bicicleta_id = $1 AND b.fecha_eliminacion IS NULL
    `, [bicicletaId]);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Bicicleta no encontrada." }, { status: 404 });
    }

    const rawBike = rows[0];
    const getFallbackPhotoUrl = (tipo: string) => {
      const t = String(tipo || "MTB").toUpperCase();
      if (t.includes("ROAD") || t.includes("RUTA")) {
        return "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80";
      }
      if (t.includes("E-BIKE") || t.includes("ELECTRICA")) {
        return "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=800&q=80";
      }
      if (t.includes("GRAVEL")) {
        return "https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?auto=format&fit=crop&w=800&q=80";
      }
      return "https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?auto=format&fit=crop&w=800&q=80";
    };

    const foto_url = (rawBike.foto_url && !rawBike.foto_url.includes("default.png"))
      ? rawBike.foto_url
      : getFallbackPhotoUrl(rawBike.tipo_bicicleta);

    return NextResponse.json({
      id: rawBike.bicicleta_id,
      ...rawBike,
      foto_url
    });
  } catch (error: any) {
    console.error("Error in GET /api/crm/bicicletas/[id]:", error);
    return NextResponse.json({ error: error.message || "Error al obtener bicicleta" }, { status: 500 });
  }
}

// PUT /api/crm/bicicletas/[id]
export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const bicicletaId = parseInt(id, 10);

    if (isNaN(bicicletaId)) {
      return NextResponse.json({ error: "ID de bicicleta inválido." }, { status: 400 });
    }

    const body = await req.json();

    const cliente_id = parseInt(body.cliente_id, 10);
    const marca = (body.marca || '').trim();
    const modelo = (body.modelo || '').trim();
    const tipo_bicicleta = (body.tipo_bicicleta || 'MTB').trim();
    const ano = body.ano ? parseInt(body.ano, 10) : new Date().getFullYear();
    const color = (body.color || '').trim();
    const talla = (body.talla || '').trim();
    const numero_serie_cuadro = (body.numero_serie_cuadro || '').trim();
    const descripcion = (body.descripcion || '').trim();
    const kilometraje_actual = body.kilometraje_actual ? parseInt(body.kilometraje_actual, 10) : 0;
    const notas_tecnicas = (body.notas_tecnicas || '').trim();

    if (isNaN(cliente_id)) {
      return NextResponse.json({ error: "Debe seleccionar un cliente propietario." }, { status: 400 });
    }
    if (!marca) {
      return NextResponse.json({ error: "La Marca de la bicicleta es obligatoria." }, { status: 400 });
    }
    if (!modelo) {
      return NextResponse.json({ error: "El Modelo de la bicicleta es obligatorio." }, { status: 400 });
    }

    const sql = `
      UPDATE admin.bicicletas SET
        cliente_id = $1,
        marca = $2,
        modelo = $3,
        tipo_bicicleta = $4,
        ano = $5,
        color = $6,
        talla = $7,
        numero_serie_cuadro = $8,
        descripcion = $9,
        kilometraje_actual = $10,
        notas_tecnicas = $11,
        fecha_modificacion = NOW()
      WHERE bicicleta_id = $12 AND fecha_eliminacion IS NULL
      RETURNING *
    `;

    const params = [
      cliente_id,
      marca,
      modelo,
      tipo_bicicleta || null,
      ano || null,
      color || null,
      talla || null,
      numero_serie_cuadro || null,
      descripcion || null,
      kilometraje_actual || 0,
      notas_tecnicas || null,
      bicicletaId
    ];

    const result = await query(sql, params);
    if (!result || result.length === 0) {
      return NextResponse.json({ error: "No se pudo actualizar la bicicleta." }, { status: 404 });
    }

    return NextResponse.json(result[0]);

  } catch (error: any) {
    console.error("Error in PUT /api/crm/bicicletas/[id]:", error);
    return NextResponse.json({ error: error.message || "Error al actualizar bicicleta" }, { status: 500 });
  }
}

// DELETE /api/crm/bicicletas/[id]
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const bicicletaId = parseInt(id, 10);

    if (isNaN(bicicletaId)) {
      return NextResponse.json({ error: "ID de bicicleta inválido." }, { status: 400 });
    }

    // Get cliente_id before deleting
    const current = await query(`SELECT cliente_id FROM admin.bicicletas WHERE bicicleta_id = $1`, [bicicletaId]);
    const cliente_id = current && current[0] ? current[0].cliente_id : null;

    const sql = `
      UPDATE admin.bicicletas SET
        activo = false,
        fecha_eliminacion = NOW()
      WHERE bicicleta_id = $1
      RETURNING *
    `;

    const result = await query(sql, [bicicletaId]);
    if (!result || result.length === 0) {
      return NextResponse.json({ error: "Bicicleta no encontrada." }, { status: 404 });
    }

    if (cliente_id) {
      await query(`
        UPDATE admin.clientes
        SET cantidad_bicicletas = (
          SELECT COUNT(*) FROM admin.bicicletas WHERE cliente_id = $1 AND fecha_eliminacion IS NULL
        )
        WHERE cliente_id = $1
      `, [cliente_id]);
    }

    return NextResponse.json({ message: "Bicicleta eliminada correctamente.", bicicleta_id: bicicletaId });

  } catch (error: any) {
    console.error("Error in DELETE /api/crm/bicicletas/[id]:", error);
    return NextResponse.json({ error: error.message || "Error al eliminar bicicleta" }, { status: 500 });
  }
}
