import { Suspense } from "react";
import InventoryMovementsView from "@/components/inventory/InventoryMovementsView";

export const dynamic = "force-dynamic";

export default function InventoryMovementsPage() {
  return (
    <div className="max-w-[1440px] mx-auto">
      <Suspense
        fallback={
          <div className="p-8 text-center text-foreground-muted animate-pulse">
            Cargando Movimientos de Inventario...
          </div>
        }
      >
        <InventoryMovementsView />
      </Suspense>
    </div>
  );
}
