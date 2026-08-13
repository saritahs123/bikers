import { NextResponse } from "next/server";
import { query } from "@/lib/db";

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

// GET /api/crm/bicicletas
export async function GET() {
  try {
    const sql = `
      SELECT 
        b.bicicleta_id AS id,
        b.bicicleta_id,
        b.cliente_id,
        c.nombre_completo AS cliente_nombre,
        c.correo AS cliente_correo,
        c.telefono_principal AS cliente_telefono,
        b.codigo_qr,
        b.url_qr,
        b.marca,
        b.modelo,
        b.tipo_bicicleta,
        b.ano,
        b.color,
        b.talla,
        b.numero_serie_cuadro,
        b.descripcion,
        b.kilometraje_actual,
        b.fecha_ultima_revision,
        b.notas_tecnicas,
        b.activo,
        b.fecha_creacion,
        b.usuario_creacion,
        b.fecha_modificacion,
        b.usuario_modificacion,
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
      WHERE b.fecha_eliminacion IS NULL
      ORDER BY b.bicicleta_id DESC
    `;

    const rows = await query(sql, []);

    const mapped = (rows || []).map((r: any) => ({
      id: r.bicicleta_id,
      bicicleta_id: r.bicicleta_id,
      cliente_id: r.cliente_id,
      cliente_nombre: r.cliente_nombre || 'Cliente sin nombre',
      cliente_correo: r.cliente_correo || '',
      cliente_telefono: r.cliente_telefono || '',
      codigo_qr: r.codigo_qr || `QR-BF-${r.bicicleta_id}`,
      url_qr: r.url_qr || `/qr/bike/${r.bicicleta_id}`,
      marca: r.marca || '',
      modelo: r.modelo || '',
      tipo_bicicleta: r.tipo_bicicleta || 'MTB',
      ano: r.ano ? Number(r.ano) : new Date().getFullYear(),
      color: r.color || '',
      talla: r.talla || '',
      numero_serie_cuadro: r.numero_serie_cuadro || '',
      descripcion: r.descripcion || '',
      kilometraje_actual: Number(r.kilometraje_actual || 0),
      fecha_ultima_revision: r.fecha_ultima_revision ? String(r.fecha_ultima_revision).substring(0, 10) : null,
      notas_tecnicas: r.notas_tecnicas || '',
      foto_url: (r.foto_url && !r.foto_url.includes("default.png")) ? r.foto_url : null,
      activo: r.activo !== false,
      fecha_creacion: r.fecha_creacion ? String(r.fecha_creacion).substring(0, 10) : null
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("Error in GET /api/crm/bicicletas:", error);
    return NextResponse.json({ error: error?.stack || error?.message || "Error al obtener bicicletas" }, { status: 500 });
  }
}

// POST /api/crm/bicicletas
export async function POST(req: Request) {
  try {
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

    // Auto-generate QR code strings
    const randomCode = Math.floor(100000 + Math.random() * 900000);
    const codigo_qr = (body.codigo_qr || `BF-QR-${randomCode}`).trim();
    const url_qr = (body.url_qr || `/assets/bikes/${codigo_qr}`).trim();

    const params = [
      cliente_id,
      codigo_qr,
      url_qr,
      marca,
      modelo,
      tipo_bicicleta || null,
      ano || null,
      color || null,
      talla || null,
      numero_serie_cuadro || null,
      descripcion || null,
      kilometraje_actual || 0,
      notas_tecnicas || null
    ];

    // Attempt 1: Standard INSERT
    try {
      const sql1 = `
        INSERT INTO admin.bicicletas (
          cliente_id, codigo_qr, url_qr, marca, modelo,
          tipo_bicicleta, ano, color, talla, numero_serie_cuadro,
          descripcion, kilometraje_actual, fecha_ultima_revision, notas_tecnicas,
          activo, fecha_creacion
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, NOW(), $13,
          true, NOW()
        )
        RETURNING *
      `;

      const result1 = await query(sql1, params);
      const r1 = result1[0] || {};

      if (cliente_id) {
        await query(`
          UPDATE admin.clientes
          SET cantidad_bicicletas = (
            SELECT COUNT(*) FROM admin.bicicletas WHERE cliente_id = $1 AND fecha_eliminacion IS NULL
          )
          WHERE cliente_id = $1
        `, [cliente_id]);
      }

      return NextResponse.json({
        id: r1.bicicleta_id,
        bicicleta_id: r1.bicicleta_id,
        cliente_id: r1.cliente_id,
        marca: r1.marca || marca,
        modelo: r1.modelo || modelo,
        tipo_bicicleta: r1.tipo_bicicleta || tipo_bicicleta,
        activo: true,
        fecha_creacion: r1.fecha_creacion || new Date().toISOString()
      });
    } catch (err1: any) {
      console.warn("POST Try 1 failed, attempting explicit bicicleta_id calculation:", err1?.message);

      const sql2 = `
        INSERT INTO admin.bicicletas (
          bicicleta_id, cliente_id, codigo_qr, url_qr, marca, modelo,
          tipo_bicicleta, ano, color, talla, numero_serie_cuadro,
          descripcion, kilometraje_actual, fecha_ultima_revision, notas_tecnicas,
          activo, fecha_creacion
        ) VALUES (
          (SELECT COALESCE(MAX(bicicleta_id), 0) + 1 FROM admin.bicicletas),
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, NOW(), $13,
          true, NOW()
        )
        RETURNING *
      `;

      const result2 = await query(sql2, params);
      const r2 = result2[0] || {};

      if (cliente_id) {
        await query(`
          UPDATE admin.clientes
          SET cantidad_bicicletas = (
            SELECT COUNT(*) FROM admin.bicicletas WHERE cliente_id = $1 AND fecha_eliminacion IS NULL
          )
          WHERE cliente_id = $1
        `, [cliente_id]);
      }

      return NextResponse.json({
        id: r2.bicicleta_id,
        bicicleta_id: r2.bicicleta_id,
        cliente_id: r2.cliente_id,
        marca: r2.marca || marca,
        modelo: r2.modelo || modelo,
        tipo_bicicleta: r2.tipo_bicicleta || tipo_bicicleta,
        activo: true,
        fecha_creacion: r2.fecha_creacion || new Date().toISOString()
      });
    }

  } catch (error: any) {
    console.error("Error in POST /api/crm/bicicletas:", error);
    return NextResponse.json({ error: error.message || "Error al crear bicicleta" }, { status: 500 });
  }
}
