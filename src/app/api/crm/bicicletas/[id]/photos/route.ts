import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession } from "@/lib/workshop-session";
import { getPresignedDownloadUrl, deleteS3Object, verifyS3ObjectMetadata } from "@/lib/storage/s3";

// GET /api/crm/bicicletas/[id]/photos
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const bicicletaId = parseInt(id, 10);

    if (isNaN(bicicletaId)) {
      return NextResponse.json({ error: "ID de bicicleta inválido." }, { status: 400 });
    }

    const rows = await query(`
      SELECT 
        f.bicicleta_foto_id AS id,
        f.bicicleta_foto_id,
        f.bicicleta_id,
        f.bicicleta_componente_id,
        f.tipo_foto,
        f.nombre_archivo,
        f.ruta_archivo,
        f.url_archivo,
        f.descripcion,
        f.fecha_captura,
        f.es_principal,
        f.orden_visual,
        f.activo,
        f.fecha_creacion,
        cat.nombre AS componente_categoria,
        COALESCE(NULLIF(CONCAT(bc.marca, ' ', bc.modelo), ' '), cat.nombre, 'Componente') AS componente_nombre
      FROM admin.bicicleta_fotos f
      LEFT JOIN admin.bicicleta_componentes bc ON f.bicicleta_componente_id = bc.bicicleta_componente_id
      LEFT JOIN admin.categoria_componente cat ON bc.categoria_componente_id = cat.categoria_componente_id
      WHERE f.bicicleta_id = $1 AND (f.activo = true OR f.activo IS NULL)
      ORDER BY f.es_principal DESC, f.orden_visual ASC, f.bicicleta_foto_id DESC
    `, [bicicletaId]);

    const mapped = await Promise.all(
      (rows || []).map(async (r: any) => {
        let finalUrl = r.url_archivo || r.ruta_archivo || '/storage/bicicletas/default.png';
        const keyCandidate = r.ruta_archivo || '';

        // If stored path is an S3 Key structure (e.g. production/1/crm/bicicletas/125/uuid-foto.jpg)
        if (keyCandidate && !keyCandidate.startsWith("http") && !keyCandidate.startsWith("/storage") && keyCandidate.includes("/")) {
          try {
            const { downloadUrl } = await getPresignedDownloadUrl({ key: keyCandidate });
            finalUrl = downloadUrl;
          } catch (e) {
            console.error("Error generating presigned URL for photo:", e);
          }
        }

        return {
          id: r.bicicleta_foto_id ?? r.id,
          bicicleta_foto_id: r.bicicleta_foto_id ?? r.id,
          bicicleta_id: r.bicicleta_id,
          bicicleta_componente_id: r.bicicleta_componente_id || null,
          componente_categoria: r.componente_categoria || null,
          componente_nombre: r.componente_nombre || null,
          tipo_foto: r.tipo_foto || 'GENERAL',
          nombre_archivo: r.nombre_archivo || 'foto.png',
          ruta_archivo: r.ruta_archivo || '',
          url_archivo: finalUrl,
          descripcion: r.descripcion || '',
          fecha_captura: r.fecha_captura ? String(r.fecha_captura) : null,
          es_principal: Boolean(r.es_principal),
          orden_visual: r.orden_visual || 0,
          activo: r.activo !== false,
          fecha_creacion: r.fecha_creacion ? String(r.fecha_creacion) : null
        };
      })
    );

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("Error in GET /api/crm/bicicletas/[id]/photos:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/crm/bicicletas/[id]/photos
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  let objectKeyToRollback: string | null = null;
  try {
    const session = await getWorkshopSession();
    if (!session || !session.usuario_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const { id } = await context.params;
    const bicicletaId = parseInt(id, 10);

    if (isNaN(bicicletaId)) {
      return NextResponse.json({ error: "ID de bicicleta inválido." }, { status: 400 });
    }

    const body = await req.json();
    const objectKey = (body.objectKey || body.object_key || body.ruta_archivo || '').trim();
    const rawUrl = (body.url_archivo || body.url || '').trim();
    let filename = (body.nombre_archivo || `foto_bike_${Date.now()}.png`).trim();
    if (filename.length > 240) filename = filename.substring(0, 235) + ".png";

    const tipo_foto = (body.tipo_foto || 'GENERAL').trim().toUpperCase().substring(0, 30);
    const descripcion = (body.descripcion || '').trim().substring(0, 490);
    const es_principal = Boolean(body.es_principal);
    const bicicleta_componente_id = body.bicicleta_componente_id ? parseInt(body.bicicleta_componente_id, 10) : null;

    if (!objectKey && !rawUrl && !filename) {
      return NextResponse.json({ error: "La fotografía o clave de objeto es obligatoria." }, { status: 400 });
    }

    const ruta_archivo = objectKey || `/storage/bicicletas/${bicicletaId}/${filename}`;
    let clientResponseUrl: string | null = null;

    // HEADOBJECT VERIFICATION BEFORE DB PERSISTENCE
    if (objectKey) {
      objectKeyToRollback = objectKey;

      const meta = await verifyS3ObjectMetadata(objectKey);
      if (!meta.valid) {
        return NextResponse.json({
          error: "S3_VERIFICATION_FAILED",
          message: `Verificación HeadObject fallida: ${meta.error}`
        }, { status: 400 });
      }

      // Check max size limit (10 MB for images)
      if (meta.contentLength > 10 * 1024 * 1024) {
        return NextResponse.json({
          error: "FILE_TOO_LARGE",
          message: "El archivo en S3 supera el tamaño máximo permitido de 10 MB."
        }, { status: 400 });
      }

      // Check allowed MIME type
      const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (meta.contentType && !allowedMimes.includes(meta.contentType.toLowerCase())) {
        return NextResponse.json({
          error: "INVALID_MIME_TYPE",
          message: `El tipo MIME real en S3 (${meta.contentType}) no está permitido.`
        }, { status: 400 });
      }

      // Generate temporary presigned download URL ONLY for HTTP JSON response
      try {
        const { downloadUrl } = await getPresignedDownloadUrl({ key: objectKey });
        clientResponseUrl = downloadUrl;
      } catch (e) {
        console.warn("Could not generate presigned download URL for JSON response:", e);
      }
    } else {
      clientResponseUrl = rawUrl || ruta_archivo;
    }

    if (es_principal) {
      await query(`
        UPDATE admin.bicicleta_fotos
        SET es_principal = false
        WHERE bicicleta_id = $1
      `, [bicicletaId]);
    }

    // PERSISTENCE IN POSTGRESQL:
    // ruta_archivo = objectKey
    // url_archivo = NULL (NO presigned URLs containing X-Amz- are saved to DB!)
    const dbUrlValue: string | null = objectKey ? null : (rawUrl || null);

    try {
      const sql1 = `
        INSERT INTO admin.bicicleta_fotos (
          bicicleta_foto_id, bicicleta_id, bicicleta_componente_id, tipo_foto, nombre_archivo, ruta_archivo, url_archivo,
          descripcion, fecha_captura, es_principal, orden_visual, activo, fecha_creacion
        ) VALUES (
          (SELECT COALESCE(MAX(bicicleta_foto_id), 0) + 1 FROM admin.bicicleta_fotos),
          $1, $2, $3, $4, $5, $6,
          $7, NOW(), $8, 0, true, NOW()
        )
        RETURNING *
      `;

      const res1 = await query(sql1, [
        bicicletaId,
        bicicleta_componente_id,
        tipo_foto,
        filename,
        ruta_archivo,
        dbUrlValue,
        descripcion || null,
        es_principal
      ]);

      const r = res1[0] || {};
      objectKeyToRollback = null; // Successfully persisted

      return NextResponse.json({
        id: r.bicicleta_foto_id ?? r.id,
        bicicleta_foto_id: r.bicicleta_foto_id ?? r.id,
        bicicleta_id: bicicletaId,
        bicicleta_componente_id: r.bicicleta_componente_id ?? bicicleta_componente_id,
        tipo_foto: r.tipo_foto || tipo_foto,
        nombre_archivo: r.nombre_archivo || filename,
        ruta_archivo,
        url_archivo: clientResponseUrl,
        descripcion: r.descripcion || descripcion,
        es_principal: r.es_principal ?? es_principal,
        fecha_creacion: r.fecha_creacion || new Date().toISOString()
      });

    } catch (err1: any) {
      console.warn("POST Try 1 failed, trying fallback query:", err1?.message);

      const sql2 = `
        INSERT INTO admin.bicicleta_fotos (
          bicicleta_id, bicicleta_componente_id, tipo_foto, nombre_archivo, ruta_archivo, url_archivo,
          descripcion, fecha_captura, es_principal, orden_visual, activo, fecha_creacion
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, NOW(), $8, 0, true, NOW()
        )
        RETURNING *
      `;

      const res2 = await query(sql2, [
        bicicletaId,
        bicicleta_componente_id,
        tipo_foto,
        filename,
        ruta_archivo,
        dbUrlValue,
        descripcion || null,
        es_principal
      ]);

      const r2 = res2[0] || {};
      objectKeyToRollback = null; // Successfully persisted

      return NextResponse.json({
        id: r2.bicicleta_foto_id ?? r2.id,
        bicicleta_foto_id: r2.bicicleta_foto_id ?? r2.id,
        bicicleta_id: bicicletaId,
        bicicleta_componente_id: r2.bicicleta_componente_id ?? bicicleta_componente_id,
        tipo_foto: r2.tipo_foto || tipo_foto,
        nombre_archivo: r2.nombre_archivo || filename,
        ruta_archivo,
        url_archivo: clientResponseUrl,
        descripcion: r2.descripcion || descripcion,
        es_principal: r2.es_principal ?? es_principal,
        fecha_creacion: r2.fecha_creacion || new Date().toISOString()
      });
    }

  } catch (error: any) {
    if (objectKeyToRollback) {
      console.warn("Rolling back orphaned S3 object due to DB error:", objectKeyToRollback);
      await deleteS3Object(objectKeyToRollback);
    }
    console.error("Error in POST /api/crm/bicicletas/[id]/photos:", error);
    return NextResponse.json({ error: "Error al guardar fotografía en la base de datos: " + error.message }, { status: 500 });
  }
}

// PUT /api/crm/bicicletas/[id]/photos
export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const bicicletaId = parseInt(id, 10);

    if (isNaN(bicicletaId)) {
      return NextResponse.json({ error: "ID de bicicleta inválido." }, { status: 400 });
    }

    const body = await req.json();
    const photoId = parseInt(body.bicicleta_foto_id || body.id, 10);
    if (isNaN(photoId)) {
      return NextResponse.json({ error: "ID de fotografía inválido." }, { status: 400 });
    }

    const tipo_foto = (body.tipo_foto || 'GENERAL').trim().toUpperCase().substring(0, 30);
    const descripcion = (body.descripcion || '').trim().substring(0, 490);
    const es_principal = Boolean(body.es_principal);
    const bicicleta_componente_id = body.bicicleta_componente_id ? parseInt(body.bicicleta_componente_id, 10) : null;

    if (es_principal) {
      await query(`
        UPDATE admin.bicicleta_fotos
        SET es_principal = false
        WHERE bicicleta_id = $1 AND bicicleta_foto_id <> $2
      `, [bicicletaId, photoId]);
    }

    const sql = `
      UPDATE admin.bicicleta_fotos SET
        tipo_foto = $1,
        descripcion = $2,
        bicicleta_componente_id = $3,
        es_principal = $4,
        fecha_modificacion = NOW()
      WHERE bicicleta_foto_id = $5 AND bicicleta_id = $6
      RETURNING *
    `;

    const result = await query(sql, [
      tipo_foto,
      descripcion || null,
      bicicleta_componente_id,
      es_principal,
      photoId,
      bicicletaId
    ]);

    if (!result || result.length === 0) {
      return NextResponse.json({ error: "Fotografía no encontrada para actualizar." }, { status: 404 });
    }

    return NextResponse.json(result[0]);

  } catch (error: any) {
    console.error("Error in PUT /api/crm/bicicletas/[id]/photos:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/crm/bicicletas/[id]/photos
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const bicicletaId = parseInt(id, 10);

    const { searchParams } = new URL(req.url);
    const photoIdParam = searchParams.get("photoId");

    if (isNaN(bicicletaId) || !photoIdParam) {
      return NextResponse.json({ error: "ID de bicicleta o foto inválido." }, { status: 400 });
    }

    const photoId = parseInt(photoIdParam, 10);

    // Domain-specific ownership check in DB before S3 deletion
    const photoRows = await query(`
      SELECT f.ruta_archivo
      FROM admin.bicicleta_fotos f
      JOIN admin.bicicletas b ON f.bicicleta_id = b.bicicleta_id
      JOIN admin.clientes c ON b.cliente_id = c.cliente_id
      WHERE f.bicicleta_foto_id = $1 AND f.bicicleta_id = $2
    `, [photoId, bicicletaId]);

    if (photoRows && photoRows.length > 0) {
      const keyCandidate = photoRows[0].ruta_archivo || '';
      if (keyCandidate && !keyCandidate.startsWith("http") && !keyCandidate.startsWith("/storage") && keyCandidate.includes("/")) {
        await deleteS3Object(keyCandidate);
      }
    }

    await query(`
      DELETE FROM admin.bicicleta_fotos
      WHERE bicicleta_foto_id = $1 AND bicicleta_id = $2
    `, [photoId, bicicletaId]);

    return NextResponse.json({ message: "Fotografía eliminada permanentemente de S3 y base de datos." });

  } catch (error: any) {
    console.error("Error in DELETE /api/crm/bicicletas/[id]/photos:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
