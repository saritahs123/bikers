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

const DEFAULT_RESTRICTED_TITLE = "Acceso restringido";
const DEFAULT_RESTRICTED_MESSAGE =
  "No tienes permisos habilitados para acceder a esta funcionalidad. Si necesitas utilizarla, solicita la autorización correspondiente al administrador del sistema.";

/**
 * Reusable Server Component Guard for Next.js Dashboard Pages (GAP-02 / Fase 6.4.13 / Fase 6.4.21)
 *
 * Validates session, `puede_ver`, and any specific `requiredAction` on the server
 * before rendering children. If unauthorized, immediately renders AccessDeniedView
 * with a standardized, neutral, corporate presentation without exposing technical
 * codes or alarmist error cards.
 */
export async function ProtectedServerPage({
  screenCode,
  children,
  title,
  message,
  requiredAction = "puede_ver"
}: ProtectedServerPageProps) {
  let isAuthorized = false;

  try {
    const session = await getWorkshopSession();
    if (session && session.usuario_id) {
      const perms = await getScreenPermissions(screenCode, session.usuario_id);
      const actionKey = normalizeActionKey(requiredAction);

      if (perms.puede_ver && !(actionKey !== "puede_ver" && !perms[actionKey])) {
        isAuthorized = true;
      }
    }
  } catch (err) {
    console.error(`ProtectedServerPage authorization error for ${screenCode}:`, err);
    isAuthorized = false;
  }

  if (!isAuthorized) {
    return (
      <AccessDeniedView
        screenCode={screenCode}
        title={title || DEFAULT_RESTRICTED_TITLE}
        message={message || DEFAULT_RESTRICTED_MESSAGE}
      />
    );
  }

  return <>{children}</>;
}

export default ProtectedServerPage;
