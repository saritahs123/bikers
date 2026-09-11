import InventoryTransfersView from "@/components/inventory/InventoryTransfersView";

export const metadata = {
  title: "Transferencias de Inventario | Ride Lab",
  description: "Mueve productos entre almacenes de la misma empresa de forma atómica y segura.",
};

export default function InventoryTransfersPage() {
  return <InventoryTransfersView />;
}
