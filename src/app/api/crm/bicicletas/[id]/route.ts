import { NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { deleteS3Object } from "@/lib/storage/s3";
import { enqueueS3Cleanup, executeDurableS3Cleanup } from "@/lib/storage/s3CleanupQueue";
import { recordUserActivity, recordUserAudit, computeDiff, sanitizeAuditPayload } from "@/lib/auditLogger";

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
    const salud = null;

    return NextResponse.json({
      id: rawBike.bicicleta_id,
      ...rawBike,
      foto_url,
      salud
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
      SELECT b.*, c.nombre_completo AS cliente_nombre
      FROM admin.bicicletas b
      JOIN admin.clientes c ON b.cliente_id = c.cliente_id
      WHERE b.bicicleta_id = $1 AND c.empresa_id = $2 AND b.fecha_eliminacion IS NULL
    `, [bicicletaId, session.empresa_id]);

    if (!existingBike || existingBike.length === 0) {
      return NextResponse.json({ error: "Bicicleta no encontrada o no pertenece a su empresa." }, { status: 404 });
    }

    const beforeBike = existingBike[0];
    const body = await req.json();

    const cliente_id = parseInt(body.cliente_id, 10);
    const marca = (body.marca || '').trim();
    const modelo = (body.modelo || '').trim();
    const tipo_bicicleta = (body.tipo_bicicleta || 'MTB').trim();
    const ano = body.ano ? parseInt(body.ano, 10) : (beforeBike.ano || new Date().getFullYear());
    const color = (body.color || '').trim();
    const talla = (body.talla || '').trim();
    const numero_serie_cuadro = (body.numero_serie_cuadro || '').trim();
    const descripcion = (body.descripcion || '').trim();
    const kilometraje_actual = body.kilometraje_actual ? parseInt(body.kilometraje_actual, 10) : (beforeBike.kilometraje_actual || 0);
    const notas_tecnicas = (body.notas_tecnicas || '').trim();
    const activo = body.activo !== undefined ? Boolean(body.activo) : (beforeBike.activo !== false);

    if (isNaN(cliente_id)) {
      return NextResponse.json({ error: "Debe seleccionar un cliente propietario." }, { status: 400 });
    }

    // Verify new owner client belongs to company
    const targetClient = await query(`
      SELECT cliente_id, nombre_completo FROM admin.clientes
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
        activo = $12::boolean,
        fecha_modificacion = NOW(),
        usuario_modificacion = $13
      WHERE bicicleta_id = $14 AND fecha_eliminacion IS NULL
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
      activo,
      session.usuario_id,
      bicicletaId
    ];

    const result = await query(sql, params);
    if (!result || result.length === 0) {
      return NextResponse.json({ error: "No se pudo actualizar la bicicleta." }, { status: 404 });
    }

    const updatedBike = result[0];

    // If client_id changed, update count on both former and new client
    if (beforeBike.cliente_id !== updatedBike.cliente_id) {
      await query(`
        UPDATE admin.clientes
        SET cantidad_bicicletas = (SELECT COUNT(*)::int FROM admin.bicicletas WHERE cliente_id = $1 AND fecha_eliminacion IS NULL)
        WHERE cliente_id = $1 AND empresa_id = $2
      `, [beforeBike.cliente_id, session.empresa_id]);

      await query(`
        UPDATE admin.clientes
        SET cantidad_bicicletas = (SELECT COUNT(*)::int FROM admin.bicicletas WHERE cliente_id = $1 AND fecha_eliminacion IS NULL)
        WHERE cliente_id = $1 AND empresa_id = $2
      `, [updatedBike.cliente_id, session.empresa_id]);
    }

    // Compute diff and determine semantic event
    const diff = computeDiff(beforeBike, updatedBike);

    let eventType = "BICYCLE_UPDATED";
    let auditAction = "CRM_BICYCLE_UPDATED";
    if (beforeBike.activo !== false && updatedBike.activo === false) {
      eventType = "BICYCLE_DEACTIVATED";
      auditAction = "CRM_BICYCLE_DEACTIVATED";
    } else if (beforeBike.activo === false && updatedBike.activo === true) {
      eventType = "BICYCLE_REACTIVATED";
      auditAction = "CRM_BICYCLE_REACTIVATED";
    } else if (beforeBike.cliente_id !== updatedBike.cliente_id) {
      eventType = "BICYCLE_OWNER_TRANSFERRED";
      auditAction = "CRM_BICYCLE_OWNER_TRANSFERRED";
    }

    if (diff.hasChanges) {
      await recordUserActivity({
        userId: session.usuario_id,
        modulo: "BICICLETA",
        evento: eventType,
        descripcion: `Actualización de bicicleta ${updatedBike.marca} ${updatedBike.modelo} (ID: ${bicicletaId})`,
        req
      });

      await recordUserAudit({
        userId: session.usuario_id,
        adminId: session.usuario_id,
        accion: auditAction,
        valorAnterior: diff.valorAnterior,
        valorNuevo: diff.valorNuevo,
        motivo: `Modificación de bicicleta ID ${bicicletaId}`,
        req
      });
    }

    return NextResponse.json(updatedBike);

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

    // 1. Verify ownership & tenant in company (Anti-enumeration: 404 for other tenants)
    const bikeRows = await query(`
      SELECT b.*, c.nombre_completo AS cliente_nombre
      FROM admin.bicicletas b
      JOIN admin.clientes c ON b.cliente_id = c.cliente_id
      WHERE b.bicicleta_id = $1 AND c.empresa_id = $2 AND b.fecha_eliminacion IS NULL
    `, [bicicletaId, session.empresa_id]);

    if (!bikeRows || bikeRows.length === 0) {
      return NextResponse.json({ success: false, error: "NOT_FOUND", message: "Bicicleta no encontrada o no pertenece a su empresa." }, { status: 404 });
    }

    const beforeBike = bikeRows[0];
    const cliente_id = beforeBike.cliente_id;

    // 2. Audit workshop dependencies (receptions, work orders, active or historical)
    const recCheck = await query(`
      SELECT COUNT(*)::int AS total FROM admin.recepciones WHERE bicicleta_id = $1
    `, [bicicletaId]);
    const totalReceptions = Number(recCheck[0]?.total || 0);

    const ordersCheck = await query(`
      SELECT COUNT(*)::int AS total FROM admin.ordenes_trabajo WHERE bicicleta_id = $1
    `, [bicicletaId]);
    const totalOrders = Number(ordersCheck[0]?.total || 0);

    // 3. Block physical deletion if workshop history exists -> Semantic HTTP 409
    if (totalReceptions > 0 || totalOrders > 0) {
      await recordUserActivity({
        userId: session.usuario_id,
        modulo: "BICICLETA",
        evento: "BICYCLE_DELETE_BLOCKED",
        descripcion: `Intento de eliminación de bicicleta con historial operativo en taller (ID: ${bicicletaId})`,
        resultado: "DENEGADO",
        req
      });

      return NextResponse.json({
        success: false,
        error: "BIKE_HAS_WORKSHOP_HISTORY",
        code: "BIKE_HAS_WORKSHOP_HISTORY",
        message: "No puedes eliminar esta bicicleta porque posee recepciones u órdenes de trabajo registradas en taller. Puedes desactivarla en su lugar.",
        dependencies: {
          recepciones: totalReceptions,
          ordenes: totalOrders
        }
      }, { status: 409 });
    }

    // 4. Collect S3 photo keys BEFORE DB transaction
    const photoRows = await query<{ ruta_archivo: string | null }>(`
      SELECT ruta_archivo FROM admin.bicicleta_fotos WHERE bicicleta_id = $1
    `, [bicicletaId]);

    const s3KeysToDelete: string[] = (photoRows || [])
      .map(p => p.ruta_archivo || '')
      .filter(k => k && !k.startsWith("http") && !k.startsWith("/storage") && k.includes("/"));

    const cleanupJobs: { cleanupId: number; key: string }[] = [];

    // 5. Execute transactional DB deletion with persistent S3 cleanup enqueue
    await withTransaction(async (client) => {
      // Enqueue S3 cleanup obligations durably BEFORE metadata is dropped
      for (const key of s3KeysToDelete) {
        const cleanupId = await enqueueS3Cleanup(client, {
          empresaId: session.empresa_id,
          objectKey: key,
          modulo: "BICICLETA",
          entidad: "bicicletas",
          entidadId: bicicletaId,
          usuarioId: session.usuario_id
        });
        cleanupJobs.push({ cleanupId, key });
      }

      // Delete child photos in DB
      await client.query(`DELETE FROM admin.bicicleta_fotos WHERE bicicleta_id = $1`, [bicicletaId]);
      
      // Delete child components in DB
      await client.query(`DELETE FROM admin.bicicleta_componentes WHERE bicicleta_id = $1`, [bicicletaId]);
      
      // Delete bicycle record
      const delRes = await client.query(`
        DELETE FROM admin.bicicletas
        WHERE bicicleta_id = $1
        RETURNING bicicleta_id
      `, [bicicletaId]);

      if (!delRes.rows || delRes.rows.length === 0) {
        throw new Error("NOT_FOUND");
      }

      // Update customer's bike count
      if (cliente_id) {
        await client.query(`
          UPDATE admin.clientes
          SET cantidad_bicicletas = (
            SELECT COUNT(*)::integer FROM admin.bicicletas WHERE cliente_id = $1 AND fecha_eliminacion IS NULL
          )
          WHERE cliente_id = $1 AND empresa_id = $2
        `, [cliente_id, session.empresa_id]);
      }
    });

    // 6. Post-COMMIT durable S3 execution
    let s3Succeeded = 0;
    let s3Pending = 0;
    for (const job of cleanupJobs) {
      const s3Res = await executeDurableS3Cleanup(job.cleanupId, job.key);
      if (s3Res.success) {
        s3Succeeded++;
      } else {
        s3Pending++;
      }
    }

    // Forensic logging on successful bicycle deletion
    await recordUserActivity({
      userId: session.usuario_id,
      modulo: "BICICLETA",
      evento: "BICYCLE_DELETED",
      descripcion: `Eliminación física de bicicleta ${beforeBike.marca} ${beforeBike.modelo} (ID: ${bicicletaId})`,
      req
    });

    await recordUserAudit({
      userId: session.usuario_id,
      adminId: session.usuario_id,
      accion: "CRM_BICYCLE_DELETED",
      valorAnterior: JSON.stringify(sanitizeAuditPayload({
        bicicleta_id: beforeBike.bicicleta_id,
        cliente_id: beforeBike.cliente_id,
        marca: beforeBike.marca,
        modelo: beforeBike.modelo,
        tipo_bicicleta: beforeBike.tipo_bicicleta,
        numero_serie_cuadro: beforeBike.numero_serie_cuadro
      })),
      valorNuevo: null,
      motivo: `Eliminación física de bicicleta ID ${bicicletaId} sin historial en taller`,
      req
    });

    return NextResponse.json({
      success: true,
      message: "Bicicleta y sus componentes asociados eliminados correctamente.",
      id: bicicletaId,
      s3Cleanup: s3Pending === 0 ? "ALL_COMPLETED" : "PENDING_RETRY",
      s3Stats: {
        total: cleanupJobs.length,
        succeeded: s3Succeeded,
        pending: s3Pending
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error in DELETE /api/crm/bicicletas/[id]:", error);

    const errorCode = error?.code || error?.cause?.code;
    if (errorCode === "23503") {
      return NextResponse.json({
        success: false,
        error: "BIKE_HAS_DEPENDENCIES",
        code: "BIKE_HAS_DEPENDENCIES",
        message: "No se puede eliminar la bicicleta porque tiene registros asociados en el sistema. Puedes desactivarla en su lugar."
      }, { status: 409 });
    }

    return NextResponse.json({
      success: false,
      error: "SERVER_ERROR",
      message: "No fue posible eliminar la bicicleta. Inténtalo nuevamente."
    }, { status: 500 });
  }
}
