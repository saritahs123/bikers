import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { recordUserActivity, recordUserAudit, sanitizeAuditPayload } from "@/lib/auditLogger";

// GET /api/crm/bicicletas
export async function GET(req: Request) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("BICICLETA", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para ver el catálogo de bicicletas." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const clienteIdParam = searchParams.get("clienteId") || searchParams.get("cliente_id");

    let whereClause = `WHERE c.empresa_id = $1 AND b.fecha_eliminacion IS NULL`;
    const params: any[] = [session.empresa_id];

    if (clienteIdParam) {
      const parsedClienteId = parseInt(clienteIdParam, 10);
      if (!isNaN(parsedClienteId)) {
        whereClause += ` AND b.cliente_id = $2`;
        params.push(parsedClienteId);
      }
    }

    const sql = `
      SELECT 
        b.bicicleta_id AS id,
        b.bicicleta_id,
        b.cliente_id,
        c.empresa_id,
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
      JOIN admin.clientes c ON b.cliente_id = c.cliente_id
      LEFT JOIN LATERAL (
        SELECT url_archivo
        FROM admin.bicicleta_fotos
        WHERE bicicleta_id = b.bicicleta_id AND (activo = true OR activo IS NULL)
        ORDER BY es_principal DESC, bicicleta_foto_id DESC
        LIMIT 1
      ) f ON true
      ${whereClause}
      ORDER BY b.bicicleta_id DESC
    `;

    const rows = await query(sql, params);

    const mapped = (rows || []).map((r: any) => ({
      id: r.bicicleta_id,
      bicicleta_id: r.bicicleta_id,
      cliente_id: r.cliente_id,
      empresa_id: r.empresa_id,
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
      salud: null,
      activo: r.activo !== false,
      fecha_creacion: r.fecha_creacion ? String(r.fecha_creacion).substring(0, 10) : null
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("Error in GET /api/crm/bicicletas:", error);
    return NextResponse.json({ error: error?.message || "Error al obtener bicicletas" }, { status: 500 });
  }
}

// POST /api/crm/bicicletas
export async function POST(req: Request) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("BICICLETA", session.usuario_id);
    if (!perms.puede_crear) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para crear bicicletas." }, { status: 403 });
    }

    const body = await req.json();
    const {
      cliente_id,
      marca,
      modelo,
      tipo_bicicleta,
      ano,
      color,
      talla,
      numero_serie_cuadro,
      descripcion,
      kilometraje_actual,
      notas_tecnicas
    } = body;

    // Strict Validations
    if (!cliente_id) {
      return NextResponse.json({ error: "El cliente propietario es obligatorio." }, { status: 400 });
    }
    if (!marca || !marca.trim()) {
      return NextResponse.json({ error: "La marca de la bicicleta es obligatoria." }, { status: 400 });
    }
    if (!modelo || !modelo.trim()) {
      return NextResponse.json({ error: "El modelo de la bicicleta es obligatorio." }, { status: 400 });
    }

    // Verify client belongs to current empresa
    const clientCheck = await query(`
      SELECT cliente_id, nombre_completo FROM admin.clientes
      WHERE cliente_id = $1 AND empresa_id = $2 AND fecha_eliminacion IS NULL
    `, [cliente_id, session.empresa_id]);

    if (!clientCheck || clientCheck.length === 0) {
      return NextResponse.json({ error: "El cliente seleccionado no existe o no pertenece a su empresa." }, { status: 404 });
    }

    // Generate QR Codes
    const countRows = await query(`SELECT COUNT(*) AS total FROM admin.bicicletas`);
    const nextId = parseInt(countRows?.[0]?.total || "0", 10) + 1;
    const randomCode = Math.floor(100000 + Math.random() * 900000);
    const codigo_qr = `BF-QR-${nextId}-${randomCode}`;
    const url_qr = `/qr/bike/${codigo_qr}`;

    const sql = `
      INSERT INTO admin.bicicletas (
        bicicleta_id,
        cliente_id,
        codigo_qr,
        url_qr,
        marca,
        modelo,
        tipo_bicicleta,
        ano,
        color,
        talla,
        numero_serie_cuadro,
        descripcion,
        kilometraje_actual,
        notas_tecnicas,
        activo,
        fecha_creacion,
        usuario_creacion
      )
      VALUES (
        (SELECT COALESCE(MAX(bicicleta_id), 0) + 1 FROM admin.bicicletas),
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, NOW(), $14
      )
      RETURNING *
    `;

    const params = [
      cliente_id,
      codigo_qr,
      url_qr,
      marca.trim(),
      modelo.trim(),
      tipo_bicicleta ? tipo_bicicleta.trim() : 'MTB',
      ano ? parseInt(ano, 10) : new Date().getFullYear(),
      color ? color.trim() : null,
      talla ? talla.trim() : null,
      numero_serie_cuadro ? numero_serie_cuadro.trim() : null,
      descripcion ? descripcion.trim() : null,
      kilometraje_actual ? parseInt(kilometraje_actual, 10) : 0,
      notas_tecnicas ? notas_tecnicas.trim() : null,
      session.usuario_id
    ];

    const result = await query(sql, params);
    const r = result[0] || {};

    // Update customer's bike count
    await query(`
      UPDATE admin.clientes
      SET cantidad_bicicletas = (
        SELECT COUNT(*)::integer FROM admin.bicicletas WHERE cliente_id = $1 AND fecha_eliminacion IS NULL
      )
      WHERE cliente_id = $1 AND empresa_id = $2
    `, [cliente_id, session.empresa_id]);

    const bikeData = {
      id: r.bicicleta_id || nextId,
      bicicleta_id: r.bicicleta_id || nextId,
      cliente_id: r.cliente_id || cliente_id,
      marca: r.marca || marca,
      modelo: r.modelo || modelo,
      tipo_bicicleta: r.tipo_bicicleta || tipo_bicicleta,
      ano: r.ano || ano,
      color: r.color || color,
      talla: r.talla || talla,
      numero_serie_cuadro: r.numero_serie_cuadro || numero_serie_cuadro,
      salud: null,
      activo: true,
      fecha_creacion: r.fecha_creacion || new Date().toISOString()
    };

    // Forensic Activity & Audit Logging
    await recordUserActivity({
      userId: session.usuario_id,
      modulo: "BICICLETA",
      evento: "BICYCLE_CREATED",
      descripcion: `Registro de bicicleta ${marca} ${modelo} (ID: ${bikeData.bicicleta_id}) para el cliente ${clientCheck[0].nombre_completo}`,
      req
    });

    await recordUserAudit({
      userId: session.usuario_id,
      adminId: session.usuario_id,
      accion: "CRM_BICYCLE_CREATED",
      valorAnterior: null,
      valorNuevo: JSON.stringify(sanitizeAuditPayload({
        bicicleta_id: bikeData.bicicleta_id,
        cliente_id: bikeData.cliente_id,
        marca: bikeData.marca,
        modelo: bikeData.modelo,
        tipo_bicicleta: bikeData.tipo_bicicleta,
        ano: bikeData.ano,
        numero_serie_cuadro: bikeData.numero_serie_cuadro
      })),
      motivo: `Creación de nueva bicicleta ID ${bikeData.bicicleta_id}`,
      req
    });

    return NextResponse.json(bikeData);
  } catch (error: any) {
    console.error("Error in POST /api/crm/bicicletas:", error);
    return NextResponse.json({ error: error?.message || "Error al crear la bicicleta" }, { status: 500 });
  }
}
