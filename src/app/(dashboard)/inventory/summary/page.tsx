import { Suspense } from "react";
import InventorySummaryView from "@/components/inventory/InventorySummaryView";
import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";

export const dynamic = "force-dynamic";

export default function InventorySummaryPage() {
  return (
    <ProtectedServerPage screenCode="INVENTARIO_SALIDAS_AJUSTES" title="Resumen de Inventario">
      <div className="max-w-[1440px] mx-auto">
        <Suspense
          fallback={
            <div className="p-8 text-center text-foreground-muted animate-pulse">
              Cargando Resumen de Inventario...
            </div>
          }
        >
          <InventorySummaryView />
        </Suspense>
      </div>
    </ProtectedServerPage>
  );
}
