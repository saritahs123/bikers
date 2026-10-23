import React from "react";
import { getWorkshopSession, getScreenPermissions } from "@/lib/workshop-session";
import { AccessDeniedView } from "./AccessDeniedView";

interface ProtectedServerPageProps {
  screenCode: string;
  children: React.ReactNode;
  title?: string;
  message?: string;
}

/**
 * Reusable Server Component Guard for Next.js Dashboard Pages (GAP-02)
 *
 * Validates session and `puede_ver` on the server before rendering children.
 * If unauthorized, immediately renders AccessDeniedView without mounting
 * the restricted child view or executing its client-side queries.
 */
export async function ProtectedServerPage({
  screenCode,
  children,
  title,
  message
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
    if (!perms.puede_ver) {
      return (
        <AccessDeniedView
          screenCode={screenCode}
          title={title || "Acceso Denegado"}
          message={message || "Tu rol de usuario actual no tiene permiso de lectura asignado para este módulo o pantalla."}
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
