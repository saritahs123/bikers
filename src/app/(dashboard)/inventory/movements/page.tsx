import { Suspense } from "react";
import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";
import InventoryMovementsView from "@/components/inventory/InventoryMovementsView";

export const dynamic = "force-dynamic";

export default function InventoryMovementsPage() {
  return (
    <ProtectedServerPage screenCode="INVENTARIO_MOVIMIENTOS">
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
    </ProtectedServerPage>
  );
}
