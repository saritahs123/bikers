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
      initialBikeId={(bikeId && !isNaN(bikeId)) ? bikeId : undefined}
      initialTab={initialTab}
    />
  );
}

export default function BicyclesPage() {
  return (
    <Suspense fallback={
      <div className="p-12 flex flex-col items-center justify-center bg-[#161a21] border border-[#2d3748] rounded-2xl text-slate-400 gap-3 font-mono min-h-[400px]">
        <div className="w-6 h-6 border-2 border-[#bfce7f] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-bold text-slate-300">Cargando módulo de bicicletas...</span>
      </div>
    }>
      <BicyclesPageContent />
    </Suspense>
  );
}
