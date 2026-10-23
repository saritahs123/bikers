import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";
import InventoryInitialView from "@/components/inventory/InventoryInitialView";

export const metadata = {
  title: "Inventario Inicial | Ride Lab",
  description: "Registra el inventario físico inicial de tus productos por almacén.",
};

export default function InventoryInitialPage() {
  return (
    <ProtectedServerPage screenCode="CONFIG_INVENTARIO_INICIAL">
      <InventoryInitialView />
    </ProtectedServerPage>
  );
}
