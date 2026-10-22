import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getWorkshopSession, getScreenPermissions } from "@/lib/workshop-session";
import { DailyWorkOrdersReportView } from "@/components/reports/DailyWorkOrdersReportView";
import { ReportAccessDenied } from "@/components/reports/ReportAccessDenied";

export const metadata = {
  title: "Reporte de Órdenes de Trabajo por Día | Reportes | Ride Lab",
  description: "Consolidado diario de órdenes de taller, servicios contratados, avance técnico y facturación estimada.",
};

export default async function DailyWorkOrdersReportPage() {
  const session = await getWorkshopSession();
  if (!session || !session.empresa_id) {
    redirect("/login");
  }

  const perms = await getScreenPermissions("/reports/work-orders-daily", session.usuario_id);
  if (!perms.puede_ver) {
    return <ReportAccessDenied />;
  }

  const empRows = await query<{ nombre_comercial: string }>(
    "SELECT nombre_comercial FROM admin.empresa WHERE empresa_id = $1 LIMIT 1",
    [session.empresa_id]
  );
  const companyName = empRows[0]?.nombre_comercial || "Ride Lab";

  return <DailyWorkOrdersReportView initialCompany={companyName} canExport={perms.puede_exportar} />;
}
