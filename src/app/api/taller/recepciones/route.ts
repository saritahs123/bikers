import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { verifyUploadToken, isS3ObjectKey } from "@/lib/s3";
import { verifyS3ObjectMetadata } from "@/lib/storage/s3";

// GET /api/taller/recepciones
export async function GET(req: Request) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "NO_SESSION", message: "No hay sesión activa." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso de lectura para el Módulo de Recepción." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "10", 10)));
    const offset = (page - 1) * limit;
    const estadoId = searchParams.get("estado_id") ? parseInt(searchParams.get("estado_id")!, 10) : null;
    const search = (searchParams.get("search") || "").trim().toLowerCase();

    let whereClause = `WHERE (u.empresa_id = $1 OR u.empresa_id IS NULL OR $1 = 1) AND (r.activo = true OR r.activo IS NULL) AND r.fecha_eliminacion IS NULL`;
    const params: any[] = [session.empresa_id];

    if (estadoId && !isNaN(estadoId)) {
      params.push(estadoId);
      whereClause += ` AND r.estado_recepcion_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      const pIdx = params.length;
      whereClause += ` AND (LOWER(r.codigo_recepcion) LIKE $${pIdx} OR LOWER(c.nombre_completo) LIKE $${pIdx} OR LOWER(b.marca) LIKE $${pIdx} OR LOWER(b.modelo) LIKE $${pIdx})`;
    }

    const countSql = `
      SELECT COUNT(r.recepcion_id)::int as total
      FROM admin.recepciones r
      LEFT JOIN admin.clientes c ON r.cliente_id = c.cliente_id
      LEFT JOIN admin.bicicletas b ON r.bicicleta_id = b.bicicleta_id
      LEFT JOIN admin.usuario u ON r.recibido_por_usuario_id = u.usuario_id
      ${whereClause}
    `;
    const countRows = await query(countSql, params);
    const total = countRows[0]?.total || 0;

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataSql = `
      SELECT r.recepcion_id, r.codigo_recepcion, r.token_seguimiento, r.fecha_recepcion,
             r.fecha_entrega_estimada, r.diagnostico_preliminar, r.observaciones_cliente,
             r.observaciones_recepcion, r.presupuesto_estimado, r.requiere_aprobacion, r.aprobado_cliente,
             c.cliente_id, c.nombre_completo as cliente_nombre, c.telefono_principal as cliente_telefono,
             b.bicicleta_id, CONCAT(b.marca, ' ', b.modelo) as bicicleta_resumen, b.color as bicicleta_color,
             er.estado_recepcion_id, er.nombre as estado_nombre, er.codigo as estado_codigo
      FROM admin.recepciones r
      LEFT JOIN admin.clientes c ON r.cliente_id = c.cliente_id
      LEFT JOIN admin.bicicletas b ON r.bicicleta_id = b.bicicleta_id
      LEFT JOIN admin.estado_recepcion er ON r.estado_recepcion_id = er.estado_recepcion_id
      LEFT JOIN admin.usuario u ON r.recibido_por_usuario_id = u.usuario_id
      ${whereClause}
      ORDER BY r.recepcion_id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const rows = await query(dataSql, params);

    return NextResponse.json({
      success: true,
      data: (rows || []).map((r: any) => ({
        recepcion_id: r.recepcion_id,
        codigo_recepcion: r.codigo_recepcion,
        token_seguimiento: r.token_seguimiento,
        fecha_recepcion: r.fecha_recepcion,
        fecha_entrega_estimada: r.fecha_entrega_estimada,
        diagnostico_preliminar: r.diagnostico_preliminar || "",
        observaciones_cliente: r.observaciones_cliente || "",
        observaciones_recepcion: r.observaciones_recepcion || "",
        presupuesto_estimado: Number(r.presupuesto_estimado || 0),
        requiere_aprobacion: Boolean(r.requiere_aprobacion),
        aprobado_cliente: r.aprobado_cliente,
        cliente_nombre: r.cliente_nombre || "Cliente General",
        bicicleta_resumen: r.bicicleta_resumen || "Bicicleta",
        estado_nombre: r.estado_nombre || "INGRESADO",
        cliente: {
          cliente_id: r.cliente_id,
          nombre_completo: r.cliente_nombre || "Cliente General",
          telefono: r.cliente_telefono || ""
        },
        bicicleta: {
          bicicleta_id: r.bicicleta_id,
          resumen: r.bicicleta_resumen || "Bicicleta",
          color: r.bicicleta_color || ""
        },
        estado: {
          estado_recepcion_id: r.estado_recepcion_id,
          nombre: r.estado_nombre || "INGRESADO",
          codigo: r.estado_codigo || "INGRESADO"
        }
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error("Error in GET /api/taller/recepciones:", error);
    const safeMessage = (error?.message && !error.message.includes("Position:") && !error.message.includes("SQLState"))
      ? error.message
      : "No fue posible obtener las recepciones. Inténtalo nuevamente.";
    return NextResponse.json({ error: safeMessage, message: safeMessage }, { status: 500 });
  }
}

// POST /api/taller/recepciones (Creación atómica de Recepción + Checklist + Firma + Orden de Trabajo Opcional)
export async function POST(req: Request) {
  try {
    const session = await getWorkshopSession();
    if (!session) {
      return NextResponse.json({ error: "NO_SESSION", message: "No hay sesión activa." }, { status: 401 });
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_crear) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No posee permiso de creación en el Módulo de Recepción." }, { status: 403 });
    }

    const body = await req.json();

    const cliente_id = parseInt(body.cliente_id, 10);
    const bicicleta_id = parseInt(body.bicicleta_id, 10);
    const observaciones_cliente = (body.observaciones_cliente || "").trim();
    const observaciones_recepcion = (body.observaciones_recepcion || "").trim();
    const presupuesto_estimado_input = Number(body.presupuesto_estimado || 0);
    const requiere_aprobacion = body.requiere_aprobacion !== false;
    const checklist = Array.isArray(body.checklist) ? body.checklist : [];
    const firma = body.firma || {};

    const generar_orden_trabajo = Boolean(body.generar_orden_trabajo);
    const orden_trabajo_meta = body.orden_trabajo || {};

    const idempotencyKey = (
      req.headers.get("x-idempotency-key") ||
      req.headers.get("idempotency-key") ||
      body.idempotency_key || ""
    ).trim();

    // Check Idempotency Key before starting transaction
    if (idempotencyKey) {
      const existingFirma = await query(
        `SELECT recepcion_id FROM admin.firma_recepcion WHERE documento_hash = $1 LIMIT 1`,
        [`IDEM:${idempotencyKey}`]
      );
      if (existingFirma && existingFirma.length > 0) {
        const existingRecId = existingFirma[0].recepcion_id;
        const recRows = await query(
          `SELECT recepcion_id, codigo_recepcion, convertido_orden_id FROM admin.recepciones WHERE recepcion_id = $1 LIMIT 1`,
          [existingRecId]
        );
        if (recRows && recRows.length > 0) {
          const rec = recRows[0];
          let codigo_orden = null;
          if (rec.convertido_orden_id) {
            const otRows = await query(
              `SELECT codigo_orden FROM admin.ordenes_trabajo WHERE orden_trabajo_id = $1 LIMIT 1`,
              [rec.convertido_orden_id]
            );
            codigo_orden = otRows[0]?.codigo_orden || null;
          }
          return NextResponse.json({
            success: true,
            message: "Recepción procesada previamente (Respuesta idempotente).",
            idempotent: true,
            data: {
              recepcion_id: rec.recepcion_id,
              codigo_recepcion: rec.codigo_recepcion,
              orden_trabajo_id: rec.convertido_orden_id || null,
              codigo_orden
            },
            recepcion_id: rec.recepcion_id,
            codigo_recepcion: rec.codigo_recepcion,
            orden_trabajo_id: rec.convertido_orden_id || null,
            codigo_orden
          }, { status: 200 });
        }
      }
    }

    // Standardize services list
    let servicios: any[] = Array.isArray(body.servicios) ? body.servicios : [];
    if (servicios.length === 0 && body.tipo_servicio_id) {
      servicios = [{
        tipo_servicio_id: parseInt(body.tipo_servicio_id, 10),
        diagnostico_preliminar: (body.diagnostico_preliminar || "").trim(),
        precio_estimado: presupuesto_estimado_input,
        mecanico_usuario_id: body.mecanico_usuario_id || orden_trabajo_meta.mecanico_usuario_id || null
      }];
    }

    // 1. Validations
    if (isNaN(cliente_id) || cliente_id <= 0) {
      return NextResponse.json({ error: "Debe seleccionar un cliente válido." }, { status: 400 });
    }
    if (isNaN(bicicleta_id) || bicicleta_id <= 0) {
      return NextResponse.json({ error: "Debe seleccionar una bicicleta válida." }, { status: 400 });
    }

    if (generar_orden_trabajo && servicios.length === 0) {
      return NextResponse.json({ error: "Debe agregar al menos un servicio para generar la Orden de Trabajo." }, { status: 400 });
    }

    // Validate mandatory mechanic for EVERY service
    for (let idx = 0; idx < servicios.length; idx++) {
      const s = servicios[idx];
      const sMech = s.mecanico_usuario_id ? parseInt(s.mecanico_usuario_id, 10) : null;
      if (!sMech || isNaN(sMech) || sMech <= 0) {
        return NextResponse.json({
          error: `Cada servicio debe tener un mecánico asignado obligatoriamente (Falta en servicio #${idx + 1}).`
        }, { status: 400 });
      }
    }

    // Signature Validation
    const firma_digital = (firma.firma_digital || "").trim();
    const terminos_aceptados = Boolean(firma.terminos_aceptados);
    if (!firma_digital) {
      return NextResponse.json({ error: "La firma digital del cliente es obligatoria." }, { status: 400 });
    }
    if (!terminos_aceptados) {
      return NextResponse.json({ error: "Debe confirmar la aceptación de los términos para continuar." }, { status: 400 });
    }
    if (firma_digital.length > 680000) {
      return NextResponse.json({ error: "La imagen de la firma excede el tamaño máximo permitido (500 KB)." }, { status: 400 });
    }
    if (!firma_digital.startsWith("data:image/png;base64,")) {
      return NextResponse.json({ error: "La firma digital debe ser una imagen PNG en formato Data URL." }, { status: 400 });
    }

    // Verify PNG magic bytes
    try {
      const base64Str = firma_digital.replace("data:image/png;base64,", "");
      const headerBuf = Buffer.from(base64Str.substring(0, 16), "base64");
      if (headerBuf.length < 8 || headerBuf[0] !== 0x89 || headerBuf[1] !== 0x50 || headerBuf[2] !== 0x4e || headerBuf[3] !== 0x47) {
        return NextResponse.json({ error: "La firma digital no es una imagen PNG válida." }, { status: 400 });
      }
    } catch (e) {
      return NextResponse.json({ error: "Formato de firma digital inválido." }, { status: 400 });
    }

    // Check duplicate checklist items
    const itemIds = checklist.map((c: any) => parseInt(c.item_checklist_id, 10)).filter(Boolean);
    const uniqueIds = new Set(itemIds);
    if (itemIds.length !== uniqueIds.size) {
      return NextResponse.json({ error: "Existen ítems duplicados en la evaluación del checklist." }, { status: 400 });
    }

    // Extract headers for signature metadata
    const userAgent = req.headers.get("user-agent") || "Navegador Web";
    const ipFirma = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";

    // Import withTransaction for strict 100% atomic transaction
    const { withTransaction } = await import("@/lib/db");

    const resultData = await withTransaction(async (client) => {
      // Client Check
      const clientRes = await client.query(
        `SELECT cliente_id FROM admin.clientes WHERE cliente_id = $1 AND fecha_eliminacion IS NULL LIMIT 1`,
        [cliente_id]
      );
      if (!clientRes.rows || clientRes.rows.length === 0) {
        throw new Error("El cliente seleccionado no existe en el sistema.");
      }

      // Bike Check
      const bikeRes = await client.query(
        `SELECT bicicleta_id FROM admin.bicicletas WHERE bicicleta_id = $1 AND cliente_id = $2 AND fecha_eliminacion IS NULL LIMIT 1`,
        [bicicleta_id, cliente_id]
      );
      if (!bikeRes.rows || bikeRes.rows.length === 0) {
        throw new Error("La bicicleta seleccionada no pertenece al cliente indicado.");
      }

      // 1. Reception Advisory Locks & Sequences
      await client.query(`SELECT pg_advisory_xact_lock(7001)`);
      const nextRecRows = await client.query(`SELECT COALESCE(MAX(recepcion_id), 0) + 1 as next_id FROM admin.recepciones`);
      const recepcion_id = nextRecRows.rows[0].next_id;

      await client.query(`SELECT pg_advisory_xact_lock(7004)`);
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
      const prefix = `REC-${yearMonth}-`;

      const maxCodeRows = await client.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(codigo_recepcion FROM 12) AS INTEGER)), 0) + 1 as next_seq
         FROM admin.recepciones
         WHERE codigo_recepcion LIKE $1`,
        [`${prefix}%`]
      );
      const nextSeq = maxCodeRows.rows[0].next_seq;
      const seqStr = String(nextSeq).padStart(4, "0");
      const codigo_recepcion = `${prefix}${seqStr}`;

      // Resolve Dynamic Reception Status
      let estado_recepcion_id = 1;
      if (generar_orden_trabajo) {
        const estRes = await client.query(
          `SELECT estado_recepcion_id FROM admin.estado_recepcion WHERE codigo IN ('CONVERTIDO_ORDEN', 'EN_PROCESO') AND activo = true ORDER BY orden_visual ASC LIMIT 1`
        );
        if (estRes.rows.length > 0) estado_recepcion_id = estRes.rows[0].estado_recepcion_id;
      } else {
        const estRes = await client.query(
          `SELECT estado_recepcion_id FROM admin.estado_recepcion WHERE (codigo = 'INGRESADO' OR orden_visual = 1) AND activo = true ORDER BY orden_visual ASC LIMIT 1`
        );
        if (estRes.rows.length > 0) estado_recepcion_id = estRes.rows[0].estado_recepcion_id;
      }

      const primary_tipo_servicio_id = servicios[0]?.tipo_servicio_id ? parseInt(servicios[0].tipo_servicio_id, 10) : (body.tipo_servicio_id ? parseInt(body.tipo_servicio_id, 10) : null);
      const consolidated_diagnostico = servicios.map((s: any) => s.diagnostico_preliminar).filter(Boolean).join("\n") || (body.diagnostico_preliminar || "").trim();

      const total_presupuesto = presupuesto_estimado_input > 0
        ? presupuesto_estimado_input
        : servicios.reduce((sum: number, s: any) => sum + (Number(s.precio_estimado) || 0), 0);

      // Insert Reception
      await client.query(
        `INSERT INTO admin.recepciones (
          recepcion_id, cliente_id, bicicleta_id, estado_recepcion_id, tipo_servicio_id,
          codigo_recepcion, diagnostico_preliminar, observaciones_cliente, observaciones_recepcion,
          presupuesto_estimado, requiere_aprobacion, recibido_por_usuario_id, activo, fecha_creacion, usuario_creacion
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, true, NOW(), $12
        )`,
        [
          recepcion_id, cliente_id, bicicleta_id, estado_recepcion_id, primary_tipo_servicio_id,
          codigo_recepcion, consolidated_diagnostico || null, observaciones_cliente || null, observaciones_recepcion || null,
          total_presupuesto, requiere_aprobacion, session.usuario_id
        ]
      );

      // 2. Insert Checklist Items
      await client.query(`SELECT pg_advisory_xact_lock(7002)`);
      for (let idx = 0; idx < checklist.length; idx++) {
        const item = checklist[idx];
        const item_checklist_id = parseInt(item.item_checklist_id, 10);
        const estado_checklist_id = parseInt(item.estado_checklist_id, 10);
        const observacion = (item.observacion || "").trim();
        const requiere_trabajo = Boolean(item.requiere_trabajo);
        const objectKey = String(item.object_key || item.s3_key || item.ruta_archivo || "").trim();
        const uploadToken = String(item.upload_token || item.uploadToken || "").trim();

        const hasEvidence = item.evidencia_foto === true || Boolean(objectKey) || Boolean(uploadToken);

        let ruta_archivo: string | null = null;
        let nombre_archivo: string | null = (item.filename || item.nombre_archivo || "").trim() || null;
        let evidencia_foto = false;

        if (hasEvidence) {
          if (!objectKey || !isS3ObjectKey(objectKey)) {
            throw new Error("No se permite la subida en formato legacy. Las evidencias nuevas deben utilizar almacenamiento S3.");
          }
          if (!uploadToken) {
            throw new Error("Se requiere un token de evidencia firmado para asociar un objeto S3.");
          }

          const tokenPayload = verifyUploadToken(uploadToken);
          if (!tokenPayload) {
            throw new Error("El token de la imagen de evidencia es inválido o ha expirado.");
          }

          const meta = await verifyS3ObjectMetadata(objectKey);
          if (!meta.valid) {
            throw new Error(`Verificación HeadObject fallida para evidencia: ${meta.error}`);
          }

          evidencia_foto = true;
          ruta_archivo = objectKey;
          nombre_archivo = tokenPayload.original_name || nombre_archivo || "evidencia.jpg";
        }

        const nextChkRows = await client.query(`SELECT COALESCE(MAX(recepcion_checklist_id), 0) + 1 as next_id FROM admin.recepcion_checklist`);
        const recepcion_checklist_id = nextChkRows.rows[0].next_id;

        await client.query(
          `INSERT INTO admin.recepcion_checklist (
            recepcion_checklist_id, recepcion_id, item_checklist_id, estado_checklist_id,
            observacion, requiere_trabajo, evidencia_foto, nombre_archivo, ruta_archivo, url_archivo,
            orden_visual, usuario_evaluacion, activo, usuario_registro
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8, $9, NULL,
            $10, $11, true, $11
          )`,
          [
            recepcion_checklist_id, recepcion_id, item_checklist_id, estado_checklist_id,
            observacion || null, requiere_trabajo, evidencia_foto, nombre_archivo, ruta_archivo,
            idx + 1, session.usuario_id
          ]
        );
      }

      // 3. Insert Signature
      await client.query(`SELECT pg_advisory_xact_lock(7003)`);
      const nextFrmRows = await client.query(`SELECT COALESCE(MAX(firma_recepcion_id), 0) + 1 as next_id FROM admin.firma_recepcion`);
      const firma_recepcion_id = nextFrmRows.rows[0].next_id;

      const docHash = idempotencyKey ? `IDEM:${idempotencyKey}` : `SHA256:${codigo_recepcion}:${Date.now()}`;

      await client.query(
        `INSERT INTO admin.firma_recepcion (
          firma_recepcion_id, recepcion_id, cliente_id, tipo_firma, firma_digital,
          documento_hash, terminos_aceptados, fecha_firma, ip_firma, dispositivo_firma,
          navegador_firma, activo, usuario_creacion
        ) VALUES (
          $1, $2, $3, 'INGRESO', $4,
          $5, $6, NOW(), $7, $8,
          $8, true, $9
        )`,
        [
          firma_recepcion_id, recepcion_id, cliente_id, firma_digital,
          docHash, terminos_aceptados, ipFirma, userAgent.substring(0, 200), session.usuario_id
        ]
      );

      // 4. Optional Work Order Auto-Creation
      let orden_trabajo_id: number | null = null;
      let codigo_orden: string | null = null;

      if (generar_orden_trabajo) {
        await client.query(`SELECT pg_advisory_xact_lock(7005)`);
        const nextOtRows = await client.query(`SELECT COALESCE(MAX(orden_trabajo_id), 0) + 1 as next_id FROM admin.ordenes_trabajo`);
        orden_trabajo_id = nextOtRows.rows[0].next_id;

        await client.query(`SELECT pg_advisory_xact_lock(7006)`);
        const otPrefix = `OT-${yearMonth}-`;
        const maxOtCodeRows = await client.query(
          `SELECT COALESCE(MAX(CAST(SUBSTRING(codigo_orden FROM 11) AS INTEGER)), 0) + 1 as next_seq
           FROM admin.ordenes_trabajo
           WHERE codigo_orden LIKE $1`,
          [`${otPrefix}%`]
        );
        const nextOtSeq = maxOtCodeRows.rows[0].next_seq;
        codigo_orden = `${otPrefix}${String(nextOtSeq).padStart(4, "0")}`;

        // Resolve Work Order Initial State dynamically
        let estado_orden_id = 1;
        const estWoRes = await client.query(
          `SELECT estado_orden_id FROM admin.estado_orden_trabajo WHERE (estado_inicial = true OR codigo = 'RECIBIDA' OR codigo = 'DIAGNOSTICO') AND activo = true ORDER BY orden_visual ASC LIMIT 1`
        );
        if (estWoRes.rows.length > 0) estado_orden_id = estWoRes.rows[0].estado_orden_id;

        // Resolve Work Order Priority dynamically
        let prioridad_orden_id = orden_trabajo_meta.prioridad_id ? parseInt(orden_trabajo_meta.prioridad_id, 10) : null;
        if (!prioridad_orden_id || isNaN(prioridad_orden_id)) {
          const prioRes = await client.query(
            `SELECT prioridad_orden_trabajo_id FROM admin.prioridad_orden_trabajo WHERE (codigo = 'NORMAL' OR nivel = 2) AND activo = true ORDER BY prioridad_orden_trabajo_id ASC LIMIT 1`
          );
          prioridad_orden_id = prioRes.rows[0]?.prioridad_orden_trabajo_id || 2;
        }

        const fecha_prometida = orden_trabajo_meta.fecha_prometida ? orden_trabajo_meta.fecha_prometida : null;
        const obs_interna_ot = (orden_trabajo_meta.observaciones || observaciones_recepcion || "").trim();

        // Calculate initial totals
        let subtotal_servicios = 0;

        // Verify and pre-fetch services prices from admin.tipo_servicio
        const preparedServicesData: any[] = [];

        for (let sIdx = 0; sIdx < servicios.length; sIdx++) {
          const s = servicios[sIdx];
          const s_tipo_id = parseInt(s.tipo_servicio_id, 10);
          if (isNaN(s_tipo_id)) continue;

          const catTypeRes = await client.query(
            `SELECT nombre, precio_base FROM admin.tipo_servicio WHERE tipo_servicio_id = $1 LIMIT 1`,
            [s_tipo_id]
          );

          const typeRow = catTypeRes.rows[0] || {};
          const sName = typeRow.nombre || `Servicio #${s_tipo_id}`;
          const sPrice = s.precio_estimado !== undefined && s.precio_estimado !== null && s.precio_estimado !== ""
            ? Number(s.precio_estimado)
            : Number(typeRow.precio_base || 0);

          subtotal_servicios += sPrice;

          const sMech = s.mecanico_usuario_id
            ? parseInt(s.mecanico_usuario_id, 10)
            : (orden_trabajo_meta.mecanico_usuario_id ? parseInt(orden_trabajo_meta.mecanico_usuario_id, 10) : null);

          preparedServicesData.push({
            tipo_servicio_id: s_tipo_id,
            nombre: sName,
            precio: sPrice,
            mecanico_usuario_id: sMech && !isNaN(sMech) ? sMech : null,
            diagnostico: (s.diagnostico_preliminar || "").trim() || null
          });
        }

        // Insert Work Order
        await client.query(
          `INSERT INTO admin.ordenes_trabajo (
            orden_trabajo_id, codigo_orden, recepcion_id, cliente_id, bicicleta_id,
            estado_orden_id, prioridad_orden_id, descripcion_cliente, diagnostico_inicial,
            observacion_interna, fecha_recepcion, fecha_entrega_estimada,
            subtotal_servicios, subtotal_general, total_orden,
            usuario_registro, activo, fecha_registro
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, NOW(), $11::timestamptz,
            $12, $12, $12,
            $13, true, NOW()
          )`,
          [
            orden_trabajo_id, codigo_orden, recepcion_id, cliente_id, bicicleta_id,
            estado_orden_id, prioridad_orden_id, observaciones_cliente || null, consolidated_diagnostico || null,
            obs_interna_ot || null, fecha_prometida,
            subtotal_servicios,
            session.usuario_id
          ]
        );

        // Update Reception linkage
        await client.query(
          `UPDATE admin.recepciones SET convertido_orden_id = $1 WHERE recepcion_id = $2`,
          [orden_trabajo_id, recepcion_id]
        );

        // Resolve Initial Work Order Service State and Approval State dynamically
        let estado_orden_servicio_id = 1;
        const estSrvRes = await client.query(
          `SELECT estado_orden_servicio_id FROM admin.estado_orden_servicio WHERE (codigo = 'PENDIENTE' OR estado_orden_servicio_id = 1) ORDER BY estado_orden_servicio_id ASC LIMIT 1`
        );
        if (estSrvRes.rows.length > 0) estado_orden_servicio_id = estSrvRes.rows[0].estado_orden_servicio_id;

        let estado_aprobacion_id = 1;
        const estAppRes = await client.query(
          `SELECT estado_aprobacion_id FROM admin.estado_aprobacion WHERE (UPPER(codigo) IN ('APROBADO', 'PENDIENTE', 'NO_REQUERIDO') OR estado_aprobacion_id = 1) ORDER BY estado_aprobacion_id ASC LIMIT 1`
        );
        if (estAppRes.rows.length > 0) estado_aprobacion_id = estAppRes.rows[0].estado_aprobacion_id;

        // Insert Services
        await client.query(`SELECT pg_advisory_xact_lock(7007)`);
        for (let idx = 0; idx < preparedServicesData.length; idx++) {
          const sData = preparedServicesData[idx];

          const nextSrvRows = await client.query(`SELECT COALESCE(MAX(orden_servicio_id), 0) + 1 as next_id FROM admin.orden_servicios`);
          const orden_servicio_id = nextSrvRows.rows[0].next_id;

          await client.query(
            `INSERT INTO admin.orden_servicios (
              orden_servicio_id, orden_trabajo_id, tipo_servicio_id, estado_orden_servicio_id, estado_aprobacion_id,
              secuencia, descripcion_servicio, observacion_tecnica, cantidad,
              precio_unitario, subtotal, usuario_id, usuario_registro, activo, fecha_registro
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, 1,
              $9, $9, $10, $11, true, NOW()
            )`,
            [
              orden_servicio_id, orden_trabajo_id, sData.tipo_servicio_id, estado_orden_servicio_id, estado_aprobacion_id,
              idx + 1, sData.nombre, sData.diagnostico,
              sData.precio, sData.mecanico_usuario_id, session.usuario_id
            ]
          );
        }
      }

      return {
        recepcion_id,
        codigo_recepcion,
        orden_trabajo_id,
        codigo_orden
      };
    });

    return NextResponse.json({
      success: true,
      message: resultData.orden_trabajo_id
        ? "Recepción registrada exitosamente y Orden de Trabajo generada."
        : "Recepción registrada exitosamente con firma y checklist.",
      data: {
        recepcion_id: resultData.recepcion_id,
        codigo_recepcion: resultData.codigo_recepcion,
        orden_trabajo_id: resultData.orden_trabajo_id,
        codigo_orden: resultData.codigo_orden
      },
      recepcion_id: resultData.recepcion_id,
      codigo_recepcion: resultData.codigo_recepcion,
      orden_trabajo_id: resultData.orden_trabajo_id,
      codigo_orden: resultData.codigo_orden
    }, { status: 201 });

  } catch (error: any) {
    console.error("Error in POST /api/taller/recepciones:", error);
    const safeMessage = (error?.message && !error.message.includes("Position:") && !error.message.includes("SQLState"))
      ? error.message
      : "No fue posible registrar la recepción. Inténtalo nuevamente.";
    return NextResponse.json({ error: safeMessage, message: safeMessage }, { status: 500 });
  }
}
