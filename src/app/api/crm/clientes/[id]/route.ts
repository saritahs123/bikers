import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/crm/clientes/[id]
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const clienteId = parseInt(id, 10);

    if (isNaN(clienteId)) {
      return NextResponse.json({ error: "ID de cliente inválido." }, { status: 400 });
    }

    const clienteRows = await query(`
      SELECT * FROM admin.clientes
      WHERE cliente_id = $1 AND fecha_eliminacion IS NULL
    `, [clienteId]);

    if (!clienteRows || clienteRows.length === 0) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    const cliente = clienteRows[0];

    // Fetch client's bicycles along with their main photo
    const bicicletas = await query(`
      SELECT 
        b.bicicleta_id AS id,
        b.bicicleta_id,
        b.cliente_id,
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
        f.url_archivo AS foto_url
      FROM admin.bicicletas b
      LEFT JOIN LATERAL (
        SELECT url_archivo
        FROM admin.bicicleta_fotos
        WHERE bicicleta_id = b.bicicleta_id AND (activo = true OR activo IS NULL)
        ORDER BY es_principal DESC, bicicleta_foto_id DESC
        LIMIT 1
      ) f ON true
      WHERE b.cliente_id = $1 AND b.fecha_eliminacion IS NULL
      ORDER BY b.bicicleta_id DESC
    `, [clienteId]);

    const mappedBikes = (bicicletas || []).map((b: any) => ({
      ...b,
      foto_url: (b.foto_url && !b.foto_url.includes("default.png")) ? b.foto_url : null
    }));

    // Fetch work orders (Historial de Mantenimientos) for this client
    const parentOrders = await query(`
      SELECT 
        ot.orden_trabajo_id AS id,
        ot.orden_trabajo_id,
        ot.codigo_orden,
        ot.fecha_recepcion,
        ot.fecha_registro,
        COALESCE(ot.descripcion_cliente, 'Mantenimiento General') AS descripcion_cliente,
        COALESCE(ot.descripcion_cliente, 'Mantenimiento General') AS servicio_realizado,
        COALESCE(ot.diagnostico_inicial, 'Diagnóstico de ingreso registrado') AS diagnostico_inicial,
        ot.diagnostico_inicial AS notas_tecnicas,
        ot.observacion_interna,
        COALESCE(ot.total_orden, 0) AS costo,
        ot.kilometraje_ingreso,
        ot.salud_global_porcentaje,
        ot.bicicleta_id,
        b.marca AS bicicleta_marca,
        b.modelo AS bicicleta_modelo,
        COALESCE(eot.nombre, 'En proceso') AS estado_nombre,
        COALESCE(pot.nombre, 'Normal') AS prioridad_nombre
      FROM admin.ordenes_trabajo ot
      LEFT JOIN admin.bicicletas b ON ot.bicicleta_id = b.bicicleta_id
      LEFT JOIN admin.estado_orden_trabajo eot ON ot.estado_orden_id = eot.estado_orden_id
      LEFT JOIN admin.prioridad_orden_trabajo pot ON ot.prioridad_orden_id = pot.prioridad_orden_trabajo_id
      WHERE ot.cliente_id = $1 AND (ot.activo = true OR ot.activo IS NULL)
      ORDER BY ot.fecha_recepcion DESC, ot.orden_trabajo_id DESC
    `, [clienteId]);

    const orderIds = (parentOrders || []).map((o: any) => o.orden_trabajo_id);
    let subServicesMap: Record<number, any[]> = {};

    if (orderIds.length > 0) {
      const subServicesRows = await query(`
        SELECT 
          os.orden_servicio_id AS id,
          os.orden_servicio_id,
          os.orden_trabajo_id,
          os.secuencia,
          os.descripcion_servicio,
          os.observacion_tecnica,
          COALESCE(os.precio_unitario, 0) AS costo,
          os.bicicleta_componente_id,
          os.nuevo_estado_componente_id,
          ts.nombre AS tipo_servicio_nombre,
          bc.marca AS componente_marca,
          bc.modelo AS componente_modelo,
          cc.nombre AS categoria_nombre,
          nest.nombre AS nuevo_estado_nombre,
          COALESCE(mo_agg.minutos_total, 0) AS minutos_trabajados_total,
          mo_agg.mecanicos_list
        FROM admin.orden_servicios os
        LEFT JOIN admin.tipo_servicio ts ON os.tipo_servicio_id = ts.tipo_servicio_id
        LEFT JOIN admin.bicicleta_componentes bc ON os.bicicleta_componente_id = bc.bicicleta_componente_id
        LEFT JOIN admin.categoria_componente cc ON bc.categoria_componente_id = cc.categoria_componente_id
        LEFT JOIN admin.estado_componente nest ON os.nuevo_estado_componente_id = nest.estado_componente_id
        LEFT JOIN (
          SELECT 
            mo.orden_servicio_id,
            COALESCE(SUM(mo.minutos_trabajados), 0) AS minutos_total,
            ARRAY_AGG(
              DISTINCT CASE 
                WHEN TRIM(COALESCE(ui.nombre, '') || ' ' || COALESCE(ui.apellido, '')) <> '' 
                THEN TRIM(COALESCE(ui.nombre, '') || ' ' || COALESCE(ui.apellido, ''))
                ELSE 'Usuario no disponible'
              END
            ) AS mecanicos_list
          FROM admin.orden_servicio_mano_obra mo
          LEFT JOIN admin.usuario_identidad ui ON mo.usuario_id = ui.usuario_id
          WHERE mo.activo = true OR mo.activo IS NULL
          GROUP BY mo.orden_servicio_id
        ) mo_agg ON os.orden_servicio_id = mo_agg.orden_servicio_id
        WHERE os.orden_trabajo_id IN (${orderIds.join(',')}) AND (os.activo = true OR os.activo IS NULL)
        ORDER BY os.secuencia ASC, os.orden_servicio_id ASC
      `);

      const formatDuracion = (m: number) => {
        const mins = Number(m || 0);
        if (!mins || mins <= 0) return "Sin tiempo registrado";
        const h = Math.floor(mins / 60);
        const remMins = mins % 60;
        if (h === 0) return `${remMins}m`;
        if (remMins === 0) return `${h}h`;
        return `${h}h ${remMins}m`;
      };

      const formatMecanicosData = (arr: any) => {
        let list: string[] = [];
        if (Array.isArray(arr)) {
          list = arr.filter((n: any) => typeof n === 'string' && n.trim() !== '');
        }
        if (list.length === 0) {
          return { label: "Mecánico", text: "Sin mecánico registrado", list: [] };
        }
        if (list.length === 1) {
          return { label: "Mecánico", text: list[0], list };
        }
        if (list.length === 2) {
          return { label: "Mecánicos", text: `${list[0]}, ${list[1]}`, list };
        }
        const mainTwo = list.slice(0, 2).join(", ");
        const rem = list.length - 2;
        return { label: "Mecánicos", text: `${mainTwo} +${rem}`, list };
      };

      for (const row of (subServicesRows || [])) {
        const otId = Number(row.orden_trabajo_id);
        if (!subServicesMap[otId]) subServicesMap[otId] = [];
        
        const serviceTitle = row.tipo_servicio_nombre || 
          (row.categoria_nombre ? `Mantenimiento de ${row.categoria_nombre}` : "Servicio de mantenimiento");

        const mins = Number(row.minutos_trabajados_total || 0);
        const mecInfo = formatMecanicosData(row.mecanicos_list);

        subServicesMap[otId].push({
          id: row.orden_servicio_id,
          codigo_servicio: `OS-2026-${String(row.orden_servicio_id).padStart(6, '0')}`,
          nombre_servicio: serviceTitle,
          descripcion_servicio: row.descripcion_servicio,
          diagnostico: row.descripcion_servicio || "Diagnóstico de servicio técnico registrado.",
          observacion_tecnica: row.observacion_tecnica || null,
          trabajo_realizado: row.observacion_tecnica || "Esperando aprobación del cliente.",
          categoria_nombre: row.categoria_nombre || "General",
          componente_marca: row.componente_marca,
          componente_modelo: row.componente_modelo,
          costo: Number(row.costo || 0),
          nuevo_estado_nombre: row.nuevo_estado_nombre || "FINALIZADA",
          minutos_trabajados_total: mins,
          duracion_formateada: formatDuracion(mins),
          mecanicos_info: mecInfo,
          mecanico_label: mecInfo.label,
          mecanico_texto: mecInfo.text,
          mecanicos_lista: mecInfo.list
        });
      }
    }

    const mappedOrdenes = (parentOrders || []).map((ot: any) => ({
      ...ot,
      ordenes_servicio: subServicesMap[ot.orden_trabajo_id] || []
    }));

    const totalGastadoRow = await query(`
      SELECT COALESCE(SUM(total_orden), 0) AS total_gastado
      FROM admin.ordenes_trabajo
      WHERE cliente_id = $1 AND (activo = true OR activo IS NULL)
    `, [clienteId]);

    const totalGastado = Number(totalGastadoRow[0]?.total_gastado || 0);

    return NextResponse.json({
      id: cliente.cliente_id,
      ...cliente,
      total_gastado: totalGastado,
      bicicletas: mappedBikes,
      ordenes: mappedOrdenes
    });
  } catch (error: any) {
    console.error("Error in GET /api/crm/clientes/[id]:", error);
    return NextResponse.json({ error: error.message || "Error al obtener cliente" }, { status: 500 });
  }
}

// PUT /api/crm/clientes/[id]
export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const clienteId = parseInt(id, 10);

    if (isNaN(clienteId)) {
      return NextResponse.json({ error: "ID de cliente inválido." }, { status: 400 });
    }

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
    const fecha_nacimiento = body.fecha_nacimiento ? String(body.fecha_nacimiento).substring(0, 10) : null;
    const genero = (body.genero || '').trim();
    const contacto_whatsapp = Boolean(body.contacto_whatsapp);
    const contacto_email = Boolean(body.contacto_email);
    const notas = (body.notas || '').trim();

    if (!nombre) {
      return NextResponse.json({ success: false, message: "El Nombre es obligatorio.", field: "nombre" }, { status: 400 });
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

    // Duplicate email check
    if (correo) {
      const existing = await query(`
        SELECT cliente_id FROM admin.clientes
        WHERE LOWER(correo) = $1 AND cliente_id <> $2 AND fecha_eliminacion IS NULL
      `, [correo, clienteId]);
      if (existing && existing.length > 0) {
        return NextResponse.json({ success: false, message: "Ya existe un cliente registrado con este correo electrónico", field: "correo_electronico" }, { status: 409 });
      }
    }

    // Duplicate identificacion check
    const cleanIdentificacion = identificacion ? identificacion.replace(/\D/g, "") : null;
    if (cleanIdentificacion) {
      const existingIdent = await query(`
        SELECT cliente_id FROM admin.clientes
        WHERE (identificacion = $1 OR identificacion = $2 OR regexp_replace(identificacion, '[^0-9]', '', 'g') = $2)
          AND cliente_id <> $3 AND fecha_eliminacion IS NULL
      `, [identificacion, cleanIdentificacion, clienteId]);
      if (existingIdent && existingIdent.length > 0) {
        return NextResponse.json({ success: false, message: "Ya existe un cliente registrado con esta Cédula / RNC", field: "identificacion" }, { status: 409 });
      }
    }

    const nombre_completo = `${nombre} ${apellido}`.trim();

    const sql = `
      UPDATE admin.clientes SET
        nombre = $1,
        apellido = $2,
        nombre_completo = $3,
        tipo_cliente = $4,
        identificacion = $5,
        telefono_principal = $6,
        telefono_secundario = $7,
        correo = $8,
        direccion = $9,
        ciudad = $10,
        provincia = $11,
        pais = $12,
        fecha_nacimiento = CASE WHEN $13::text IS NULL OR $13::text = '' THEN NULL ELSE $13::date END,
        genero = $14,
        contacto_whatsapp = $15::boolean,
        contacto_email = $16::boolean,
        notas = $17,
        fecha_modificacion = NOW()
      WHERE cliente_id = $18::integer AND fecha_eliminacion IS NULL
      RETURNING *
    `;

    const params = [
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
      notas || null,
      clienteId
    ];

    const result = await query(sql, params);
    if (!result || result.length === 0) {
      return NextResponse.json({ success: false, message: "No se pudo actualizar el cliente." }, { status: 404 });
    }

    const r = result[0];
    return NextResponse.json({
      success: true,
      message: "Cliente actualizado correctamente",
      data: {
        id: r.cliente_id,
        cliente_id: r.cliente_id,
        ...r
      },
      id: r.cliente_id,
      cliente_id: r.cliente_id,
      ...r
    });

  } catch (error: any) {
    console.error("Error in PUT /api/crm/clientes/[id]:", error);
    const msg = error?.message || error?.toString() || "";
    if (msg.includes("23505") || msg.includes("uk_clientes_identificacion") || msg.includes("identificacion")) {
      return NextResponse.json({ success: false, message: "Ya existe un cliente registrado con esta Cédula / Pasaporte", field: "identificacion" }, { status: 409 });
    }
    if (msg.includes("uk_clientes_correo") || msg.includes("correo")) {
      return NextResponse.json({ success: false, message: "Ya existe un cliente registrado con este correo electrónico", field: "correo_electronico" }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: error.message || "No fue posible actualizar el cliente" }, { status: 500 });
  }
}

// DELETE /api/crm/clientes/[id]
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const clienteId = parseInt(id, 10);

    if (isNaN(clienteId)) {
      return NextResponse.json({ success: false, message: "ID de cliente inválido." }, { status: 400 });
    }

    // 1. Check if client has assigned bicycles in admin.bicicletas
    const bikeCheck = await query(`
      SELECT COUNT(*)::integer AS total FROM admin.bicicletas
      WHERE cliente_id = $1 AND fecha_eliminacion IS NULL
    `, [clienteId]);

    const hasBikes = Number(bikeCheck[0]?.total || 0) > 0;
    if (hasBikes) {
      return NextResponse.json({
        success: false,
        message: "No se puede eliminar el cliente porque tiene bicicletas asignadas."
      }, { status: 409 });
    }

    // 2. Perform physical DELETE directly
    const deleteSql = `
      DELETE FROM admin.clientes
      WHERE cliente_id = $1
      RETURNING cliente_id
    `;
    const deleteResult = await query(deleteSql, [clienteId]);

    // 3. If no rows returned, client does not exist
    if (!deleteResult || deleteResult.length === 0) {
      return NextResponse.json({
        success: false,
        message: "Cliente no encontrado."
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Cliente eliminado correctamente"
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error in DELETE /api/crm/clientes/[id]:", error);

    // 6. Detect 23503 using exact code check without text includes()
    const errorCode = error?.code || error?.cause?.code;
    if (errorCode === "23503") {
      return NextResponse.json({
        success: false,
        message: "No se puede eliminar el cliente porque tiene bicicletas asignadas."
      }, { status: 409 });
    }

    // 5. Any other SQL error returns HTTP 500 without soft-delete fallback
    return NextResponse.json({
      success: false,
      message: "No fue posible eliminar el cliente. Inténtalo nuevamente."
    }, { status: 500 });
  }
}
