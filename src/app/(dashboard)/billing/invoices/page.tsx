import { Suspense } from "react";
import InvoicesView from "@/components/billing/InvoicesView";

export const metadata = {
  title: "Facturas | Ride Lab",
  description: "Consulta, detalle y administración de facturas emitidas.",
};

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs font-mono text-foreground-muted">Cargando Facturas...</div>}>
      <InvoicesView />
    </Suspense>
  );
}
