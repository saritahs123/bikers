import { Suspense } from "react";
import InventorySummaryView from "@/components/inventory/InventorySummaryView";

export const dynamic = "force-dynamic";

export default function InventorySummaryPage() {
  return (
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
  );
}
