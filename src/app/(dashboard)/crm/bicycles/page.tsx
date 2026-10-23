import React, { Suspense } from "react";
import BicyclesClient from "./BicyclesClient";
import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";

export const metadata = {
  title: "Bicicletas CRM | Ride Lab",
  description: "Expediente digital, componentes y trazabilidad de bicicletas.",
};

export default function BicyclesPage() {
  return (
    <ProtectedServerPage screenCode="CRM_BICICLETAS" title="Bicicletas CRM">
      <Suspense fallback={
        <div className="p-12 flex flex-col items-center justify-center bg-card border border-border rounded-2xl text-foreground-muted gap-3 font-mono min-h-[400px]">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-foreground">Cargando módulo de bicicletas...</span>
        </div>
      }>
        <BicyclesClient />
      </Suspense>
    </ProtectedServerPage>
  );
}
