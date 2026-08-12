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
      WHERE c.fecha_eliminacion IS NULL
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
      return NextResponse.json({ success: false, message: "El Nombre es obligatorio.", field: "nombre" }, { status: 400 });
    }
    if (nombre.length < 2 || nombre.length > 100) {
      return NextResponse.json({ success: false, message: "El Nombre debe tener entre 2 y 100 caracteres.", field: "nombre" }, { status: 400 });
    }
    if (!['PERSONA', 'EMPRESA'].includes(tipo_cliente)) {
      return NextResponse.json({ success: false, message: "Debe seleccionar el tipo de cliente.", field: "tipo_cliente" }, { status: 400 });
    }
    if (!telefono_principal) {
      return NextResponse.json({ success: false, message: "El Teléfono Principal es obligatorio.", field: "telefono_principal" }, { status: 400 });
    }
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return NextResponse.json({ success: false, message: "El formato del correo electrónico no es válido.", field: "correo" }, { status: 400 });
    }
    if (ciudad && ciudad.length > 100) {
      return NextResponse.json({ success: false, message: "La Ciudad no puede exceder los 100 caracteres.", field: "ciudad" }, { status: 400 });
    }

    // Check duplicate email if provided
    if (correo) {
      const existing = await query(`
        SELECT cliente_id FROM admin.clientes
        WHERE LOWER(correo) = $1 AND fecha_eliminacion IS NULL
      `, [correo]);
      if (existing && existing.length > 0) {
        return NextResponse.json({ success: false, message: "Ya existe un cliente registrado con este correo electrónico", field: "correo_electronico" }, { status: 409 });
      }
    }

    // Clean identificacion digits for storage and duplicate check
    const cleanIdentificacion = identificacion ? identificacion.replace(/\D/g, "") : null;

    // Check duplicate identificacion if provided
    if (cleanIdentificacion) {
      const existingIdent = await query(`
        SELECT cliente_id FROM admin.clientes
        WHERE (identificacion = $1 OR identificacion = $2 OR regexp_replace(identificacion, '[^0-9]', '', 'g') = $2)
          AND fecha_eliminacion IS NULL
      `, [identificacion, cleanIdentificacion]);
      if (existingIdent && existingIdent.length > 0) {
        return NextResponse.json({ success: false, message: "Ya existe un cliente registrado con esta Cédula / RNC", field: "identificacion" }, { status: 409 });
      }
    }

    const nombre_completo = `${nombre} ${apellido}`.trim();

    const maxIdRes = await query("SELECT COALESCE(MAX(cliente_id), 0) + 1 AS next_id FROM admin.clientes");
    const nextId = Number(maxIdRes[0]?.next_id || 1);

    const sql = `
      INSERT INTO admin.clientes (
        cliente_id, nombre, apellido, nombre_completo, tipo_cliente, identificacion,
        telefono_principal, telefono_secundario, correo, direccion, ciudad,
        provincia, pais, fecha_nacimiento, genero, contacto_whatsapp,
        contacto_email, notas, cantidad_bicicletas, total_gastado_taller,
        total_gastado_tienda, activo, fecha_creacion
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, CASE WHEN $14::text IS NULL OR $14::text = '' THEN NULL ELSE $14::date END, $15, $16::boolean,
        $17::boolean, $18, 0, 0.00,
        0.00, true, NOW()
      )
      RETURNING *
    `;

    const params = [
      nextId,
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

    const clientData = {
      id: r.cliente_id || nextId,
      cliente_id: r.cliente_id || nextId,
      nombre: r.nombre || nombre,
      apellido: r.apellido || apellido,
      nombre_completo: r.nombre_completo || nombre_completo,
      tipo_cliente: r.tipo_cliente || tipo_cliente,
      identificacion: r.identificacion || identificacion,
      correo: r.correo || correo,
      telefono_principal: r.telefono_principal || telefono_principal,
      telefono_secundario: r.telefono_secundario || telefono_secundario || "",
      direccion: r.direccion || direccion || "",
      ciudad: r.ciudad || ciudad || "",
      provincia: r.provincia || provincia || "",
      pais: r.pais || pais || "República Dominicana",
      activo: true,
      fecha_creacion: r.fecha_creacion || new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      message: "Cliente registrado correctamente",
      data: clientData,
      ...clientData
    }, { status: 201 });

  } catch (error: any) {
    console.error("Error in POST /api/crm/clientes:", error);
    const msg = error?.message || error?.toString() || "";
    if (msg.includes("23505") || msg.includes("uk_clientes_identificacion") || msg.includes("identificacion")) {
      return NextResponse.json({ success: false, message: "Ya existe un cliente registrado con esta Cédula / Pasaporte", field: "identificacion" }, { status: 409 });
    }
    if (msg.includes("uk_clientes_correo") || msg.includes("correo")) {
      return NextResponse.json({ success: false, message: "Ya existe un cliente registrado con este correo electrónico", field: "correo_electronico" }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: error.message || "No fue posible registrar el cliente" }, { status: 500 });
  }
}
