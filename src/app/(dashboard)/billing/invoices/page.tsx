import { Suspense } from "react";
import InvoicesView from "@/components/billing/InvoicesView";
import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";

export const metadata = {
  title: "Facturas | Ride Lab",
  description: "Consulta, detalle y administración de facturas emitidas.",
};

export default function InvoicesPage() {
  return (
    <ProtectedServerPage screenCode="FACTURACION_FACTURAS" title="Facturas Emitidas">
      <Suspense fallback={<div className="p-8 text-xs font-mono text-foreground-muted">Cargando Facturas...</div>}>
        <InvoicesView />
      </Suspense>
    </ProtectedServerPage>
  );
}
