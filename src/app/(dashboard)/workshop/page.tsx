import { Suspense } from "react";
import WorkshopModuleContainer from "@/components/workshop/WorkshopModuleContainer";
import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";

export const metadata = {
  title: "Módulo de Taller | Ride Lab",
  description: "Gestión de recepciones, inspección inicial y firma digital de taller."
};

export default function WorkshopPage() {
  return (
    <ProtectedServerPage screenCode="TALLER_ORDENES" title="Módulo de Taller">
      <Suspense fallback={<div className="p-8 text-xs text-slate-400">Cargando Módulo de Taller...</div>}>
        <WorkshopModuleContainer />
      </Suspense>
    </ProtectedServerPage>
  );
}
