import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { getWorkshopSession, getModulePermissions } from "@/lib/workshop-session";
import { InventorySupplierReportView } from "@/components/reports/InventorySupplierReportView";
import { ReportAccessDenied } from "@/components/reports/ReportAccessDenied";

export const metadata = {
  title: "Inventario Total por Suplidor | Reportes | Ride Lab",
  description: "Reporte de existencias y valoración de inventario agrupadas por suplidor comercial.",
};

export default async function InventorySupplierReportPage() {
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

  return <InventorySupplierReportView initialCompany={companyName} />;
}
