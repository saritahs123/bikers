import { redirect } from "next/navigation";
import { getWorkshopSession, getScreenPermissions, resolveDefaultAuthorizedPath } from "@/lib/workshop-session";
import { query } from "@/lib/db";
import DashboardView from "@/components/dashboard/DashboardView";
import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";
import { NeutralWelcomeView } from "@/components/auth/NeutralWelcomeView";

export const dynamic = "force-dynamic";

interface InitialMetrics {
  totalOrdenes: number;
  totalClientes: number;
}

interface CountRow {
  count: number | string;
}

interface UserInfoRow {
  nombre: string | null;
  apellido: string | null;
  rol_nombre: string | null;
  empresa_nombre: string | null;
}

async function getDashboardMetrics(): Promise<InitialMetrics> {
  let totalOrdenes = 0;
  let totalClientes = 0;

  try {
    const session = await getWorkshopSession();
    const empresaId = session?.empresa_id;

    if (empresaId) {
      const ordenesResult = await query<CountRow>(`
        SELECT COUNT(ot.orden_trabajo_id)::int as count
        FROM admin.ordenes_trabajo ot
        JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
        WHERE (c.empresa_id = $1 OR ot.usuario_registro IN (SELECT usuario_id FROM admin.usuario WHERE empresa_id = $1))
          AND (ot.activo IS DISTINCT FROM false)
      `, [empresaId]);
      if (ordenesResult && ordenesResult[0]?.count != null) {
        totalOrdenes = Number(ordenesResult[0].count) || 0;
      }

      const clientesResult = await query<CountRow>(`
        SELECT COUNT(*)::int as count
        FROM admin.clientes c
        WHERE c.empresa_id = $1
          AND c.fecha_eliminacion IS NULL
          AND (c.activo IS DISTINCT FROM false)
      `, [empresaId]);
      if (clientesResult && clientesResult[0]?.count != null) {
        totalClientes = Number(clientesResult[0].count) || 0;
      }
    }
  } catch (error) {
    console.error("DB query error in Dashboard page.tsx:", error);
  }

  return {
    totalOrdenes,
    totalClientes
  };
}

async function DashboardContent() {
  const metrics = await getDashboardMetrics();
  return <DashboardView initialMetrics={metrics} />;
}

export default async function DashboardPage() {
  const session = await getWorkshopSession();
  if (!session?.usuario_id) {
    redirect("/login");
  }

  // 1. Validar el permiso efectivo de DASHBOARD_MAIN en el motor RBAC
  const perms = await getScreenPermissions("DASHBOARD_MAIN", session.usuario_id);

  // CASO 1: Si tiene permiso, renderizar el Dashboard General normalmente
  if (perms.puede_ver) {
    return (
      <ProtectedServerPage
        screenCode="DASHBOARD_MAIN"
        title="Dashboard General"
        message="Tu rol o usuario no tiene permisos configurados para visualizar el Dashboard Principal."
      >
        <DashboardContent />
      </ProtectedServerPage>
    );
  }

  // CASO 2: Si no tiene permiso, NO ejecutar getDashboardMetrics()
  // Resolver el primer destino operativo autorizado según el orden de prioridad
  const targetPath = await resolveDefaultAuthorizedPath(session.usuario_id);

  if (targetPath && targetPath !== "/") {
    redirect(targetPath);
  }

  // CASO 3: Si no tiene ningún módulo operativo autorizado, mostrar la vista neutral
  let userInfo: UserInfoRow | null = null;
  try {
    const userRows = await query<UserInfoRow>(`
      SELECT ui.nombre, ui.apellido, rf.nombre as rol_nombre, e.nombre_comercial as empresa_nombre
      FROM admin.usuario u
      LEFT JOIN admin.usuario_identidad ui ON u.usuario_id = ui.usuario_id
      LEFT JOIN admin.rol_funcional rf ON u.rol_principal_id = rf.rol_funcional_id
      LEFT JOIN admin.empresa e ON u.empresa_id = e.empresa_id
      WHERE u.usuario_id = $1
      LIMIT 1
    `, [session.usuario_id]);
    if (userRows && userRows.length > 0) {
      userInfo = userRows[0];
    }
  } catch {
    // fallback
  }

  const fullName = userInfo && (userInfo.nombre || userInfo.apellido)
    ? `${userInfo.nombre || ""} ${userInfo.apellido || ""}`.trim()
    : session.nombre_usuario;

  return (
    <NeutralWelcomeView
      user={{
        nombre_completo: fullName,
        nombre_usuario: session.nombre_usuario,
        email: session.email,
        rol_nombre: userInfo?.rol_nombre || null,
        empresa_nombre: userInfo?.empresa_nombre || null
      }}
    />
  );
}
