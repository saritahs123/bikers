import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export async function GET() {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const perms = await getModulePermissions("REPORTES", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const empresaId = session.empresa_id;

    // Concurrently fetch common filter options with fault tolerance
    const [clientsRes, suppliersRes, categoriesRes, paymentMethodsRes, usersRes, orderStatusesRes, serviceTypesRes] = await Promise.allSettled([
      query(
        `SELECT cliente_id, COALESCE(nombre_completo, CONCAT(nombre, ' ', apellido)) AS nombre, identificacion, telefono_principal AS telefono 
         FROM admin.clientes 
         WHERE empresa_id = $1 AND fecha_eliminacion IS NULL 
         ORDER BY nombre ASC 
         LIMIT 1000`,
        [empresaId]
      ),
      query(
        `SELECT proveedor_id, nombre_comercial AS nombre 
         FROM admin.proveedores 
         WHERE empresa_id = $1 AND (UPPER(estado) = 'ACTIVO' OR estado IS NULL) 
         ORDER BY nombre ASC`,
        [empresaId]
      ),
      query(
        `SELECT categoria_producto_id, nombre 
         FROM admin.categoria_producto 
         WHERE (UPPER(estado) = 'ACTIVO' OR estado IS NULL) 
         ORDER BY nombre ASC`
      ),
      query(
        `SELECT tipo_pago_id, codigo, nombre 
         FROM admin.tipo_pago 
         WHERE (UPPER(estado) = 'ACTIVO' OR estado IS NULL) 
         ORDER BY nombre ASC`
      ),
      query(
        `SELECT u.usuario_id, COALESCE(NULLIF(TRIM(CONCAT(ui.nombre, ' ', ui.apellido)), ''), us.identificador_principal, ui.correo_electronico, 'Usuario') AS nombre
         FROM admin.usuario u
         LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
         LEFT JOIN admin.usuario_seguridad us ON u.usuario_id = us.usuario_id
         WHERE (u.empresa_id = $1 OR u.empresa_id IS NULL)
         ORDER BY nombre ASC`,
        [empresaId]
      ),
      query(
        `SELECT estado_orden_id, codigo, nombre, color_estado 
         FROM admin.estado_orden_trabajo 
         WHERE (activo = true OR activo IS NULL) 
         ORDER BY orden_visual ASC`
      ),
      query(
        `SELECT tipo_servicio_id, codigo, nombre 
         FROM admin.tipo_servicio 
         WHERE (activo = true OR activo IS NULL) 
         ORDER BY nombre ASC`
      ),
    ]);

    return NextResponse.json({
      clients: clientsRes.status === "fulfilled" ? clientsRes.value || [] : [],
      suppliers: suppliersRes.status === "fulfilled" ? suppliersRes.value || [] : [],
      categories: categoriesRes.status === "fulfilled" ? categoriesRes.value || [] : [],
      paymentMethods: paymentMethodsRes.status === "fulfilled" ? paymentMethodsRes.value || [] : [],
      users: usersRes.status === "fulfilled" ? usersRes.value || [] : [],
      orderStatuses: orderStatusesRes.status === "fulfilled" ? orderStatusesRes.value || [] : [],
      serviceTypes: serviceTypesRes.status === "fulfilled" ? serviceTypesRes.value || [] : [],
      paymentConditions: [
        { value: "CONTADO", label: "Contado" },
        { value: "CREDITO", label: "Crédito" }
      ],
      invoiceStatuses: [
        { value: "PAGADA", label: "Pagada" },
        { value: "PENDIENTE", label: "Pendiente" },
        { value: "ANULADA", label: "Anulada" }
      ]
    });
  } catch (error: unknown) {
    console.error("Error in /api/reports/filter-options:", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
