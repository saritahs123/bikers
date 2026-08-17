import { getWorkshopSession } from "@/lib/workshop-session";
import { query } from "@/lib/db";
import DashboardView from "@/components/dashboard/DashboardView";

export const dynamic = "force-dynamic";

async function getDashboardMetrics() {
  let ordenesActivas = 0;
  let ingresosDia = 0;
  let nuevosClientesSemana = 0;

  try {
    const session = await getWorkshopSession();
    const empresaId = session?.empresa_id;

    if (empresaId) {
      const ordenesResult = await query<any>(`
        SELECT COUNT(*)::int as count 
        FROM admin.ordenes_trabajo ot
        JOIN admin.usuario u_ot ON u_ot.usuario_id = ot.usuario_registro
        WHERE u_ot.empresa_id = $1
          AND (ot.estado_orden_id IS NULL OR ot.estado_orden_id != 8)
          AND (ot.activo IS DISTINCT FROM false)
      `, [empresaId]);
      if (ordenesResult && ordenesResult[0]?.count != null) {
        ordenesActivas = Number(ordenesResult[0].count) || 0;
      }

      const ingresosResult = await query<any>(`
        SELECT COALESCE(SUM(total_factura), 0)::numeric as total 
        FROM admin.facturas f
        JOIN admin.usuario u_fac ON u_fac.usuario_id = f.usuario_registro
        WHERE u_fac.empresa_id = $1
          AND DATE(f.fecha_factura) = CURRENT_DATE
          AND (f.estado IS NULL OR f.estado != 'ANULADA')
      `, [empresaId]);
      if (ingresosResult && ingresosResult[0]?.total != null) {
        ingresosDia = Number(ingresosResult[0].total) || 0;
      }

      const clientesResult = await query<any>(`
        SELECT COUNT(*)::int as count 
        FROM admin.clientes c
        JOIN admin.usuario u_cli ON u_cli.usuario_id = c.usuario_creacion
        WHERE u_cli.empresa_id = $1
          AND (c.activo IS DISTINCT FROM false)
          AND DATE(c.fecha_creacion) >= CURRENT_DATE - INTERVAL '7 days'
      `, [empresaId]);
      if (clientesResult && clientesResult[0]?.count != null) {
        nuevosClientesSemana = Number(clientesResult[0].count) || 0;
      }
    }
  } catch (error) {
    console.error("DB query error in Dashboard page.tsx:", error);
  }

  return {
    ordenesActivas,
    ingresosDia,
    nuevosClientesSemana
  };
}

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics();
  return <DashboardView initialMetrics={metrics} />;
}
