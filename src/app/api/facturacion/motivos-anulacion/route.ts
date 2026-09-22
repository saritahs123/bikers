import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";

export const dynamic = "force-dynamic";

export interface MotivoAnulacionItem {
  motivo_anulacion_factura_id: number;
  codigo: string;
  motivo_anulacion: string;
  descripcion: string | null;
  genera_movimiento: boolean;
  tipo_movimiento_id: number | null;
  codigo_tipo_movimiento: string | null;
  nombre_tipo_movimiento: string | null;
  naturaleza: string | null;
  requiere_observacion: boolean;
  requiere_autorizacion: boolean;
}

export interface UsuarioAutorizadorItem {
  usuario_id: number;
  nombre_completo: string;
  rol_nombre: string;
}

export async function GET() {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.empresa_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const perms = await getModulePermissions("FACTURACION", session.usuario_id);
    if (!perms.puede_ver) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permisos para acceder a Facturación." },
        { status: 403 }
      );
    }

    const empresaId = session.empresa_id;

    // 1. Consultar motivos desde catálogo oficial admin.motivo_anulacion_factura
    let motivos: MotivoAnulacionItem[] = [];

    try {
      const sql = `
        SELECT
            maf.motivo_anulacion_factura_id,
            maf.codigo,
            maf.motivo_anulacion,
            maf.descripcion,
            maf.genera_movimiento,
            tmi.tipo_movimiento_id,
            tmi.codigo AS codigo_tipo_movimiento,
            tmi.nombre AS nombre_tipo_movimiento,
            tmi.naturaleza,
            maf.requiere_observacion,
            maf.requiere_autorizacion
        FROM admin.motivo_anulacion_factura maf
        LEFT JOIN admin.tipo_movimiento_inventario tmi
               ON tmi.tipo_movimiento_id = maf.tipo_movimiento_id
        WHERE maf.estado = 'ACTIVO'
        ORDER BY maf.motivo_anulacion;
      `;

      const rows = await query<Record<string, unknown>>(sql);
      if (rows && rows.length > 0) {
        motivos = rows.map((r) => {
          const cod = String(r.codigo || "").toUpperCase();
          const nombre = String(r.motivo_anulacion || "").toLowerCase();
          const esSinMovimiento =
            cod === "CAMBIO_FORMA_PAGO" ||
            cod === "FACTURA_DUPLICADA" ||
            cod === "AJUSTE_ADMINISTRATIVO" ||
            nombre.includes("cambio de forma de pago") ||
            nombre.includes("factura duplicada") ||
            nombre.includes("sin movimiento") ||
            r.genera_movimiento === false ||
            r.genera_movimiento === "false";

          const generaMov = !esSinMovimiento && Boolean(r.genera_movimiento);

          return {
            motivo_anulacion_factura_id: Number(r.motivo_anulacion_factura_id),
            codigo: String(r.codigo || ""),
            motivo_anulacion: String(r.motivo_anulacion || ""),
            descripcion: r.descripcion ? String(r.descripcion) : null,
            genera_movimiento: generaMov,
            tipo_movimiento_id: generaMov ? (r.tipo_movimiento_id ? Number(r.tipo_movimiento_id) : null) : null,
            codigo_tipo_movimiento: generaMov ? (r.codigo_tipo_movimiento ? String(r.codigo_tipo_movimiento) : "DEV_VENTA") : null,
            nombre_tipo_movimiento: generaMov ? (r.nombre_tipo_movimiento ? String(r.nombre_tipo_movimiento) : null) : null,
            naturaleza: generaMov ? (r.naturaleza ? String(r.naturaleza) : null) : null,
            requiere_observacion: false,
            requiere_autorizacion: false,
          };
        });
      }
    } catch (sqlErr) {
      console.warn("Fallo al consultar admin.motivo_anulacion_factura, usando catálogo predeterminado:", sqlErr);
    }

    // Fallback de catálogo en caso de migración en curso
    if (motivos.length === 0) {
      motivos = [
        {
          motivo_anulacion_factura_id: 1,
          codigo: "ERROR_FACTURACION",
          motivo_anulacion: "Error de facturación",
          descripcion: "Error en montos, cliente o conceptos emitidos en la factura.",
          genera_movimiento: true,
          tipo_movimiento_id: null,
          codigo_tipo_movimiento: "DEV_VENTA",
          nombre_tipo_movimiento: "Devolución por Anulación de Venta",
          naturaleza: "ENTRADA",
          requiere_observacion: false,
          requiere_autorizacion: false,
        },
        {
          motivo_anulacion_factura_id: 2,
          codigo: "CLIENTE_DESISTE",
          motivo_anulacion: "Cliente desiste de la compra",
          descripcion: "El cliente decide no concretar la compra.",
          genera_movimiento: true,
          tipo_movimiento_id: null,
          codigo_tipo_movimiento: "DEV_VENTA",
          nombre_tipo_movimiento: "Devolución por Anulación de Venta",
          naturaleza: "ENTRADA",
          requiere_observacion: false,
          requiere_autorizacion: false,
        },
        {
          motivo_anulacion_factura_id: 3,
          codigo: "PRODUCTO_INCORRECTO",
          motivo_anulacion: "Producto facturado incorrectamente",
          descripcion: "Se despachó o seleccionó un ítem no correspondiente al pedido real.",
          genera_movimiento: true,
          tipo_movimiento_id: null,
          codigo_tipo_movimiento: "DEV_VENTA",
          nombre_tipo_movimiento: "Devolución por Anulación de Venta",
          naturaleza: "ENTRADA",
          requiere_observacion: false,
          requiere_autorizacion: false,
        },
        {
          motivo_anulacion_factura_id: 4,
          codigo: "FACTURA_DUPLICADA",
          motivo_anulacion: "Factura duplicada",
          descripcion: "Emisión repetida accidentalmente de una misma transacción.",
          genera_movimiento: false,
          tipo_movimiento_id: null,
          codigo_tipo_movimiento: null,
          nombre_tipo_movimiento: null,
          naturaleza: null,
          requiere_observacion: false,
          requiere_autorizacion: false,
        },
        {
          motivo_anulacion_factura_id: 5,
          codigo: "CAMBIO_FORMA_PAGO",
          motivo_anulacion: "Cambio de forma de pago",
          descripcion: "Cambio en la condición o medio de pago original.",
          genera_movimiento: false,
          tipo_movimiento_id: null,
          codigo_tipo_movimiento: null,
          nombre_tipo_movimiento: null,
          naturaleza: null,
          requiere_observacion: false,
          requiere_autorizacion: false,
        },
      ];
    }

    // 2. Consultar usuarios con capacidad de autorizar anulaciones (Administradores o Supervisores)
    let usuariosAutorizadores: UsuarioAutorizadorItem[] = [];
    try {
      const userSql = `
        SELECT
          u.usuario_id,
          COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ui.nombre, ui.apellido)), ''), ui.correo_electronico, ('Usuario #' || u.usuario_id::text)) AS nombre_completo,
          COALESCE(rf.nombre, 'Usuario') AS rol_nombre
        FROM admin.usuario u
        LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
        LEFT JOIN admin.rol_funcional rf ON u.rol_principal_id = rf.rol_funcional_id
        WHERE u.empresa_id = $1
          AND (u.estado = 'ACTIVO' OR u.estado IS NULL)
          AND (
            u.rol_principal_id = 1
            OR EXISTS (
              SELECT 1
              FROM admin.matriz_acceso_rol mar
              JOIN admin.modulo_sistema ms ON mar.modulo_sistema_id = ms.modulo_sistema_id
              WHERE mar.rol_funcional_id = u.rol_principal_id
                AND UPPER(TRIM(ms.nombre)) IN ('FACTURACION', 'FACTURACIÓN')
                AND (mar.puede_aprobar = TRUE OR mar.puede_eliminar = TRUE)
            )
          )
        ORDER BY ui.nombre ASC, u.usuario_id ASC;
      `;

      const uRows = await query<Record<string, unknown>>(userSql, [empresaId]);
      if (uRows && uRows.length > 0) {
        usuariosAutorizadores = uRows.map((u) => ({
          usuario_id: Number(u.usuario_id),
          nombre_completo: String(u.nombre_completo || `Usuario #${u.usuario_id}`),
          rol_nombre: String(u.rol_nombre || "Usuario"),
        }));
      }
    } catch (uErr) {
      console.warn("Could not query usuarios autorizadores:", uErr);
    }

    return NextResponse.json({
      success: true,
      data: motivos,
      usuarios_autorizadores: usuariosAutorizadores,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Error en GET /api/facturacion/motivos-anulacion:", err);
    return NextResponse.json(
      {
        error: "ERROR_MOTIVOS_ANULACION",
        message: "No se pudieron cargar los motivos de anulación.",
        details: errorMsg,
      },
      { status: 500 }
    );
  }
}
