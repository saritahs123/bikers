import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getWorkshopSession, getScreenPermissions } from "@/lib/workshop-session";
import { DailyCashReportView } from "@/components/reports/DailyCashReportView";
import { ReportAccessDenied } from "@/components/reports/ReportAccessDenied";

export const metadata = {
  title: "Cuadre de Caja Diario | Reportes | Ride Lab",
  description: "Reporte de conciliación de cobros y transacciones de caja por método de pago.",
};

export default async function DailyCashReportPage() {
  const session = await getWorkshopSession();
  if (!session || !session.empresa_id) {
    redirect("/login");
  }

  const perms = await getScreenPermissions("/reports/daily-cash", session.usuario_id);
  if (!perms.puede_ver) {
    return <ReportAccessDenied />;
  }

  const empRows = await query<{ nombre_comercial: string }>(
    "SELECT nombre_comercial FROM admin.empresa WHERE empresa_id = $1 LIMIT 1",
    [session.empresa_id]
  );
  const companyName = empRows[0]?.nombre_comercial || "Ride Lab";

  return <DailyCashReportView initialCompany={companyName} canExport={perms.puede_exportar} />;
}
