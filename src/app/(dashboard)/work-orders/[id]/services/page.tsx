import React, { Suspense } from "react";
import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";
import WorkOrderServicesPageClient from "./WorkOrderServicesPageClient";

export const metadata = {
  title: "Gestión de Servicios de la Orden | Ride Lab",
  description: "Pantalla 11 - Administración completa de servicios, mano de obra y repuestos."
};

export default async function ServicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ProtectedServerPage screenCode="TALLER_ORDENES">
      <Suspense fallback={<div className="p-8 text-xs text-slate-400 font-mono">Cargando Gestión de Servicios...</div>}>
        <WorkOrderServicesPageClient ordenId={id} />
      </Suspense>
    </ProtectedServerPage>
  );
}
