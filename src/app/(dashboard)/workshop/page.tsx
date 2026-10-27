import { Suspense } from "react";
import WorkshopModuleContainer from "@/components/workshop/WorkshopModuleContainer";
import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";

export const metadata = {
  title: "Módulo de Taller | Ride Lab",
  description: "Gestión de recepciones, inspección inicial y firma digital de taller."
};

export default async function WorkshopPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string; action?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const view = params?.view;

  let screenCode = "TALLER_ORDENES";
  let title = "Módulo de Taller";

  if (view === "billing") {
    screenCode = "FACTURACION_DESPACHO";
    title = "Despacho de Órdenes";
  } else if (view === "list") {
    screenCode = "TALLER_RECEPCIONES";
    title = "Recepciones de Taller";
  } else if (view === "kanban") {
    screenCode = "TALLER_KANBAN";
    title = "Tablero Kanban de Taller";
  } else if (view === "work_orders") {
    screenCode = "TALLER_ORDENES";
    title = "Órdenes de Trabajo";
  }

  return (
    <ProtectedServerPage screenCode={screenCode} title={title}>
      <Suspense fallback={<div className="p-8 text-xs text-slate-400">Cargando Módulo de Taller...</div>}>
        <WorkshopModuleContainer />
      </Suspense>
    </ProtectedServerPage>
  );
}
