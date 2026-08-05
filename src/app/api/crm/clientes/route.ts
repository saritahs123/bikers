import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/crm/clientes
export async function GET() {
  try {
    const sql = `
      SELECT 
        c.cliente_id AS id,
        c.cliente_id,
        c.nombre,
        c.apellido,
        c.nombre_completo,
        c.tipo_cliente,
        c.identificacion,
        c.telefono_principal,
        c.telefono_secundario,
        c.correo,
        c.direccion,
        c.ciudad,
        c.provincia,
        c.pais,
        c.fecha_nacimiento,
        c.genero,
        c.contacto_whatsapp,
        c.contacto_email,
        c.notas,
        c.cantidad_bicicletas,
        c.total_gastado_taller,
        c.total_gastado_tienda,
        c.ultima_visita,
        c.activo,
        c.fecha_creacion,
        c.usuario_creacion,
        c.fecha_modificacion,
        c.usuario_modificacion
      FROM admin.clientes c
      WHERE (c.activo = true OR c.activo IS NULL) AND c.fecha_eliminacion IS NULL
      ORDER BY c.cliente_id DESC
    `;

    const rows = await query(sql);

    const mapped = (rows || []).map((r: any) => ({
      id: r.cliente_id,
      cliente_id: r.cliente_id,
      nombre: r.nombre || '',
      apellido: r.apellido || '',
      nombre_completo: r.nombre_completo || `${r.nombre || ''} ${r.apellido || ''}`.trim(),
      tipo_cliente: (r.tipo_cliente || 'STANDARD').toUpperCase(),
      identificacion: r.identificacion || '',
      telefono_principal: r.telefono_principal || '',
      telefono_secundario: r.telefono_secundario || '',
      correo: r.correo || '',
      direccion: r.direccion || '',
      ciudad: r.ciudad || '',
      provincia: r.provincia || '',
      pais: r.pais || 'República Dominicana',
      fecha_nacimiento: r.fecha_nacimiento ? String(r.fecha_nacimiento).substring(0, 10) : '',
      genero: r.genero || '',
      contacto_whatsapp: Boolean(r.contacto_whatsapp),
      contacto_email: Boolean(r.contacto_email),
      notas: r.notas || '',
      cantidad_bicicletas: Number(r.cantidad_bicicletas || 0),
      total_gastado_taller: Number(r.total_gastado_taller || 0),
      total_gastado_tienda: Number(r.total_gastado_tienda || 0),
      ultima_visita: r.ultima_visita ? String(r.ultima_visita).substring(0, 10) : null,
      activo: r.activo !== false,
      fecha_creacion: r.fecha_creacion ? String(r.fecha_creacion).substring(0, 10) : null
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("Error in GET /api/crm/clientes:", error);
    return NextResponse.json({ error: error.message || "Error al obtener clientes" }, { status: 500 });
  }
}

// POST /api/crm/clientes
export async function POST(req: Request) {
  try {
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
    const fecha_nacimiento = body.fecha_nacimiento || null;
    const genero = (body.genero || '').trim();
    const contacto_whatsapp = Boolean(body.contacto_whatsapp);
    const contacto_email = Boolean(body.contacto_email);
    const notas = (body.notas || '').trim();

    // Validations
    if (!nombre) {
      return NextResponse.json({ error: "El Nombre del cliente es obligatorio." }, { status: 400 });
    }
    if (nombre.length < 2 || nombre.length > 100) {
      return NextResponse.json({ error: "El Nombre debe tener entre 2 y 100 caracteres." }, { status: 400 });
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

    // Check duplicate email if provided
    if (correo) {
      const existing = await query(`
        SELECT cliente_id FROM admin.clientes
        WHERE LOWER(correo) = $1 AND fecha_eliminacion IS NULL
      `, [correo]);
      if (existing && existing.length > 0) {
        return NextResponse.json({ error: "Ya existe un cliente registrado con este correo electrónico." }, { status: 400 });
      }
    }

    const nombre_completo = `${nombre} ${apellido}`.trim();

    const sql = `
      INSERT INTO admin.clientes (
        nombre, apellido, nombre_completo, tipo_cliente, identificacion,
        telefono_principal, telefono_secundario, correo, direccion, ciudad,
        provincia, pais, fecha_nacimiento, genero, contacto_whatsapp,
        contacto_email, notas, cantidad_bicicletas, total_gastado_taller,
        total_gastado_tienda, activo, fecha_creacion
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, CASE WHEN $13 IS NULL OR $13 = '' THEN NULL ELSE $13::date END, $14, $15::boolean,
        $16::boolean, $17, 0, 0.00,
        0.00, true, NOW()
      )
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
      notas || null
    ];

    const result = await query(sql, params);
    const r = result[0] || {};

    return NextResponse.json({
      id: r.cliente_id,
      cliente_id: r.cliente_id,
      nombre: r.nombre || nombre,
      apellido: r.apellido || apellido,
      nombre_completo: r.nombre_completo || nombre_completo,
      tipo_cliente: r.tipo_cliente || tipo_cliente,
      correo: r.correo || correo,
      telefono_principal: r.telefono_principal || telefono_principal,
      direccion: r.direccion || direccion || "",
      ciudad: r.ciudad || ciudad || "",
      provincia: r.provincia || provincia || "",
      pais: r.pais || pais || "República Dominicana",
      activo: true,
      fecha_creacion: r.fecha_creacion || new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Error in POST /api/crm/clientes:", error);
    return NextResponse.json({ error: error.message || "Error al crear cliente" }, { status: 500 });
  }
}
