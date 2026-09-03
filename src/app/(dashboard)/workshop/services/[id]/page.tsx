import React, { Suspense } from "react";
import WorkOrderServicesPageClient from "@/app/(dashboard)/work-orders/[id]/services/WorkOrderServicesPageClient";

export const metadata = {
  title: "Gestión de Servicios de la Orden | Ride Lab",
  description: "Pantalla 11 - Administración completa de servicios, mano de obra y repuestos."
};

export default async function WorkshopServicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="p-8 text-xs text-slate-400 font-mono">Cargando Gestión de Servicios...</div>}>
      <WorkOrderServicesPageClient ordenId={id} />
    </Suspense>
  );
}
