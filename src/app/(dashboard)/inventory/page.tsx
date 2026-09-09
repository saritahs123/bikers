"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";

function InventoryRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/inventory/summary");
  }, [router]);
  return null;
}

export default function InventoryPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-foreground-muted animate-pulse">
          Cargando Inventario...
        </div>
      }
    >
      <InventoryRedirect />
    </Suspense>
  );
}
