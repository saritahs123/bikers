import { getWorkshopSession, getScreenPermissions } from "@/lib/workshop-session";
import { query } from "@/lib/db";
import DashboardView from "@/components/dashboard/DashboardView";

export const dynamic = "force-dynamic";

interface InitialMetrics {
  totalOrdenes: number;
  totalClientes: number;
}

async function getDashboardMetrics(): Promise<InitialMetrics> {
  let totalOrdenes = 0;
  let totalClientes = 0;

  try {
    const session = await getWorkshopSession();
    const empresaId = session?.empresa_id;

    if (empresaId) {
      const ordenesResult = await query<any>(`
        SELECT COUNT(ot.orden_trabajo_id)::int as count
        FROM admin.ordenes_trabajo ot
        JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
        WHERE (c.empresa_id = $1 OR ot.usuario_registro IN (SELECT usuario_id FROM admin.usuario WHERE empresa_id = $1))
          AND (ot.activo IS DISTINCT FROM false)
      `, [empresaId]);
      if (ordenesResult && ordenesResult[0]?.count != null) {
        totalOrdenes = Number(ordenesResult[0].count) || 0;
      }

      const clientesResult = await query<any>(`
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

export default async function DashboardPage() {
  const session = await getWorkshopSession();
  if (session?.usuario_id) {
    const perms = await getScreenPermissions("/", session.usuario_id);
    if (!perms.puede_ver) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
          <div className="max-w-md p-8 bg-card border border-border rounded-2xl shadow-sm">
            <h2 className="text-xl font-bold text-foreground mb-2">Acceso No Autorizado</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Tu rol o usuario no tiene permisos configurados para visualizar el Dashboard Principal.
            </p>
            <p className="text-xs text-muted-foreground">
              Utiliza el menú lateral para acceder a los módulos autorizados asignados a tu cuenta.
            </p>
          </div>
        </div>
      );
    }
  }

  const metrics = await getDashboardMetrics();
  return <DashboardView initialMetrics={metrics} />;
}
