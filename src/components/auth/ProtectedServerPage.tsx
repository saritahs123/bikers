import React from "react";
import { getWorkshopSession, getScreenPermissions } from "@/lib/workshop-session";
import { AccessDeniedView } from "./AccessDeniedView";

export type RbacActionKey =
  | "puede_ver"
  | "puede_crear"
  | "puede_editar"
  | "puede_inactivar"
  | "puede_exportar"
  | "puede_importar"
  | "puede_aprobar"
  | "puede_asignar"
  | "puede_mover"
  | "puede_cerrar"
  | "puede_reabrir"
  | "puede_eliminar";

interface ProtectedServerPageProps {
  screenCode: string;
  children: React.ReactNode;
  title?: string;
  message?: string;
  requiredAction?:
    | RbacActionKey
    | "ver"
    | "crear"
    | "editar"
    | "inactivar"
    | "exportar"
    | "importar"
    | "aprobar"
    | "asignar"
    | "mover"
    | "cerrar"
    | "reabrir"
    | "eliminar";
}

function normalizeActionKey(action?: string): RbacActionKey {
  if (!action) return "puede_ver";
  if (action.startsWith("puede_")) return action as RbacActionKey;
  return `puede_${action}` as RbacActionKey;
}

const ACTION_DESCRIPTIONS: Record<RbacActionKey, string> = {
  puede_ver: "consultar o visualizar",
  puede_crear: "crear o registrar nuevos elementos",
  puede_editar: "modificar o editar registros",
  puede_inactivar: "inactivar registros",
  puede_exportar: "exportar datos",
  puede_importar: "importar datos",
  puede_aprobar: "aprobar o anular operaciones",
  puede_asignar: "asignar recursos o roles",
  puede_mover: "trasladar o mover inventario",
  puede_cerrar: "cerrar registros u órdenes",
  puede_reabrir: "reabrir registros u órdenes",
  puede_eliminar: "eliminar registros"
};

/**
 * Reusable Server Component Guard for Next.js Dashboard Pages (GAP-02 / Fase 6.4.13)
 *
 * Validates session, `puede_ver`, and any specific `requiredAction` on the server
 * before rendering children. If unauthorized, immediately renders AccessDeniedView
 * without mounting the restricted child view or executing its client-side queries.
 */
export async function ProtectedServerPage({
  screenCode,
  children,
  title,
  message,
  requiredAction = "puede_ver"
}: ProtectedServerPageProps) {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.usuario_id) {
      return (
        <AccessDeniedView
          screenCode={screenCode}
          title="Sesión no iniciada"
          message="No se encontró una sesión válida. Inicie sesión para acceder a esta pantalla."
        />
      );
    }

    const perms = await getScreenPermissions(screenCode, session.usuario_id);

    // Regla global 1: Sin permiso VER, nunca mostrar la pantalla
    if (!perms.puede_ver) {
      return (
        <AccessDeniedView
          screenCode={screenCode}
          title={title || "Acceso Denegado"}
          message={message || "Tu rol de usuario actual no tiene permiso de lectura asignado para este módulo o pantalla."}
        />
      );
    }

    // Regla global 2: Si se requiere una acción específica (ej. CREAR para pantallas exclusivas de alta)
    const actionKey = normalizeActionKey(requiredAction);
    if (actionKey !== "puede_ver" && !perms[actionKey]) {
      const actionDesc = ACTION_DESCRIPTIONS[actionKey] || actionKey.replace("puede_", "");
      return (
        <AccessDeniedView
          screenCode={screenCode}
          title={title || "Acción No Autorizada"}
          message={
            message ||
            `Tu rol de usuario actual no dispone de permisos para ${actionDesc} en esta sección del sistema.`
          }
        />
      );
    }

    return <>{children}</>;
  } catch (err) {
    console.error(`ProtectedServerPage authorization error for ${screenCode}:`, err);
    return (
      <AccessDeniedView
        screenCode={screenCode}
        title="Error de Validación de Seguridad"
        message="Ocurrió un error al verificar los permisos del usuario con el servidor."
      />
    );
  }
}

export default ProtectedServerPage;
