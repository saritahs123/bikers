import { Suspense } from "react";
import WorkshopModuleContainer from "@/components/workshop/WorkshopModuleContainer";

export const metadata = {
  title: "Módulo de Taller | Ride Lab",
  description: "Gestión de recepciones, inspección inicial y firma digital de taller."
};

export default function WorkshopPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-slate-400">Cargando Módulo de Taller...</div>}>
      <WorkshopModuleContainer />
    </Suspense>
  );
}
