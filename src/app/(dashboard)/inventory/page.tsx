import { redirect } from "next/navigation";
import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";

function InventoryRedirectServer(): null {
  redirect("/inventory/summary");
  return null;
}

export default function InventoryPage() {
  return (
    <ProtectedServerPage screenCode="INVENTARIO_SALIDAS_AJUSTES" title="Módulo de Inventario">
      <InventoryRedirectServer />
    </ProtectedServerPage>
  );
}
