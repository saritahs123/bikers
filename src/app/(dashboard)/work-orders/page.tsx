import { Suspense } from "react";
import WorkOrdersPageClient from "@/components/workshop/WorkOrdersPageClient";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Órdenes de Trabajo | Bikers Fort Core",
  description: "Gestión completa de órdenes de trabajo, seguimiento técnico y servicio al cliente."
};

export default function WorkOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1440px] mx-auto p-12 flex items-center justify-center font-mono text-xs text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#bfce7f]" />
          Cargando Órdenes de Trabajo...
        </div>
      }
    >
      <WorkOrdersPageClient />
    </Suspense>
  );
}
