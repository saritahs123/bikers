import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";
import InventoryEntriesView from "@/components/inventory/InventoryEntriesView";

export const metadata = {
  title: "Entradas de Inventario | Ride Lab",
  description: "Registrar la mercancía que ingresa al inventario por compras u otras operaciones.",
};

export default function InventoryEntriesPage() {
  return (
    <ProtectedServerPage screenCode="INVENTARIO_ENTRADAS">
      <InventoryEntriesView />
    </ProtectedServerPage>
  );
}
