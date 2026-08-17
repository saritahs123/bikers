import { NextRequest, NextResponse } from "next/server";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { generateObjectKey, getPresignedUploadUrl } from "@/lib/storage/s3";
import { validateUploadParameters } from "@/lib/storage/rules";
import { query } from "@/lib/db";
import { generateUploadToken } from "@/lib/s3";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.usuario_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const empresaId = session.empresa_id;
    if (!empresaId) {
      return NextResponse.json({ error: "FORBIDDEN_COMPANY", message: "No se pudo determinar la empresa del usuario." }, { status: 403 });
    }

    const body = await req.json();
    const { fileName, contentType, size, module, entityType, entityId } = body || {};

    // Validate parameter rules
    const validation = validateUploadParameters({
      fileName,
      contentType,
      size,
      module,
      entityType
    });

    if (!validation.valid) {
      return NextResponse.json({ error: "INVALID_PARAMETERS", message: validation.error }, { status: 400 });
    }

    // Check IAM permission for module
    const cleanMod = String(module).toUpperCase().trim();
    if (cleanMod === "TALLER" || cleanMod === "CRM" || cleanMod === "SEGURIDAD") {
      const perms = await getModulePermissions(cleanMod, session.usuario_id);
      if (!perms.puede_crear && !perms.puede_editar && !perms.puede_ver) {
        return NextResponse.json({ error: "FORBIDDEN", message: `No posee permisos suficientes en el módulo ${module}.` }, { status: 403 });
      }
    }

    // Validate entityId ownership in PostgreSQL before generating URL
    const cleanEntityType = String(entityType).toLowerCase().trim();
    const numericEntityId = entityId ? parseInt(String(entityId), 10) : null;

    if (cleanEntityType === "bicicletas") {
      if (!numericEntityId || isNaN(numericEntityId) || numericEntityId <= 0) {
        return NextResponse.json({
          error: "INVALID_ENTITY_ID",
          message: "Se requiere un ID de bicicleta válido para solicitar la URL firmada de subida."
        }, { status: 400 });
      }

      const existCheck = await query(`
        SELECT b.bicicleta_id, COALESCE(ub.empresa_id, uc.empresa_id) AS empresa_id
        FROM admin.bicicletas b
        LEFT JOIN admin.usuario ub ON b.usuario_creacion = ub.usuario_id
        LEFT JOIN admin.clientes c ON b.cliente_id = c.cliente_id
        LEFT JOIN admin.usuario uc ON c.usuario_creacion = uc.usuario_id
        WHERE b.bicicleta_id = $1 AND (b.activo = true OR b.activo IS NULL)
        LIMIT 1
      `, [numericEntityId]);

      if (!existCheck || existCheck.length === 0) {
        return NextResponse.json({
          error: "BICYCLE_NOT_FOUND",
          message: "La bicicleta especificada no existe en la base de datos."
        }, { status: 404 });
      }

      const bikeCompanyId = existCheck[0].empresa_id;
      if (bikeCompanyId && Number(bikeCompanyId) !== Number(empresaId)) {
        return NextResponse.json({
          error: "FORBIDDEN_COMPANY",
          message: "La bicicleta especificada pertenece a otra empresa."
        }, { status: 403 });
      }
    } else if (numericEntityId && !isNaN(numericEntityId) && numericEntityId > 0) {
      if (cleanEntityType === "recepciones" || cleanEntityType === "evidencias" || cleanEntityType === "checklist") {
        const check = await query(`
          SELECT 1 FROM admin.recepciones r
          LEFT JOIN admin.usuario u ON r.recibido_por_usuario_id = u.usuario_id
          WHERE r.recepcion_id = $1 AND (u.empresa_id = $2 OR u.empresa_id IS NULL OR $2 = 1) AND (r.activo = true OR r.activo IS NULL)
          LIMIT 1
        `, [numericEntityId, empresaId]);

        if (!check || check.length === 0) {
          return NextResponse.json({
            error: "FORBIDDEN_ENTITY",
            message: "La recepción o evidencia especificada no pertenece a su empresa."
          }, { status: 403 });
        }
      } else if (cleanEntityType === "usuarios") {
        const check = await query(`
          SELECT 1 FROM admin.usuario
          WHERE usuario_id = $1 AND (empresa_id = $2 OR $2 = 1)
          LIMIT 1
        `, [numericEntityId, empresaId]);

        if (!check || check.length === 0) {
          return NextResponse.json({
            error: "FORBIDDEN_ENTITY",
            message: "El usuario especificado no pertenece a su empresa."
          }, { status: 403 });
        }
      }
    }

    // Generate structured object key
    const objectKey = generateObjectKey({
      empresaId,
      module,
      entityType,
      entityId,
      fileName
    });

    // Generate presigned upload URL (300 seconds for S3 PUT transfer)
    const { uploadUrl, expiresIn } = await getPresignedUploadUrl({
      key: objectKey,
      contentType
    });

    // Generate 30-minute cryptographic uploadToken for association proof
    const uploadToken = generateUploadToken({
      s3_key: objectKey,
      empresa_id: Number(empresaId),
      usuario_id: Number(session.usuario_id),
      module: String(module),
      entityType: String(entityType),
      mime_type: String(contentType),
      file_size: Number(size),
      original_name: String(fileName),
      expires_at: Date.now() + 30 * 60 * 1000 // 30 minutes
    });

    return NextResponse.json({
      success: true,
      uploadUrl,
      objectKey,
      uploadToken,
      expiresIn
    });

  } catch (error: any) {
    console.error("Error in POST /api/storage/presign-upload:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Error al generar la URL firmada de subida." }, { status: 500 });
  }
}
