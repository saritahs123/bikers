import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/crm/clientes/[id]
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const clienteId = parseInt(id, 10);

    if (isNaN(clienteId)) {
      return NextResponse.json({ error: "ID de cliente inválido." }, { status: 400 });
    }

    const clienteRows = await query(`
      SELECT * FROM admin.clientes
      WHERE cliente_id = $1 AND fecha_eliminacion IS NULL
    `, [clienteId]);

    if (!clienteRows || clienteRows.length === 0) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    const cliente = clienteRows[0];

    // Fetch client's bicycles along with their main photo
    const bicicletas = await query(`
      SELECT 
        b.bicicleta_id AS id,
        b.bicicleta_id,
        b.cliente_id,
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
        f.url_archivo AS foto_url
      FROM admin.bicicletas b
      LEFT JOIN LATERAL (
        SELECT url_archivo
        FROM admin.bicicleta_fotos
        WHERE bicicleta_id = b.bicicleta_id AND (activo = true OR activo IS NULL)
        ORDER BY es_principal DESC, bicicleta_foto_id DESC
        LIMIT 1
      ) f ON true
      WHERE b.cliente_id = $1 AND b.fecha_eliminacion IS NULL
      ORDER BY b.bicicleta_id DESC
    `, [clienteId]);

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

    const mappedBikes = (bicicletas || []).map((b: any) => ({
      ...b,
      foto_url: (b.foto_url && !b.foto_url.includes("default.png")) ? b.foto_url : getFallbackPhotoUrl(b.tipo_bicicleta)
    }));

    return NextResponse.json({
      id: cliente.cliente_id,
      ...cliente,
      bicicletas: mappedBikes
    });
  } catch (error: any) {
    console.error("Error in GET /api/crm/clientes/[id]:", error);
    return NextResponse.json({ error: error.message || "Error al obtener cliente" }, { status: 500 });
  }
}

// PUT /api/crm/clientes/[id]
export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const clienteId = parseInt(id, 10);

    if (isNaN(clienteId)) {
      return NextResponse.json({ error: "ID de cliente inválido." }, { status: 400 });
    }

    const body = await req.json();

    const nombre = (body.nombre || '').trim();
    const apellido = (body.apellido || '').trim();
    const tipo_cliente = (body.tipo_cliente || 'PERSONA').trim().toUpperCase();
    const identificacion = (body.identificacion || '').trim();
    const telefono_principal = (body.telefono_principal || '').trim();
    const telefono_secundario = (body.telefono_secundario || '').trim();
    const correo = (body.correo || '').trim().toLowerCase();
    const direccion = (body.direccion || '').trim();
    const ciudad = (body.ciudad || '').trim();
    const provincia = (body.provincia || '').trim();
    const pais = (body.pais || 'República Dominicana').trim();
    const fecha_nacimiento = body.fecha_nacimiento ? String(body.fecha_nacimiento).substring(0, 10) : null;
    const genero = (body.genero || '').trim();
    const contacto_whatsapp = Boolean(body.contacto_whatsapp);
    const contacto_email = Boolean(body.contacto_email);
    const notas = (body.notas || '').trim();

    if (!nombre) {
      return NextResponse.json({ error: "El Nombre del cliente es obligatorio." }, { status: 400 });
    }
    if (!['PERSONA', 'EMPRESA'].includes(tipo_cliente)) {
      return NextResponse.json({ error: "Debe seleccionar el tipo de cliente." }, { status: 400 });
    }
    if (!telefono_principal) {
      return NextResponse.json({ error: "El Teléfono Principal es obligatorio." }, { status: 400 });
    }
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return NextResponse.json({ error: "El formato de Correo Electrónico es inválido." }, { status: 400 });
    }
    if (ciudad && ciudad.length > 100) {
      return NextResponse.json({ error: "La Ciudad no puede exceder los 100 caracteres." }, { status: 400 });
    }

    // Duplicate email check
    if (correo) {
      const existing = await query(`
        SELECT cliente_id FROM admin.clientes
        WHERE LOWER(correo) = $1 AND cliente_id <> $2 AND fecha_eliminacion IS NULL
      `, [correo, clienteId]);
      if (existing && existing.length > 0) {
        return NextResponse.json({ error: "Ya existe otro cliente registrado con este correo electrónico." }, { status: 400 });
      }
    }

    const nombre_completo = `${nombre} ${apellido}`.trim();

    const sql = `
      UPDATE admin.clientes SET
        nombre = $1,
        apellido = $2,
        nombre_completo = $3,
        tipo_cliente = $4,
        identificacion = $5,
        telefono_principal = $6,
        telefono_secundario = $7,
        correo = $8,
        direccion = $9,
        ciudad = $10,
        provincia = $11,
        pais = $12,
        fecha_nacimiento = CASE WHEN $13 IS NULL OR $13 = '' THEN NULL ELSE $13::date END,
        genero = $14,
        contacto_whatsapp = $15::boolean,
        contacto_email = $16::boolean,
        notas = $17,
        fecha_modificacion = NOW()
      WHERE cliente_id = $18::integer AND fecha_eliminacion IS NULL
      RETURNING *
    `;

    const params = [
      nombre,
      apellido || null,
      nombre_completo,
      tipo_cliente,
      identificacion || null,
      telefono_principal,
      telefono_secundario || null,
      correo || null,
      direccion || null,
      ciudad || null,
      provincia || null,
      pais,
      fecha_nacimiento || null,
      genero || null,
      contacto_whatsapp,
      contacto_email,
      notas || null,
      clienteId
    ];

    const result = await query(sql, params);
    if (!result || result.length === 0) {
      return NextResponse.json({ error: "No se pudo actualizar el cliente." }, { status: 404 });
    }

    const r = result[0];
    return NextResponse.json({
      id: r.cliente_id,
      cliente_id: r.cliente_id,
      ...r
    });

  } catch (error: any) {
    console.error("Error in PUT /api/crm/clientes/[id]:", error);
    return NextResponse.json({ error: error.message || "Error al actualizar cliente" }, { status: 500 });
  }
}

// DELETE /api/crm/clientes/[id]
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const clienteId = parseInt(id, 10);

    if (isNaN(clienteId)) {
      return NextResponse.json({ error: "ID de cliente inválido." }, { status: 400 });
    }

    const sql = `
      UPDATE admin.clientes SET
        activo = false,
        fecha_eliminacion = NOW()
      WHERE cliente_id = $1
      RETURNING *
    `;

    const result = await query(sql, [clienteId]);
    if (!result || result.length === 0) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ message: "Cliente eliminado correctamente.", cliente_id: clienteId });

  } catch (error: any) {
    console.error("Error in DELETE /api/crm/clientes/[id]:", error);
    return NextResponse.json({ error: error.message || "Error al eliminar cliente" }, { status: 500 });
  }
}
