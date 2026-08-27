import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

// GET /api/crm/bicicletas/[id]
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("BICICLETA", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para consultar esta bicicleta." }, { status: 403 });
    }

    const { id } = await context.params;
    const bicicletaId = parseInt(id, 10);

    if (isNaN(bicicletaId)) {
      return NextResponse.json({ error: "ID de bicicleta inválido." }, { status: 400 });
    }

    const rows = await query(`
      SELECT 
        b.*,
        c.empresa_id,
        c.nombre_completo AS cliente_nombre,
        c.correo AS cliente_correo,
        c.telefono_principal AS cliente_telefono,
        c.tipo_cliente AS cliente_nivel,
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
      WHERE b.bicicleta_id = $1 AND c.empresa_id = $2 AND b.fecha_eliminacion IS NULL
    `, [bicicletaId, session.empresa_id]);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Bicicleta no encontrada." }, { status: 404 });
    }

    const rawBike = rows[0];
    const foto_url = (rawBike.foto_url && !rawBike.foto_url.includes("default.png")) ? rawBike.foto_url : null;

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
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("BICICLETA", session.usuario_id);
    if (!perms.puede_editar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para modificar esta bicicleta." }, { status: 403 });
    }

    const { id } = await context.params;
    const bicicletaId = parseInt(id, 10);

    if (isNaN(bicicletaId)) {
      return NextResponse.json({ error: "ID de bicicleta inválido." }, { status: 400 });
    }

    // Verify existing bicycle belongs to company
    const existingBike = await query(`
      SELECT b.bicicleta_id, b.cliente_id
      FROM admin.bicicletas b
      JOIN admin.clientes c ON b.cliente_id = c.cliente_id
      WHERE b.bicicleta_id = $1 AND c.empresa_id = $2 AND b.fecha_eliminacion IS NULL
    `, [bicicletaId, session.empresa_id]);

    if (!existingBike || existingBike.length === 0) {
      return NextResponse.json({ error: "Bicicleta no encontrada o no pertenece a su empresa." }, { status: 404 });
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

    // Verify new owner client belongs to company
    const targetClient = await query(`
      SELECT cliente_id FROM admin.clientes
      WHERE cliente_id = $1 AND empresa_id = $2 AND fecha_eliminacion IS NULL
    `, [cliente_id, session.empresa_id]);

    if (!targetClient || targetClient.length === 0) {
      return NextResponse.json({ error: "El cliente propietario no existe o no pertenece a su empresa." }, { status: 404 });
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
        fecha_modificacion = NOW(),
        usuario_modificacion = $12
      WHERE bicicleta_id = $13 AND fecha_eliminacion IS NULL
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
      session.usuario_id,
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
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("BICICLETA", session.usuario_id);
    if (!perms.puede_eliminar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para eliminar bicicletas." }, { status: 403 });
    }

    const { id } = await context.params;
    const bicicletaId = parseInt(id, 10);

    if (isNaN(bicicletaId)) {
      return NextResponse.json({ success: false, message: "ID de bicicleta inválido." }, { status: 400 });
    }

    // Verify ownership in company
    const bikeRows = await query(`
      SELECT b.bicicleta_id, b.cliente_id
      FROM admin.bicicletas b
      JOIN admin.clientes c ON b.cliente_id = c.cliente_id
      WHERE b.bicicleta_id = $1 AND c.empresa_id = $2 AND b.fecha_eliminacion IS NULL
    `, [bicicletaId, session.empresa_id]);

    if (!bikeRows || bikeRows.length === 0) {
      return NextResponse.json({ success: false, message: "Bicicleta no encontrada o no pertenece a su empresa." }, { status: 404 });
    }

    const cliente_id = bikeRows[0].cliente_id;

    // Check if bicycle has active work orders or receptions
    const ordersCheck = await query(`
      SELECT COUNT(*)::int AS total FROM admin.ordenes_trabajo WHERE bicicleta_id = $1 AND (activo = true OR activo IS NULL)
    `, [bicicletaId]);
    if (Number(ordersCheck[0]?.total || 0) > 0) {
      return NextResponse.json({
        success: false,
        message: "No se puede eliminar la bicicleta porque tiene órdenes de trabajo registradas."
      }, { status: 409 });
    }

    const recCheck = await query(`
      SELECT COUNT(*)::int AS total FROM admin.recepciones WHERE bicicleta_id = $1 AND (activo = true OR activo IS NULL)
    `, [bicicletaId]);
    if (Number(recCheck[0]?.total || 0) > 0) {
      return NextResponse.json({
        success: false,
        message: "No se puede eliminar la bicicleta porque tiene recepciones de taller asociadas."
      }, { status: 409 });
    }

    // Delete dependent child components and photos first
    await query(`DELETE FROM admin.bicicleta_fotos WHERE bicicleta_id = $1`, [bicicletaId]);
    await query(`DELETE FROM admin.bicicleta_componentes WHERE bicicleta_id = $1`, [bicicletaId]);

    // Perform physical DELETE
    const deleteResult = await query(`
      DELETE FROM admin.bicicletas
      WHERE bicicleta_id = $1
      RETURNING bicicleta_id
    `, [bicicletaId]);

    if (!deleteResult || deleteResult.length === 0) {
      return NextResponse.json({ success: false, message: "Bicicleta no encontrada." }, { status: 404 });
    }

    // Update customer's bike count
    if (cliente_id) {
      await query(`
        UPDATE admin.clientes
        SET cantidad_bicicletas = (
          SELECT COUNT(*)::integer FROM admin.bicicletas WHERE cliente_id = $1 AND fecha_eliminacion IS NULL
        )
        WHERE cliente_id = $1 AND empresa_id = $2
      `, [cliente_id, session.empresa_id]);
    }

    return NextResponse.json({
      success: true,
      message: "Bicicleta eliminada correctamente"
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error in DELETE /api/crm/bicicletas/[id]:", error);

    const errorCode = error?.code || error?.cause?.code;
    if (errorCode === "23503") {
      return NextResponse.json({
        success: false,
        message: "No se puede eliminar la bicicleta porque tiene registros asociados."
      }, { status: 409 });
    }

    return NextResponse.json({
      success: false,
      message: "No fue posible eliminar la bicicleta. Inténtalo nuevamente."
    }, { status: 500 });
  }
}
