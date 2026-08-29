import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { recordUserActivity, recordUserAudit, computeDiff, sanitizeAuditPayload } from "@/lib/auditLogger";

const cleanFecha = (val: any) => {
  if (!val) return null;
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
};

async function verifyBikeOwnership(bicicletaId: number, empresaId: number) {
  const rows = await query(`
    SELECT b.bicicleta_id, b.marca, b.modelo
    FROM admin.bicicletas b
    JOIN admin.clientes c ON b.cliente_id = c.cliente_id
    WHERE b.bicicleta_id = $1 AND c.empresa_id = $2 AND b.fecha_eliminacion IS NULL
  `, [bicicletaId, empresaId]);
  return rows && rows.length > 0 ? rows[0] : null;
}

// GET /api/crm/bicicletas/[id]/components
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("BICICLETA", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para ver componentes de bicicletas." }, { status: 403 });
    }

    const { id } = await context.params;
    const bicicletaId = parseInt(id, 10);

    if (isNaN(bicicletaId)) {
      return NextResponse.json({ error: "ID de bicicleta inválido." }, { status: 400 });
    }

    const bike = await verifyBikeOwnership(bicicletaId, session.empresa_id);
    if (!bike) {
      return NextResponse.json({ error: "Bicicleta no encontrada." }, { status: 404 });
    }

    const rows = await query(`
      SELECT 
        bc.bicicleta_componente_id AS id,
        bc.bicicleta_componente_id,
        bc.bicicleta_id,
        bc.categoria_componente_id,
        cat.nombre AS categoria_nombre,
        cat.codigo AS categoria_codigo,
        bc.estado_componente_id,
        est.nombre AS estado_nombre,
        est.codigo AS estado_codigo,
        est.nivel_desgaste,
        est.requiere_revision,
        bc.marca,
        bc.modelo,
        bc.numero_serie,
        bc.descripcion,
        bc.fecha_instalacion,
        bc.kilometraje_instalacion,
        bc.vigente,
        bc.observaciones,
        bc.activo,
        bc.fecha_creacion
      FROM admin.bicicleta_componentes bc
      LEFT JOIN admin.categoria_componente cat ON bc.categoria_componente_id = cat.categoria_componente_id
      LEFT JOIN admin.estado_componente est ON bc.estado_componente_id = est.estado_componente_id
      WHERE bc.bicicleta_id = $1 AND bc.fecha_eliminacion IS NULL AND (bc.activo = true OR bc.activo IS NULL)
      ORDER BY cat.orden_visual ASC, bc.bicicleta_componente_id DESC
    `, [bicicletaId]);

    const mapped = (rows || []).map((r: any) => ({
      id: r.bicicleta_componente_id,
      bicicleta_componente_id: r.bicicleta_componente_id,
      bicicleta_id: r.bicicleta_id,
      categoria_componente_id: r.categoria_componente_id,
      categoria_nombre: r.categoria_nombre || "General",
      categoria_codigo: r.categoria_codigo || "GEN",
      estado_componente_id: r.estado_componente_id,
      estado_nombre: r.estado_nombre || "Bueno",
      estado_codigo: r.estado_codigo || "BUENO",
      nivel_desgaste: r.nivel_desgaste !== undefined && r.nivel_desgaste !== null ? Number(r.nivel_desgaste) : 0,
      requiere_revision: Boolean(r.requiere_revision),
      marca: r.marca || "",
      modelo: r.modelo || "",
      especificacion: [r.marca, r.modelo].filter(Boolean).join(" ") || r.descripcion || "Sin modelo",
      numero_serie: r.numero_serie || "",
      descripcion: r.descripcion || "",
      fecha_instalacion: r.fecha_instalacion ? String(r.fecha_instalacion).substring(0, 10) : null,
      kilometraje_instalacion: Number(r.kilometraje_instalacion || 0),
      vigente: r.vigente !== false,
      observaciones: r.observaciones || ""
    }));

    return NextResponse.json(mapped);

  } catch (error: any) {
    console.error("Error in GET /api/crm/bicicletas/[id]/components:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/crm/bicicletas/[id]/components
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("BICICLETA", session.usuario_id);
    if (!perms.puede_crear && !perms.puede_editar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para agregar componentes a bicicletas." }, { status: 403 });
    }

    const { id } = await context.params;
    const bicicletaId = parseInt(id, 10);

    if (isNaN(bicicletaId) || bicicletaId <= 0) {
      return NextResponse.json({
        success: false,
        error: "INVALID_BIKE_ID",
        message: "ID de bicicleta inválido."
      }, { status: 400 });
    }

    const bike = await verifyBikeOwnership(bicicletaId, session.empresa_id);
    if (!bike) {
      return NextResponse.json({
        success: false,
        error: "NOT_FOUND",
        message: "Bicicleta no encontrada o no pertenece a su empresa."
      }, { status: 404 });
    }

    const body = await req.json();
    const categoria_componente_id = body.categoria_componente_id !== undefined && body.categoria_componente_id !== null && body.categoria_componente_id !== ""
      ? parseInt(body.categoria_componente_id, 10)
      : NaN;
    const estado_componente_id = body.estado_componente_id !== undefined && body.estado_componente_id !== null && body.estado_componente_id !== ""
      ? parseInt(body.estado_componente_id, 10)
      : NaN;
    const marca = (body.marca || '').trim();
    const modelo = (body.modelo || '').trim();
    const especificacion = (body.especificacion || [marca, modelo].filter(Boolean).join(" ") || '').trim();
    const numero_serie = (body.numero_serie || '').trim();
    const descripcion = (body.descripcion || especificacion || '').trim();
    const fecha_instalacion = cleanFecha(body.fecha_instalacion);
    const kilometraje_instalacion = body.kilometraje_instalacion ? parseInt(body.kilometraje_instalacion, 10) : 0;
    const observaciones = (body.observaciones || '').trim();

    if (isNaN(categoria_componente_id) || categoria_componente_id <= 0) {
      return NextResponse.json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Selecciona una categoría válida.",
        fields: { categoria_componente_id: "Requerido" }
      }, { status: 400 });
    }

    // Verify category exists and is active
    const catCheck = await query(`
      SELECT categoria_componente_id, activo, fecha_eliminacion
      FROM admin.categoria_componente
      WHERE categoria_componente_id = $1
    `, [categoria_componente_id]);

    if (!catCheck || catCheck.length === 0 || catCheck[0].fecha_eliminacion) {
      return NextResponse.json({
        success: false,
        error: "CATEGORY_NOT_FOUND",
        message: "La categoría de componente seleccionada no existe.",
        fields: { categoria_componente_id: "Inexistente" }
      }, { status: 400 });
    }

    if (catCheck[0].activo === false) {
      return NextResponse.json({
        success: false,
        error: "CATEGORY_INACTIVE",
        message: "La categoría seleccionada está desactivada y no puede asignarse a nuevos componentes.",
        fields: { categoria_componente_id: "Desactivada" }
      }, { status: 400 });
    }

    if (isNaN(estado_componente_id) || estado_componente_id <= 0) {
      return NextResponse.json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Selecciona el estado del componente.",
        fields: { estado_componente_id: "Requerido" }
      }, { status: 400 });
    }

    // Verify state exists and is active
    const stateCheck = await query(`
      SELECT estado_componente_id, activo, fecha_eliminacion
      FROM admin.estado_componente
      WHERE estado_componente_id = $1
    `, [estado_componente_id]);

    if (!stateCheck || stateCheck.length === 0 || stateCheck[0].fecha_eliminacion) {
      return NextResponse.json({
        success: false,
        error: "STATE_NOT_FOUND",
        message: "El estado de componente seleccionado no existe.",
        fields: { estado_componente_id: "Inexistente" }
      }, { status: 400 });
    }

    if (stateCheck[0].activo === false) {
      return NextResponse.json({
        success: false,
        error: "STATE_INACTIVE",
        message: "El estado seleccionado está desactivado y no puede asignarse a nuevos componentes.",
        fields: { estado_componente_id: "Desactivado" }
      }, { status: 400 });
    }

    let sql = "";
    let queryParams: any[] = [];

    if (fecha_instalacion) {
      sql = `
        INSERT INTO admin.bicicleta_componentes (
          bicicleta_componente_id, bicicleta_id, categoria_componente_id, estado_componente_id,
          marca, modelo, numero_serie, descripcion, fecha_instalacion,
          kilometraje_instalacion, vigente, observaciones, activo, fecha_creacion
        ) VALUES (
          (SELECT COALESCE(MAX(bicicleta_componente_id), 0) + 1 FROM admin.bicicleta_componentes),
          $1, $2, $3,
          $4, $5, $6, $7, $8::timestamptz,
          $9, true, $10, true, NOW()
        )
        RETURNING *
      `;
      queryParams = [
        bicicletaId,
        categoria_componente_id,
        estado_componente_id,
        marca || null,
        modelo || null,
        numero_serie || null,
        descripcion || null,
        fecha_instalacion,
        kilometraje_instalacion,
        observaciones || null
      ];
    } else {
      sql = `
        INSERT INTO admin.bicicleta_componentes (
          bicicleta_componente_id, bicicleta_id, categoria_componente_id, estado_componente_id,
          marca, modelo, numero_serie, descripcion,
          kilometraje_instalacion, vigente, observaciones, activo, fecha_creacion
        ) VALUES (
          (SELECT COALESCE(MAX(bicicleta_componente_id), 0) + 1 FROM admin.bicicleta_componentes),
          $1, $2, $3,
          $4, $5, $6, $7,
          $8, true, $9, true, NOW()
        )
        RETURNING *
      `;
      queryParams = [
        bicicletaId,
        categoria_componente_id,
        estado_componente_id,
        marca || null,
        modelo || null,
        numero_serie || null,
        descripcion || null,
        kilometraje_instalacion,
        observaciones || null
      ];
    }

    const result = await query(sql, queryParams);
    const createdRow = result[0];

    const mapped = {
      id: createdRow.bicicleta_componente_id,
      bicicleta_componente_id: createdRow.bicicleta_componente_id,
      bicicleta_id: createdRow.bicicleta_id,
      categoria_componente_id: createdRow.categoria_componente_id,
      estado_componente_id: createdRow.estado_componente_id,
      marca: createdRow.marca || "",
      modelo: createdRow.modelo || "",
      especificacion: [createdRow.marca, createdRow.modelo].filter(Boolean).join(" ") || createdRow.descripcion || "Componente",
      numero_serie: createdRow.numero_serie || "",
      descripcion: createdRow.descripcion || "",
      fecha_instalacion: createdRow.fecha_instalacion ? String(createdRow.fecha_instalacion).substring(0, 10) : null,
      kilometraje_instalacion: Number(createdRow.kilometraje_instalacion || 0),
      vigente: createdRow.vigente !== false,
      observaciones: createdRow.observaciones || ""
    };

    // Forensic logging
    await recordUserActivity({
      userId: session.usuario_id,
      modulo: "BICICLETA",
      evento: "COMPONENT_ADDED",
      descripcion: `Agregado componente ${marca || 'General'} ${modelo} (ID: ${mapped.id}) a bicicleta ID ${bicicletaId}`,
      req
    });

    await recordUserAudit({
      userId: session.usuario_id,
      adminId: session.usuario_id,
      accion: "CRM_COMPONENT_ADDED",
      valorAnterior: null,
      valorNuevo: JSON.stringify(sanitizeAuditPayload({
        bicicleta_componente_id: mapped.id,
        bicicleta_id: bicicletaId,
        categoria_componente_id,
        estado_componente_id,
        marca,
        modelo,
        numero_serie
      })),
      motivo: `Componente agregado a bicicleta ID ${bicicletaId}`,
      req
    });

    return NextResponse.json({
      success: true,
      data: mapped
    }, { status: 201 });

  } catch (error: any) {
    console.error("Error in POST /api/crm/bicicletas/[id]/components:", error);
    return NextResponse.json({
      success: false,
      error: "SERVER_ERROR",
      message: "No pudimos guardar este componente. Inténtalo nuevamente."
    }, { status: 500 });
  }
}

// PUT /api/crm/bicicletas/[id]/components
export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("BICICLETA", session.usuario_id);
    if (!perms.puede_editar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para modificar componentes de bicicletas." }, { status: 403 });
    }

    const { id } = await context.params;
    const bicicletaId = parseInt(id, 10);

    if (isNaN(bicicletaId)) {
      return NextResponse.json({ error: "ID de bicicleta inválido." }, { status: 400 });
    }

    const bike = await verifyBikeOwnership(bicicletaId, session.empresa_id);
    if (!bike) {
      return NextResponse.json({ error: "Bicicleta no encontrada o no pertenece a su empresa." }, { status: 404 });
    }

    const body = await req.json();
    const componentId = parseInt(body.bicicleta_componente_id || body.id, 10);

    if (isNaN(componentId)) {
      return NextResponse.json({ error: "ID de componente inválido." }, { status: 400 });
    }

    const beforeRows = await query(`
      SELECT * FROM admin.bicicleta_componentes
      WHERE bicicleta_componente_id = $1 AND bicicleta_id = $2
    `, [componentId, bicicletaId]);

    if (!beforeRows || beforeRows.length === 0) {
      return NextResponse.json({ error: "No se encontró el componente a actualizar." }, { status: 404 });
    }

    const beforeComp = beforeRows[0];

    const categoria_componente_id = body.categoria_componente_id !== undefined && body.categoria_componente_id !== null && body.categoria_componente_id !== ""
      ? parseInt(body.categoria_componente_id, 10)
      : NaN;
    const estado_componente_id = body.estado_componente_id !== undefined && body.estado_componente_id !== null && body.estado_componente_id !== ""
      ? parseInt(body.estado_componente_id, 10)
      : NaN;
    const marca = (body.marca || '').trim();
    const modelo = (body.modelo || '').trim();
    const numero_serie = (body.numero_serie || '').trim();
    const descripcion = (body.descripcion || '').trim();
    const kilometraje_instalacion = body.kilometraje_instalacion ? parseInt(body.kilometraje_instalacion, 10) : 0;
    const observaciones = (body.observaciones || '').trim();

    if (isNaN(categoria_componente_id) || categoria_componente_id <= 0) {
      return NextResponse.json({ error: "Debe seleccionar una categoría de componente." }, { status: 400 });
    }

    // Verify category if changed
    if (beforeComp.categoria_componente_id !== categoria_componente_id) {
      const catCheck = await query(`
        SELECT categoria_componente_id, activo, fecha_eliminacion
        FROM admin.categoria_componente
        WHERE categoria_componente_id = $1
      `, [categoria_componente_id]);

      if (!catCheck || catCheck.length === 0 || catCheck[0].fecha_eliminacion) {
        return NextResponse.json({ error: "La categoría de componente seleccionada no existe." }, { status: 400 });
      }

      if (catCheck[0].activo === false) {
        return NextResponse.json({
          error: "CATEGORY_INACTIVE",
          message: "La categoría seleccionada está desactivada y no puede asignarse a componentes."
        }, { status: 400 });
      }
    }

    if (isNaN(estado_componente_id) || estado_componente_id <= 0) {
      return NextResponse.json({ error: "Selecciona el estado del componente." }, { status: 400 });
    }

    // Verify state if changed
    if (beforeComp.estado_componente_id !== estado_componente_id) {
      const stateCheck = await query(`
        SELECT estado_componente_id, activo, fecha_eliminacion
        FROM admin.estado_componente
        WHERE estado_componente_id = $1
      `, [estado_componente_id]);

      if (!stateCheck || stateCheck.length === 0 || stateCheck[0].fecha_eliminacion) {
        return NextResponse.json({ error: "El estado de componente seleccionado no existe." }, { status: 400 });
      }

      if (stateCheck[0].activo === false) {
        return NextResponse.json({
          error: "STATE_INACTIVE",
          message: "El estado seleccionado está desactivado y no puede asignarse a componentes."
        }, { status: 400 });
      }
    }

    const setClauses: string[] = [
      "categoria_componente_id = $1",
      "estado_componente_id = $2",
      "marca = $3",
      "modelo = $4",
      "numero_serie = $5",
      "descripcion = $6",
      "kilometraje_instalacion = $7",
      "observaciones = $8"
    ];

    const sqlParams: any[] = [
      categoria_componente_id,
      estado_componente_id,
      marca || null,
      modelo || null,
      numero_serie || null,
      descripcion || null,
      kilometraje_instalacion,
      observaciones || null
    ];

    if (body.fecha_instalacion !== undefined) {
      sqlParams.push(cleanFecha(body.fecha_instalacion));
      setClauses.push(`fecha_instalacion = $${sqlParams.length}::timestamptz`);
    }

    sqlParams.push(componentId);
    const compIdx = sqlParams.length;
    sqlParams.push(bicicletaId);
    const bikeIdx = sqlParams.length;

    const sql = `
      UPDATE admin.bicicleta_componentes
      SET ${setClauses.join(", ")}
      WHERE bicicleta_componente_id = $${compIdx} AND bicicleta_id = $${bikeIdx}
      RETURNING *
    `;

    const result = await query(sql, sqlParams);

    if (!result || result.length === 0) {
      return NextResponse.json({ error: "No se encontró el componente a actualizar." }, { status: 404 });
    }

    const updatedComp = result[0];
    const diff = computeDiff(beforeComp, updatedComp);

    if (diff.hasChanges) {
      await recordUserActivity({
        userId: session.usuario_id,
        modulo: "BICICLETA",
        evento: "COMPONENT_UPDATED",
        descripcion: `Modificación de componente ID ${componentId} en bicicleta ID ${bicicletaId}`,
        req
      });

      await recordUserAudit({
        userId: session.usuario_id,
        adminId: session.usuario_id,
        accion: "CRM_COMPONENT_UPDATED",
        valorAnterior: diff.valorAnterior,
        valorNuevo: diff.valorNuevo,
        motivo: `Modificación de componente ID ${componentId}`,
        req
      });
    }

    return NextResponse.json(updatedComp);

  } catch (error: any) {
    console.error("Error in PUT /api/crm/bicicletas/[id]/components:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/crm/bicicletas/[id]/components
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sesión no válida o expirada." }, { status: 401 });
    }

    const perms = await getModulePermissions("BICICLETA", session.usuario_id);
    if (!perms.puede_eliminar && !perms.puede_editar) {
      return NextResponse.json({ error: "FORBIDDEN", message: "No tienes permisos para eliminar componentes de bicicletas." }, { status: 403 });
    }

    const { id } = await context.params;
    const bicicletaId = parseInt(id, 10);
    const { searchParams } = new URL(req.url);
    const componentIdParam = searchParams.get("componentId");

    if (isNaN(bicicletaId) || !componentIdParam) {
      return NextResponse.json({ error: "ID de bicicleta o componente inválido." }, { status: 400 });
    }

    const bike = await verifyBikeOwnership(bicicletaId, session.empresa_id);
    if (!bike) {
      return NextResponse.json({ error: "Bicicleta no encontrada o no pertenece a su empresa." }, { status: 404 });
    }

    const componentId = parseInt(componentIdParam, 10);

    const beforeRows = await query(`
      SELECT * FROM admin.bicicleta_componentes
      WHERE bicicleta_componente_id = $1 AND bicicleta_id = $2
    `, [componentId, bicicletaId]);

    if (!beforeRows || beforeRows.length === 0) {
      return NextResponse.json({ error: "Componente no encontrado." }, { status: 404 });
    }

    const beforeComp = beforeRows[0];

    await query(`
      DELETE FROM admin.bicicleta_componentes
      WHERE bicicleta_componente_id = $1 AND bicicleta_id = $2
    `, [componentId, bicicletaId]);

    // Forensic logging
    await recordUserActivity({
      userId: session.usuario_id,
      modulo: "BICICLETA",
      evento: "COMPONENT_REMOVED",
      descripcion: `Eliminación de componente ID ${componentId} de bicicleta ID ${bicicletaId}`,
      req
    });

    await recordUserAudit({
      userId: session.usuario_id,
      adminId: session.usuario_id,
      accion: "CRM_COMPONENT_REMOVED",
      valorAnterior: JSON.stringify(sanitizeAuditPayload({
        bicicleta_componente_id: beforeComp.bicicleta_componente_id,
        bicicleta_id: bicicletaId,
        categoria_componente_id: beforeComp.categoria_componente_id,
        marca: beforeComp.marca,
        modelo: beforeComp.modelo
      })),
      valorNuevo: null,
      motivo: `Eliminación de componente ID ${componentId} de bicicleta ID ${bicicletaId}`,
      req
    });

    return NextResponse.json({ message: "Componente eliminado correctamente." });

  } catch (error: any) {
    console.error("Error in DELETE /api/crm/bicicletas/[id]/components:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
