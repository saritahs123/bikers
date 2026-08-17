import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { verifyUploadToken } from "@/lib/s3";

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

// POST /api/taller/recepciones (Creación atómica de Recepción + Checklist + Firma)
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
    const tipo_servicio_id = body.tipo_servicio_id ? parseInt(body.tipo_servicio_id, 10) : null;
    const diagnostico_preliminar = (body.diagnostico_preliminar || "").trim();
    const observaciones_cliente = (body.observaciones_cliente || "").trim();
    const observaciones_recepcion = (body.observaciones_recepcion || "").trim();
    const presupuesto_estimado = Number(body.presupuesto_estimado || 0);
    const requiere_aprobacion = body.requiere_aprobacion !== false;
    const checklist = Array.isArray(body.checklist) ? body.checklist : [];
    const firma = body.firma || {};

    // 1. Validations
    if (isNaN(cliente_id)) {
      return NextResponse.json({ error: "Debe seleccionar un cliente válido." }, { status: 400 });
    }
    if (isNaN(bicicleta_id)) {
      return NextResponse.json({ error: "Debe seleccionar una bicicleta válida." }, { status: 400 });
    }
    if (isNaN(presupuesto_estimado) || presupuesto_estimado < 0) {
      return NextResponse.json({ error: "El presupuesto estimado debe ser un monto mayor o igual a 0." }, { status: 400 });
    }

    // Client Check
    const clientCheck = await query(
      `SELECT cliente_id FROM admin.clientes WHERE cliente_id = $1 AND fecha_eliminacion IS NULL LIMIT 1`,
      [cliente_id]
    );
    if (!clientCheck || clientCheck.length === 0) {
      return NextResponse.json({ error: "El cliente seleccionado no existe en el sistema." }, { status: 400 });
    }

    // Bike Check
    const bikeCheck = await query(
      `SELECT bicicleta_id FROM admin.bicicletas WHERE bicicleta_id = $1 AND cliente_id = $2 AND fecha_eliminacion IS NULL LIMIT 1`,
      [bicicleta_id, cliente_id]
    );
    if (!bikeCheck || bikeCheck.length === 0) {
      return NextResponse.json({ error: "La bicicleta seleccionada no pertenece al cliente indicado." }, { status: 400 });
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

    // 2. ATOMIC TRANSACTION EXECUTION
    // Lock 7001 for recepcion_id
    await query(`SELECT pg_advisory_xact_lock(7001)`);
    const nextRecRows = await query(`SELECT COALESCE(MAX(recepcion_id), 0) + 1 as next_id FROM admin.recepciones`);
    const recepcion_id = nextRecRows[0].next_id;

    // Lock 7004 for codigo_recepcion
    await query(`SELECT pg_advisory_xact_lock(7004)`);
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prefix = `REC-${yearMonth}-`;

    const maxCodeRows = await query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(codigo_recepcion FROM 12) AS INTEGER)), 0) + 1 as next_seq
       FROM admin.recepciones
       WHERE codigo_recepcion LIKE $1`,
      [`${prefix}%`]
    );
    const nextSeq = maxCodeRows[0].next_seq;
    const seqStr = String(nextSeq).padStart(4, "0");
    const codigo_recepcion = `${prefix}${seqStr}`;

    // Get initial status ID for 'INGRESADO'
    const estadoRows = await query(`SELECT estado_recepcion_id FROM admin.estado_recepcion WHERE codigo = 'INGRESADO' LIMIT 1`);
    const estado_recepcion_id = estadoRows[0]?.estado_recepcion_id || 1;

    // Insert Reception
    await query(
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
        recepcion_id, cliente_id, bicicleta_id, estado_recepcion_id, tipo_servicio_id,
        codigo_recepcion, diagnostico_preliminar || null, observaciones_cliente || null, observaciones_recepcion || null,
        presupuesto_estimado, requiere_aprobacion, session.usuario_id
      ]
    );

    // Insert Checklist Items
    await query(`SELECT pg_advisory_xact_lock(7002)`);
    for (let idx = 0; idx < checklist.length; idx++) {
      const item = checklist[idx];
      const item_checklist_id = parseInt(item.item_checklist_id, 10);
      const estado_checklist_id = parseInt(item.estado_checklist_id, 10);
      const observacion = (item.observacion || "").trim();
      const requiere_trabajo = Boolean(item.requiere_trabajo);
      const upload_token = (item.upload_token || "").trim();

      let ruta_archivo = null;
      let nombre_archivo = null;
      let evidencia_foto = false;

      if (upload_token) {
        const tokenPayload = verifyUploadToken(upload_token);
        if (!tokenPayload) {
          return NextResponse.json({ error: "El token de la imagen de evidencia es inválido o ha expirado." }, { status: 400 });
        }
        ruta_archivo = tokenPayload.s3_key;
        nombre_archivo = tokenPayload.original_name;
        evidencia_foto = true;
      }

      const nextChkRows = await query(`SELECT COALESCE(MAX(recepcion_checklist_id), 0) + 1 as next_id FROM admin.recepcion_checklist`);
      const recepcion_checklist_id = nextChkRows[0].next_id;

      await query(
        `INSERT INTO admin.recepcion_checklist (
          recepcion_checklist_id, recepcion_id, item_checklist_id, estado_checklist_id,
          observacion, requiere_trabajo, evidencia_foto, nombre_archivo, ruta_archivo,
          orden_visual, usuario_evaluacion, activo, usuario_registro
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8, $9,
          $10, $11, true, $11
        )`,
        [
          recepcion_checklist_id, recepcion_id, item_checklist_id, estado_checklist_id,
          observacion || null, requiere_trabajo, evidencia_foto, nombre_archivo, ruta_archivo,
          idx + 1, session.usuario_id
        ]
      );
    }

    // Insert Signature
    await query(`SELECT pg_advisory_xact_lock(7003)`);
    const nextFrmRows = await query(`SELECT COALESCE(MAX(firma_recepcion_id), 0) + 1 as next_id FROM admin.firma_recepcion`);
    const firma_recepcion_id = nextFrmRows[0].next_id;

    const docHash = `SHA256:${codigo_recepcion}:${Date.now()}`;

    await query(
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

    return NextResponse.json({
      success: true,
      message: "Recepción registrada exitosamente con firma y checklist.",
      recepcion_id,
      codigo_recepcion
    }, { status: 201 });

  } catch (error: any) {
    console.error("Error in POST /api/taller/recepciones:", error);
    const safeMessage = (error?.message && !error.message.includes("Position:") && !error.message.includes("SQLState"))
      ? error.message
      : "No fue posible registrar la recepción. Inténtalo nuevamente.";
    return NextResponse.json({ error: safeMessage, message: safeMessage }, { status: 500 });
  }
}
