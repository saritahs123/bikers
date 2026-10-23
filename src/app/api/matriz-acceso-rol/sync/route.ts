import { NextResponse } from "next/server";
import { getWorkshopSession, getScreenPermissions, isSuperAdmin } from "@/lib/workshop-session";
import { syncNavigationToDatabase } from "@/lib/navigationSync";

export async function POST() {
  try {
    const session = await getWorkshopSession();
    if (!session || !session.usuario_id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    const superAdmin = await isSuperAdmin(session.usuario_id);
    const perms = await getScreenPermissions("/settings/security/roles", session.usuario_id);

    if (!superAdmin && !perms.puede_editar && !perms.puede_crear) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes privilegios para ejecutar la sincronización de navegación." },
        { status: 403 }
      );
    }

    const syncRes = await syncNavigationToDatabase(true);

    return NextResponse.json({
      success: syncRes.success,
      menusSynced: syncRes.menusSynced,
      screensSynced: syncRes.screensSynced,
      message: syncRes.message || "Catálogo de menús y pantallas sincronizado exitosamente con la configuración canónica."
    });
  } catch (error: unknown) {
    console.error("Error in POST /api/matriz-acceso-rol/sync:", error);
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: "Error al sincronizar el catálogo de navegación." },
      { status: 500 }
    );
  }
}
