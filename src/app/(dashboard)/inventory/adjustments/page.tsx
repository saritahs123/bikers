import InventoryAdjustmentsView from "@/components/inventory/InventoryAdjustmentsView";
import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";

export const metadata = {
  title: "Salidas y Ajustes de Inventario | Ride Lab",
  description: "Registra salidas manuales y ajustes de inventario de forma segura y centralizada.",
};

export default function InventoryAdjustmentsPage() {
  return (
    <ProtectedServerPage screenCode="INVENTARIO_SALIDAS_AJUSTES" title="Salidas y Ajustes de Inventario">
      <InventoryAdjustmentsView />
    </ProtectedServerPage>
  );
}
