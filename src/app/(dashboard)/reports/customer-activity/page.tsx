import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { CustomerActivityReportView } from "@/components/reports/CustomerActivityReportView";
import { ReportAccessDenied } from "@/components/reports/ReportAccessDenied";

export const metadata = {
  title: "Actividad de Clientes por Antigüedad | Reportes | Ride Lab",
  description: "Reporte de recurrencia de clientes según tiempo transcurrido desde el último servicio.",
};

export default async function CustomerActivityReportPage() {
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

  return <CustomerActivityReportView initialCompany={companyName} />;
}
