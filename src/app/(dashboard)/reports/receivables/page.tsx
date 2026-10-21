import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { ReceivablesReportView } from "@/components/reports/ReceivablesReportView";
import { ReportAccessDenied } from "@/components/reports/ReportAccessDenied";

export const metadata = {
  title: "Cuentas por Cobrar | Reportes | Ride Lab",
  description: "Reporte de facturas con balance pendiente y gestión de cobros de clientes.",
};

export default async function ReceivablesReportPage() {
  const session = await getWorkshopSession();
  if (!session || !session.empresa_id) {
    redirect("/login");
  }

  const perms = await getModulePermissions("REPORTES", session.usuario_id);
  if (!perms.puede_ver) {
    return <ReportAccessDenied />;
  }

  // Fetch company commercial name
  const empRows = await query<{ nombre_comercial: string }>(
    "SELECT nombre_comercial FROM admin.empresa WHERE empresa_id = $1 LIMIT 1",
    [session.empresa_id]
  );
  const companyName = empRows[0]?.nombre_comercial || "Ride Lab";

  return <ReceivablesReportView initialCompany={companyName} />;
}
