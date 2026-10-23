import InventoryTransfersView from "@/components/inventory/InventoryTransfersView";
import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";

export const metadata = {
  title: "Transferencias de Inventario | Ride Lab",
  description: "Mueve productos entre almacenes de la misma empresa de forma atómica y segura.",
};

export default function InventoryTransfersPage() {
  return (
    <ProtectedServerPage screenCode="INVENTARIO_TRANSFERENCIAS" title="Transferencias de Inventario">
      <InventoryTransfersView />
    </ProtectedServerPage>
  );
}
