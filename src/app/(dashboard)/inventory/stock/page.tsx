import { Suspense } from "react";
import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";
import InventoryStockView from "@/components/inventory/InventoryStockView";

export const dynamic = "force-dynamic";

export default function InventoryStockPage() {
  return (
    <ProtectedServerPage screenCode="INVENTARIO_EXISTENCIAS">
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
    </ProtectedServerPage>
  );
}
