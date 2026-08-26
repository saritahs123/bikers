import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

function cleanFecha(val: any) {
  if (!val || typeof val !== "string" || !val.trim()) return null;
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

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
    const countRows = await query<any>(countSql, params);
    const total = countRows[0]?.total || 0;

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataSql = `
      SELECT r.recepcion_id, r.codigo_recepcion, r.token_seguimiento, r.fecha_recepcion,
             r.fecha_entrega_estimada, r.diagnostico_preliminar, r.observaciones_cliente,
             r.observaciones_recepcion, r.presupuesto_estimado, r.requiere_aprobacion, r.aprobado_cliente,
             r.convertido_orden_id,
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

    const rows = await query<any>(dataSql, params);

    // Fetch dynamic reception metrics (America/Santo_Domingo timezone)
    const metricsRes = await query<any>(`
      SELECT
        COALESCE(
          COUNT(r.recepcion_id) FILTER (
            WHERE timezone('America/Santo_Domingo', r.fecha_recepcion::timestamptz)::date = timezone('America/Santo_Domingo', NOW())::date
          ),
          0
        )::integer AS recepciones_hoy,

        COALESCE(
          COUNT(r.recepcion_id) FILTER (
            WHERE er.codigo IN ('BORRADOR', 'PENDIENTE_FIRMA', 'CONFIRMADA')
          ),
          0
        )::integer AS recepciones_pendientes,

        COALESCE(
          COUNT(r.recepcion_id) FILTER (
            WHERE er.codigo = 'CONVERTIDA_OT'
              AND (r.convertido_orden_id IS NOT NULL OR EXISTS (
                SELECT 1 FROM admin.ordenes_trabajo ot
                WHERE ot.recepcion_id = r.recepcion_id AND ot.activo = true
              ))
          ),
          0
        )::integer AS convertidas_ot
      FROM admin.recepciones r
      JOIN admin.estado_recepcion er ON r.estado_recepcion_id = er.estado_recepcion_id
      LEFT JOIN admin.usuario u ON r.recibido_por_usuario_id = u.usuario_id
      WHERE (u.empresa_id = $1 OR u.empresa_id IS NULL OR $1 = 1)
        AND (r.activo = true OR r.activo IS NULL)
        AND r.fecha_eliminacion IS NULL;
    `, [session.empresa_id]);

    const metricsObj = metricsRes[0] || {
      recepciones_hoy: 0,
      recepciones_pendientes: 0,
      convertidas_ot: 0
    };

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
        convertido_orden_id: r.convertido_orden_id || null,
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
      },
      metricas: {
        recepciones_hoy: Number(metricsObj.recepciones_hoy || 0),
        recepciones_pendientes: Number(metricsObj.recepciones_pendientes || 0),
        convertidas_ot: Number(metricsObj.convertidas_ot || 0)
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

// POST /api/taller/recepciones
export async function POST(req: NextRequest) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.usuario_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión inválida o expirada." },
        { status: 401 }
      );
    }

    const perms = await getModulePermissions("TALLER", session.usuario_id);
    if (!perms.puede_crear) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permiso para registrar recepciones en TALLER." },
        { status: 403 }
      );
    }

    const body = await req.json();

    const cliente_id = parseInt(body.cliente_id, 10);
    const bicicleta_id = parseInt(body.bicicleta_id, 10);

    const observaciones_cliente = (body.observaciones_cliente || "").trim();
    const observaciones_recepcion = (body.observaciones_recepcion || "").trim();
    const presupuesto_estimado_input = body.presupuesto_estimado !== undefined && body.presupuesto_estimado !== null
      ? parseFloat(body.presupuesto_estimado)
      : 0.00;

    const requiere_aprobacion = body.requiere_aprobacion !== undefined ? Boolean(body.requiere_aprobacion) : true;
    const generar_orden_trabajo = body.generar_orden_trabajo !== undefined ? Boolean(body.generar_orden_trabajo) : true;

    const orden_trabajo_meta = body.orden_trabajo || {};
    const prioridad_id_input = orden_trabajo_meta.prioridad_id || body.prioridad_id;
    const obs_interna_ot = (orden_trabajo_meta.observaciones || body.observacion_interna || "").trim();

    const checklist: any[] = Array.isArray(body.checklist) ? body.checklist : [];
    const firma: any = body.firma || {};

    let servicios: any[] = Array.isArray(body.servicios) ? body.servicios : [];
    if (servicios.length === 0 && body.tipo_servicio_id) {
      servicios = [{
        tipo_servicio_id: parseInt(body.tipo_servicio_id, 10),
        diagnostico_preliminar: (body.diagnostico_preliminar || "").trim(),
        precio_estimado: presupuesto_estimado_input,
        bicicleta_componente_id: body.bicicleta_componente_id || null
      }];
    }

    // 1. Basic Validations
    if (isNaN(cliente_id) || cliente_id <= 0) {
      return NextResponse.json({ error: "Debe seleccionar un cliente válido." }, { status: 400 });
    }
    if (isNaN(bicicleta_id) || bicicleta_id <= 0) {
      return NextResponse.json({ error: "Debe seleccionar una bicicleta válida." }, { status: 400 });
    }

    if (generar_orden_trabajo && servicios.length === 0) {
      return NextResponse.json({ error: "Debe agregar al menos un servicio para generar la Orden de Trabajo." }, { status: 400 });
    }

    // Validate Affected Component for each service if provided
    for (let idx = 0; idx < servicios.length; idx++) {
      const s = servicios[idx];
      const compId = s.bicicleta_componente_id ? parseInt(s.bicicleta_componente_id, 10) : null;
      if (compId && !isNaN(compId) && compId > 0) {
        const compCheck = await query<any>(
          `SELECT bicicleta_componente_id
           FROM admin.bicicleta_componentes
           WHERE bicicleta_componente_id = $1
             AND bicicleta_id = $2
             AND (activo IS DISTINCT FROM false)
           LIMIT 1`,
          [compId, bicicleta_id]
        );

        if (!compCheck || compCheck.length === 0) {
          return NextResponse.json({
            error: "INVALID_BICYCLE_COMPONENT",
            message: `El componente seleccionado no pertenece a la bicicleta de esta recepción.`
          }, { status: 400 });
        }
      }
    }

    // Check duplicate checklist items
    const itemIds = checklist.map((c: any) => parseInt(c.item_checklist_id, 10)).filter(Boolean);
    const uniqueIds = new Set(itemIds);
    if (itemIds.length !== uniqueIds.size) {
      return NextResponse.json({ error: "Existen ítems duplicados en la evaluación del checklist." }, { status: 400 });
    }

    // Signature data (Optional, non-blocking)
    const firma_digital = (firma.firma_digital || "").trim();
    const hasValidSignature = Boolean(
      firma_digital &&
      firma.terminos_aceptados &&
      firma_digital.startsWith("data:image/png;base64,") &&
      firma_digital.length <= 680000
    );

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
      const recCodeSeqRes = await client.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(codigo_recepcion FROM 'REC-\\d{6}-(\\d+)') AS INTEGER)), 0) + 1 AS next_seq
         FROM admin.recepciones
         WHERE codigo_recepcion LIKE $1`,
        [`REC-${yearMonth}-%`]
      );
      const nextRecSeq = recCodeSeqRes.rows[0].next_seq;
      const codigo_recepcion = `REC-${yearMonth}-${String(nextRecSeq).padStart(4, "0")}`;

      // Resolve default Reception State
      let estado_recepcion_id = 1;
      const estRecRes = await client.query(
        `SELECT estado_recepcion_id FROM admin.estado_recepcion WHERE (codigo = 'INGRESADO' OR estado_recepcion_id = 1) ORDER BY estado_recepcion_id ASC LIMIT 1`
      );
      if (estRecRes.rows.length > 0) estado_recepcion_id = estRecRes.rows[0].estado_recepcion_id;

      const firstDiag = servicios.length > 0
        ? (servicios[0].diagnostico_preliminar || "").trim()
        : (body.diagnostico_preliminar || "").trim();

      // Insert Reception
      await client.query(
        `INSERT INTO admin.recepciones (
          recepcion_id, cliente_id, bicicleta_id, estado_recepcion_id, tipo_servicio_id,
          codigo_recepcion, fecha_recepcion, diagnostico_preliminar,
          observaciones_cliente, observaciones_recepcion, presupuesto_estimado,
          requiere_aprobacion, recibido_por_usuario_id, activo, fecha_creacion, usuario_creacion
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, NOW(), $7,
          $8, $9, $10,
          $11, $12, true, NOW(), $12
        )`,
        [
          recepcion_id, cliente_id, bicicleta_id, estado_recepcion_id, servicios[0]?.tipo_servicio_id || null,
          codigo_recepcion, firstDiag || null,
          observaciones_cliente || null, observaciones_recepcion || null, presupuesto_estimado_input,
          requiere_aprobacion, session.usuario_id
        ]
      );

      // 2. Insert Checklist Responses
      for (let chkIdx = 0; chkIdx < checklist.length; chkIdx++) {
        const chkItem = checklist[chkIdx];
        const item_checklist_id = parseInt(chkItem.item_checklist_id, 10);
        const estado_checklist_id = parseInt(chkItem.estado_checklist_id, 10);
        if (isNaN(item_checklist_id) || isNaN(estado_checklist_id)) continue;

        const nextChkRows = await client.query(`SELECT COALESCE(MAX(recepcion_checklist_id), 0) + 1 as next_id FROM admin.recepcion_checklist`);
        const recepcion_checklist_id = nextChkRows.rows[0].next_id;

        const s3Path = (chkItem.object_key || chkItem.s3_key || chkItem.ruta_archivo || "").trim() || null;
        const fileName = (chkItem.filename || chkItem.nombre_archivo || "").trim() || null;
        const hasPhoto = Boolean(chkItem.evidencia_foto || s3Path);

        await client.query(
          `INSERT INTO admin.recepcion_checklist (
            recepcion_checklist_id, recepcion_id, item_checklist_id, estado_checklist_id,
            observacion, requiere_trabajo, requiere_aprobacion, evidencia_foto,
            nombre_archivo, ruta_archivo, url_archivo,
            orden_visual, fecha_evaluacion, usuario_evaluacion, activo, fecha_registro, usuario_registro
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, false, $7,
            $8, $9, NULL,
            $10, NOW(), $11, true, NOW(), $11
          )`,
          [
            recepcion_checklist_id, recepcion_id, item_checklist_id, estado_checklist_id,
            (chkItem.observacion || "").trim() || null, Boolean(chkItem.requiere_trabajo), hasPhoto,
            fileName, s3Path,
            chkIdx + 1, session.usuario_id
          ]
        );
      }

      // 3. Insert Signature (Optional, if provided)
      if (hasValidSignature) {
        const nextSigRows = await client.query(`SELECT COALESCE(MAX(firma_recepcion_id), 0) + 1 as next_id FROM admin.firma_recepcion`);
        const firma_recepcion_id = nextSigRows.rows[0].next_id;

        await client.query(
          `INSERT INTO admin.firma_recepcion (
            firma_recepcion_id, recepcion_id, firma_digital, terminos_aceptados,
            version_terminos, ip_registro, user_agent, activo, fecha_registro, usuario_registro
          ) VALUES (
            $1, $2, $3, $4,
            'v1.0', $5, $6, true, NOW(), $7
          )`,
          [
            firma_recepcion_id, recepcion_id, firma_digital, true,
            ipFirma, userAgent, session.usuario_id
          ]
        );
      }

      let generatedWorkOrderInfo: any = null;

      // 4. Auto-Generate Work Order if requested
      if (generar_orden_trabajo) {
        await client.query(`SELECT pg_advisory_xact_lock(7002)`);
        const nextWoRows = await client.query(`SELECT COALESCE(MAX(orden_trabajo_id), 0) + 1 as next_id FROM admin.ordenes_trabajo`);
        const orden_trabajo_id = nextWoRows.rows[0].next_id;

        await client.query(`SELECT pg_advisory_xact_lock(7003)`);
        const woCodeSeqRes = await client.query(
          `SELECT COALESCE(MAX(CAST(SUBSTRING(codigo_orden FROM 'OT-\\d{6}-(\\d+)') AS INTEGER)), 0) + 1 AS next_seq
           FROM admin.ordenes_trabajo
           WHERE codigo_orden LIKE $1`,
          [`OT-${yearMonth}-%`]
        );
        const nextWoSeq = woCodeSeqRes.rows[0].next_seq;
        const codigo_orden = `OT-${yearMonth}-${String(nextWoSeq).padStart(4, "0")}`;

        // Resolve Initial Work Order State (RECIBIDA)
        let estado_orden_id = 1;
        const estWoRes = await client.query(
          `SELECT estado_orden_id FROM admin.estado_orden_trabajo WHERE (codigo = 'RECIBIDA' OR estado_orden_id = 1) ORDER BY orden_visual ASC LIMIT 1`
        );
        if (estWoRes.rows.length > 0) estado_orden_id = estWoRes.rows[0].estado_orden_id;

        // Resolve Priority
        let prioridad_orden_id = 1;
        if (prioridad_id_input && !isNaN(parseInt(prioridad_id_input, 10))) {
          prioridad_orden_id = parseInt(prioridad_id_input, 10);
        } else {
          const prioRes = await client.query(
            `SELECT prioridad_orden_trabajo_id FROM admin.prioridad_orden_trabajo WHERE activo = true ORDER BY prioridad_orden_trabajo_id ASC LIMIT 1`
          );
          if (prioRes.rows.length > 0) prioridad_orden_id = prioRes.rows[0].prioridad_orden_trabajo_id;
        }

        // Consolidated preliminary diagnosis
        const consolidated_diagnostico = servicios.map((s, idx) => {
          const diag = (s.diagnostico_preliminar || "").trim();
          return diag ? `Servicio #${idx + 1}: ${diag}` : null;
        }).filter(Boolean).join(" | ");

        let subtotal_servicios = 0.00;
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

          let compId = s.bicicleta_componente_id ? parseInt(s.bicicleta_componente_id, 10) : null;

          // Atomic creation of new component draft if provided
          if (!compId && s.nuevo_componente) {
            const nc = s.nuevo_componente;
            const catCompId = parseInt(nc.categoria_componente_id, 10);
            const estCompId = parseInt(nc.estado_componente_id || 1, 10);
            const marca = (nc.marca || "").trim();
            const numSerie = (nc.numero_serie || "").trim();

            if (isNaN(catCompId) || catCompId <= 0) {
              const err: any = new Error("Categoría de componente inválida.");
              err.code = "VALIDATION_ERROR";
              err.status = 400;
              throw err;
            }

            // Check if category is already taken on this bicycle
            const existingCatCheck = await client.query(
              `SELECT bicicleta_componente_id FROM admin.bicicleta_componentes
               WHERE bicicleta_id = $1 AND categoria_componente_id = $2 AND fecha_eliminacion IS NULL LIMIT 1`,
              [bicicleta_id, catCompId]
            );

            if (existingCatCheck.rows && existingCatCheck.rows.length > 0) {
              const err: any = new Error("Esta bicicleta ya tiene un componente registrado en la categoría seleccionada.");
              err.code = "BICYCLE_COMPONENT_CATEGORY_EXISTS";
              err.status = 409;
              throw err;
            }

            // Check if serial number already exists on this bike if provided
            if (numSerie) {
              const serialCheck = await client.query(
                `SELECT bicicleta_componente_id FROM admin.bicicleta_componentes
                 WHERE bicicleta_id = $1 AND UPPER(TRIM(numero_serie)) = UPPER(TRIM($2)) AND fecha_eliminacion IS NULL LIMIT 1`,
                [bicicleta_id, numSerie]
              );
              if (serialCheck.rows && serialCheck.rows.length > 0) {
                const err: any = new Error("Ya existe un componente con este número de serie.");
                err.code = "DUPLICATE_COMPONENT_SERIAL";
                err.status = 409;
                throw err;
              }
            }

            // Advisory lock for component ID sequence
            await client.query(`SELECT pg_advisory_xact_lock(7008)`);
            const nextCompRes = await client.query(
              `SELECT COALESCE(MAX(bicicleta_componente_id), 0) + 1 AS next_id FROM admin.bicicleta_componentes`
            );
            const new_comp_id = nextCompRes.rows[0].next_id;

            const insertedComp = await client.query(
              `INSERT INTO admin.bicicleta_componentes (
                bicicleta_componente_id, bicicleta_id, categoria_componente_id, estado_componente_id,
                marca, numero_serie, descripcion, fecha_instalacion, kilometraje_instalacion,
                vigente, activo, fecha_creacion, usuario_creacion
              ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $7, NOW(), 0,
                true, true, NOW(), $8
              ) RETURNING bicicleta_componente_id`,
              [
                new_comp_id,
                bicicleta_id,
                catCompId,
                estCompId,
                marca || null,
                numSerie || null,
                marca || null,
                session.usuario_id
              ]
            );

            compId = insertedComp.rows[0].bicicleta_componente_id;
          } else if (compId && !isNaN(compId) && compId > 0) {
            const compCheck = await client.query(
              `SELECT bicicleta_componente_id
               FROM admin.bicicleta_componentes
               WHERE bicicleta_componente_id = $1
                 AND bicicleta_id = $2
                 AND fecha_eliminacion IS NULL
                 AND (activo IS DISTINCT FROM false)
               LIMIT 1`,
              [compId, bicicleta_id]
            );

            if (!compCheck || compCheck.rows.length === 0) {
              const err: any = new Error("El componente seleccionado no pertenece a la bicicleta de esta recepción.");
              err.code = "INVALID_BICYCLE_COMPONENT";
              err.status = 400;
              throw err;
            }
          }

          preparedServicesData.push({
            tipo_servicio_id: s_tipo_id,
            nombre: sName,
            precio: sPrice,
            bicicleta_componente_id: compId && !isNaN(compId) ? compId : null,
            diagnostico: (s.diagnostico_preliminar || "").trim() || null
          });
        }

        // Insert Work Order initially WITHOUT mechanic (mecanico_id = null)
        await client.query(
          `INSERT INTO admin.ordenes_trabajo (
            orden_trabajo_id, codigo_orden, recepcion_id, cliente_id, bicicleta_id,
            estado_orden_id, prioridad_orden_id, descripcion_cliente, diagnostico_inicial,
            observacion_interna, fecha_recepcion,
            subtotal_servicios, subtotal_general, total_orden,
            mecanico_id, usuario_registro, activo, fecha_registro
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, NOW(),
            $11, $11, $11,
            NULL, $12, true, NOW()
          )`,
          [
            orden_trabajo_id, codigo_orden, recepcion_id, cliente_id, bicicleta_id,
            estado_orden_id, prioridad_orden_id, observaciones_cliente || null, consolidated_diagnostico || null,
            obs_interna_ot || null,
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

        // Verify that all linked components belong to the order's bicycle
        for (const sData of preparedServicesData) {
          if (sData.bicicleta_componente_id) {
            const checkBikeComp = await client.query(
              `SELECT bicicleta_id FROM admin.bicicleta_componentes WHERE bicicleta_componente_id = $1 AND fecha_eliminacion IS NULL`,
              [sData.bicicleta_componente_id]
            );
            if (!checkBikeComp.rows.length || checkBikeComp.rows[0].bicicleta_id !== bicicleta_id) {
              const err: any = new Error("El componente vinculado al servicio no pertenece a la bicicleta de la orden.");
              err.code = "INVALID_BICYCLE_COMPONENT";
              err.status = 400;
              throw err;
            }
          }
        }

        // Insert Services with bicicleta_componente_id and usuario_id = null
        await client.query(`SELECT pg_advisory_xact_lock(7007)`);
        for (let idx = 0; idx < preparedServicesData.length; idx++) {
          const sData = preparedServicesData[idx];

          const nextSrvRows = await client.query(`SELECT COALESCE(MAX(orden_servicio_id), 0) + 1 as next_id FROM admin.orden_servicios`);
          const orden_servicio_id = nextSrvRows.rows[0].next_id;

          await client.query(
            `INSERT INTO admin.orden_servicios (
              orden_servicio_id, orden_trabajo_id, tipo_servicio_id, estado_orden_servicio_id, estado_aprobacion_id,
              secuencia, descripcion_servicio, observacion_tecnica, cantidad,
              precio_unitario, subtotal, bicicleta_componente_id, usuario_id, usuario_registro, activo, fecha_registro
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, 1,
              $9, $9, $10, NULL, $11, true, NOW()
            )`,
            [
              orden_servicio_id, orden_trabajo_id, sData.tipo_servicio_id, estado_orden_servicio_id, estado_aprobacion_id,
              idx + 1, sData.nombre, sData.diagnostico,
              sData.precio, sData.bicicleta_componente_id, session.usuario_id
            ]
          );
        }

        generatedWorkOrderInfo = {
          orden_trabajo_id,
          codigo_orden
        };
      }

      return {
        recepcion_id,
        codigo_recepcion,
        orden_trabajo_id: generatedWorkOrderInfo?.orden_trabajo_id || null,
        codigo_orden: generatedWorkOrderInfo?.codigo_orden || null
      };
    });

    return NextResponse.json(
      {
        success: true,
        message: resultData.orden_trabajo_id
          ? "Recepción registrada exitosamente y Orden de Trabajo generada."
          : "Recepción de bicicleta registrada exitosamente.",
        recepcion_id: resultData.recepcion_id,
        codigo_recepcion: resultData.codigo_recepcion,
        orden_trabajo_id: resultData.orden_trabajo_id,
        codigo_orden: resultData.codigo_orden,
        data: {
          recepcion_id: resultData.recepcion_id,
          codigo_recepcion: resultData.codigo_recepcion,
          orden_trabajo_id: resultData.orden_trabajo_id,
          codigo_orden: resultData.codigo_orden
        }
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/taller/recepciones:", error);

    const isDev = process.env.NODE_ENV !== "production";

    let statusCode = error?.status || 400;
    let errorCode = error?.code || "SERVER_ERROR";
    let message = error?.message || "Ocurrió un error interno al registrar la recepción.";

    if (error?.code === "23505" || error?.message?.includes("uk_bicicleta_componentes")) {
      statusCode = 409;
      errorCode = "BICYCLE_COMPONENT_CATEGORY_EXISTS";
      message = "Esta bicicleta ya tiene un componente registrado en la categoría seleccionada.";
    } else if (error?.code === "BICYCLE_COMPONENT_CATEGORY_EXISTS") {
      statusCode = 409;
      errorCode = "BICYCLE_COMPONENT_CATEGORY_EXISTS";
    } else if (error?.code === "DUPLICATE_COMPONENT_SERIAL") {
      statusCode = 409;
      errorCode = "DUPLICATE_COMPONENT_SERIAL";
    }

    return NextResponse.json(
      {
        success: false,
        error: errorCode,
        message: message,
        ...(isDev ? { dev_details: error?.message, dev_stack: error?.stack } : {})
      },
      { status: statusCode }
    );
  }
}
