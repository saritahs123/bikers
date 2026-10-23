"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import BicyclesView from "@/components/crm/BicyclesView";

const VALID_BICYCLE_TABS = new Set(["general", "componentes", "fotos", "historial"]);

export function BicyclesClient() {
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

export default BicyclesClient;
