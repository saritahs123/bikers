import { Suspense } from "react";
import InventoryStockView from "@/components/inventory/InventoryStockView";

export const dynamic = "force-dynamic";

export default function InventoryStockPage() {
  return (
    <div className="max-w-[1440px] mx-auto">
      <Suspense
        fallback={
          <div className="p-8 text-center text-foreground-muted animate-pulse">
            Cargando Existencias de Inventario...
          </div>
        }
      >
        <InventoryStockView />
      </Suspense>
    </div>
  );
}
