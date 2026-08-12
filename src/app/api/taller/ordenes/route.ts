import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/taller/ordenes
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const estadoId = searchParams.get("estado_id") || "";
    const prioridadId = searchParams.get("prioridad_id") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;

    const whereConditions: string[] = ["ot.activo = true"];
    const queryParams: any[] = [];

    if (search) {
      queryParams.push(`%${search}%`);
      whereConditions.push(`(
        ot.codigo_orden ILIKE $${queryParams.length} OR
        r.codigo_recepcion ILIKE $${queryParams.length} OR
        c.nombre_completo ILIKE $${queryParams.length} OR
        b.marca ILIKE $${queryParams.length} OR
        b.modelo ILIKE $${queryParams.length} OR
        b.numero_serie_cuadro ILIKE $${queryParams.length}
      )`);
    }

    if (estadoId) {
      queryParams.push(parseInt(estadoId, 10));
      whereConditions.push(`ot.estado_orden_id = $${queryParams.length}`);
    }

    if (prioridadId) {
      queryParams.push(parseInt(prioridadId, 10));
      whereConditions.push(`ot.prioridad_orden_id = $${queryParams.length}`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    // Count Total
    const countSql = `
      SELECT COUNT(*) as total
      FROM admin.ordenes_trabajo ot
      LEFT JOIN admin.recepciones r ON ot.recepcion_id = r.recepcion_id
      LEFT JOIN admin.clientes c ON COALESCE(ot.cliente_id, r.cliente_id) = c.cliente_id
      LEFT JOIN admin.bicicletas b ON COALESCE(ot.bicicleta_id, r.bicicleta_id) = b.bicicleta_id
      ${whereClause}
    `;
    const countRes = await query(countSql, queryParams);
    const total = parseInt(countRes[0]?.total || "0", 10);

    // Fetch Items
    const sql = `
      SELECT 
        ot.orden_trabajo_id AS orden_id,
        ot.codigo_orden,
        ot.recepcion_id,
        r.codigo_recepcion,
        ot.estado_orden_id,
        eot.nombre AS estado_nombre,
        eot.codigo AS estado_codigo,
        eot.orden_visual AS estado_orden,
        ot.prioridad_orden_id AS prioridad_id,
        pot.nombre AS prioridad_nombre,
        pot.color_estado AS prioridad_color,
        ot.fecha_recepcion AS fecha_ingreso,
        ot.fecha_entrega_estimada AS fecha_prometida,
        ot.fecha_inicio_trabajo AS fecha_inicio,
        ot.fecha_finalizacion AS fecha_termino,
        ot.diagnostico_inicial,
        ot.observacion_interna AS observaciones,
        COALESCE(c.cliente_id, r.cliente_id) AS cliente_id,
        COALESCE(c.nombre_completo, 'Cliente General') AS cliente_nombre,
        c.telefono_principal AS cliente_telefono,
        COALESCE(b.bicicleta_id, r.bicicleta_id) AS bicicleta_id,
        COALESCE(b.marca, 'Bicicleta') AS bicicleta_marca,
        COALESCE(b.modelo, 'Sin Modelo') AS bicicleta_modelo,
        b.ano AS bicicleta_ano,
        b.numero_serie_cuadro AS bicicleta_serie,
        COALESCE(ot.total_orden, ot.subtotal_general, 0) AS total_estimado,
        (SELECT COUNT(*) FROM admin.orden_servicios WHERE orden_trabajo_id = ot.orden_trabajo_id) AS total_servicios,
        (
          SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), ui.correo_electronico, ('Mecánico #' || u.usuario_id::text))
          FROM admin.orden_servicios os
          JOIN admin.usuario u ON os.usuario_id = u.usuario_id
          LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
          WHERE os.orden_trabajo_id = ot.orden_trabajo_id AND os.usuario_id IS NOT NULL AND (os.activo IS DISTINCT FROM false)
          ORDER BY os.orden_servicio_id ASC
          LIMIT 1
        ) AS mecanico_nombre,
        (
          SELECT os.usuario_id
          FROM admin.orden_servicios os
          WHERE os.orden_trabajo_id = ot.orden_trabajo_id AND os.usuario_id IS NOT NULL AND (os.activo IS DISTINCT FROM false)
          ORDER BY os.orden_servicio_id ASC
          LIMIT 1
        ) AS mecanico_usuario_id
      FROM admin.ordenes_trabajo ot
      LEFT JOIN admin.recepciones r ON ot.recepcion_id = r.recepcion_id
      LEFT JOIN admin.clientes c ON COALESCE(ot.cliente_id, r.cliente_id) = c.cliente_id
      LEFT JOIN admin.bicicletas b ON COALESCE(ot.bicicleta_id, r.bicicleta_id) = b.bicicleta_id
      LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
      LEFT JOIN admin.prioridad_orden_trabajo pot ON ot.prioridad_orden_id = pot.prioridad_orden_trabajo_id
      ${whereClause}
      ORDER BY ot.orden_trabajo_id DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    const items = await query(sql, [...queryParams, limit, offset]);

    // Fetch Catalogs for Filters
    const estados = await query(`SELECT estado_orden_id, nombre, codigo, orden_visual AS orden FROM admin.estado_orden_trabajo WHERE activo = true ORDER BY orden_visual ASC`);
    const prioridades = await query(`SELECT prioridad_orden_trabajo_id AS prioridad_id, nombre, codigo, color_estado AS color_hex FROM admin.prioridad_orden_trabajo WHERE activo = true ORDER BY prioridad_orden_trabajo_id ASC`);
    const mecanicos = await query(`
      SELECT 
        u.usuario_id,
        TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)) AS nombre_completo
      FROM admin.usuario u
      LEFT JOIN admin.usuario_identidad ui ON ui.usuario_id = u.usuario_id
      WHERE u.tipo_usuario_id = 2 AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
      ORDER BY ui.nombre, ui.apellido, u.usuario_id
    `);

    return NextResponse.json({
      success: true,
      data: items,
      catalogs: {
        estados,
        prioridades,
        mecanicos
      },
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 1
      }
    });
  } catch (err: any) {
    console.error("GET /api/taller/ordenes Error:", err);
    return NextResponse.json({ error: "Error al obtener las órdenes de trabajo.", details: err.message }, { status: 500 });
  }
}

// POST /api/taller/ordenes
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      recepcion_id,
      prioridad_id,
      mecanico_usuario_id,
      fecha_prometida,
      diagnostico_inicial,
      observaciones,
      servicios_iniciales
    } = body;

    if (!recepcion_id || !prioridad_id) {
      return NextResponse.json(
        { error: "La recepción y la prioridad son campos obligatorios." },
        { status: 400 }
      );
    }

    // Verify reception exists and is not already converted
    const recCheck = await query(`
      SELECT recepcion_id, codigo_recepcion, cliente_id, bicicleta_id, convertido_orden_id
      FROM admin.recepciones
      WHERE recepcion_id = $1 AND activo = true
    `, [parseInt(recepcion_id, 10)]);

    if (recCheck.length === 0) {
      return NextResponse.json({ error: "La recepción especificada no existe." }, { status: 404 });
    }

    const rec = recCheck[0];
    if (rec.convertido_orden_id) {
      return NextResponse.json(
        { error: `Esta recepción ya está vinculada a la Orden de Trabajo ID ${rec.convertido_orden_id}.` },
        { status: 400 }
      );
    }

    // Generate Order Code (OT-YYYYMM-XXXX)
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const seqRes = await query(`SELECT COUNT(*) as count FROM admin.ordenes_trabajo`);
    const nextNum = parseInt(seqRes[0]?.count || "0", 10) + 1;
    const codigo_orden = `OT-${yearMonth}-${String(nextNum).padStart(4, "0")}`;

    // Default initial status: RECEPCIONADA (ID 1)
    const estado_orden_id = 1;
    const usuario_registro = 1; // Default session admin user

    const cleanFecha = (val: any) => {
      if (!val || typeof val !== 'string' || !val.trim()) return null;
      try {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d.toISOString();
      } catch {
        return null;
      }
    };

    // Insert Order using exact schema including orden_trabajo_id primary key
    const insertSql = `
      INSERT INTO admin.ordenes_trabajo (
        orden_trabajo_id,
        codigo_orden,
        recepcion_id,
        cliente_id,
        bicicleta_id,
        estado_orden_id,
        prioridad_orden_id,
        diagnostico_inicial,
        observacion_interna,
        fecha_recepcion,
        fecha_entrega_estimada,
        activo,
        fecha_registro,
        usuario_registro
      ) VALUES (
        (SELECT COALESCE(MAX(orden_trabajo_id), 0) + 1 FROM admin.ordenes_trabajo),
        $1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, true, NOW(), $10
      )
      RETURNING orden_trabajo_id AS orden_id, codigo_orden
    `;

    const orderRes = await query(insertSql, [
      codigo_orden,
      parseInt(recepcion_id, 10),
      rec.cliente_id,
      rec.bicicleta_id,
      estado_orden_id,
      parseInt(prioridad_id, 10),
      diagnostico_inicial || null,
      observaciones || null,
      cleanFecha(fecha_prometida),
      usuario_registro
    ]);

    const createdOrder = orderRes[0];

    // Link reception to new order
    await query(`
      UPDATE admin.recepciones
      SET convertido_orden_id = $1
      WHERE recepcion_id = $2
    `, [createdOrder.orden_id, parseInt(recepcion_id, 10)]);

    // Log status history
    await query(`
      INSERT INTO admin.orden_historial_estado (
        orden_historial_estado_id,
        orden_trabajo_id,
        estado_anterior_id,
        estado_nuevo_id,
        usuario_cambio,
        comentario,
        fecha_cambio
      ) VALUES (
        (SELECT COALESCE(MAX(orden_historial_estado_id), 0) + 1 FROM admin.orden_historial_estado),
        $1, NULL, $2, $3, $4, NOW()
      )
    `, [createdOrder.orden_id, estado_orden_id, usuario_registro, "Creación e ingreso de Orden de Trabajo"]);

    // Insert initial services if provided, assigning selected mechanic if specified
    const mecUserId = mecanico_usuario_id ? parseInt(mecanico_usuario_id, 10) : null;

    if (Array.isArray(servicios_iniciales) && servicios_iniciales.length > 0) {
      for (const servId of servicios_iniciales) {
        const tsRes = await query(`
          SELECT tipo_servicio_id, precio_base
          FROM admin.tipo_servicio
          WHERE tipo_servicio_id = $1
        `, [parseInt(servId, 10)]);

        if (tsRes.length > 0) {
          const precio_acordado = tsRes[0].precio_base;
          await query(`
            INSERT INTO admin.orden_servicios (
              orden_servicio_id,
              orden_trabajo_id,
              tipo_servicio_id,
              estado_orden_servicio_id,
              estado_aprobacion_id,
              precio_unitario,
              cantidad,
              subtotal,
              usuario_id,
              activo,
              fecha_registro,
              usuario_registro
            ) VALUES (
              (SELECT COALESCE(MAX(orden_servicio_id), 0) + 1 FROM admin.orden_servicios),
              $1, $2, 1, 2, $3, 1, $3, $4, true, NOW(), $5
            )
          `, [
            createdOrder.orden_id,
            parseInt(servId, 10),
            precio_acordado,
            mecUserId,
            usuario_registro
          ]);
        }
      }
    } else if (mecUserId) {
      // If no initial services were checked but a mechanic was assigned, create an initial general service entry
      await query(`
        INSERT INTO admin.orden_servicios (
          orden_servicio_id,
          orden_trabajo_id,
          tipo_servicio_id,
          estado_orden_servicio_id,
          estado_aprobacion_id,
          precio_unitario,
          cantidad,
          subtotal,
          usuario_id,
          activo,
          fecha_registro,
          usuario_registro
        ) VALUES (
          (SELECT COALESCE(MAX(orden_servicio_id), 0) + 1 FROM admin.orden_servicios),
          $1, 1, 1, 2, 0, 1, 0, $2, true, NOW(), $3
        )
      `, [
        createdOrder.orden_id,
        mecUserId,
        usuario_registro
      ]);
    }

    return NextResponse.json({
      success: true,
      data: createdOrder,
      message: "Orden de Trabajo creada exitosamente."
    });
  } catch (err: any) {
    console.error("POST /api/taller/ordenes Error:", err);
    return NextResponse.json({
      error: err.message || "Error al crear la orden de trabajo.",
      message: err.message?.includes("convertido_orden_id")
        ? "Esta recepción ya tiene una orden de trabajo asociada."
        : (err.message || "Error al crear la orden de trabajo.")
    }, { status: 500 });
  }
}
