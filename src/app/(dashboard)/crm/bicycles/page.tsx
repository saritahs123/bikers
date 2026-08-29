"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import BicyclesView from "@/components/crm/BicyclesView";

const VALID_BICYCLE_TABS = new Set(["general", "componentes", "fotos", "historial"]);

function BicyclesPageContent() {
  const searchParams = useSearchParams();
  const rawId = searchParams.get("id") || searchParams.get("bikeId");
  const tabParam = searchParams.get("tab");

  const bikeId = rawId ? parseInt(rawId, 10) : null;
  const initialTab = tabParam && VALID_BICYCLE_TABS.has(tabParam) ? tabParam : "general";

  return (
    <BicyclesView
      initialBikeId={(bikeId && !isNaN(bikeId)) ? bikeId : null}
      initialTab={initialTab}
    />
  );
}

export default function BicyclesPage() {
  return (
    <Suspense fallback={
      <div className="p-12 flex flex-col items-center justify-center bg-card border border-border rounded-2xl text-foreground-muted gap-3 font-mono min-h-[400px]">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-bold text-foreground">Cargando módulo de bicicletas...</span>
      </div>
    }>
      <BicyclesPageContent />
    </Suspense>
  );
}
