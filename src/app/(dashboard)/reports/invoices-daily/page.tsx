import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { DailyInvoicesReportView } from "@/components/reports/DailyInvoicesReportView";
import { ReportAccessDenied } from "@/components/reports/ReportAccessDenied";

export const metadata = {
  title: "Reporte de Facturas por Día | Reportes | Ride Lab",
  description: "Consolidado diario de emisión de facturas, recaudación efectiva y saldos pendientes.",
};

export default async function DailyInvoicesReportPage() {
  const session = await getWorkshopSession();
  if (!session || !session.empresa_id) {
    redirect("/login");
  }

  const perms = await getModulePermissions("REPORTES", session.usuario_id);
  if (!perms.puede_ver) {
    return <ReportAccessDenied />;
  }

  const empRows = await query<{ nombre_comercial: string }>(
    "SELECT nombre_comercial FROM admin.empresa WHERE empresa_id = $1 LIMIT 1",
    [session.empresa_id]
  );
  const companyName = empRows[0]?.nombre_comercial || "Ride Lab";

  return <DailyInvoicesReportView initialCompany={companyName} />;
}
