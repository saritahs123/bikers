import { getWorkshopSession } from "@/lib/workshop-session";
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
  const metrics = await getDashboardMetrics();
  return <DashboardView initialMetrics={metrics} />;
}
