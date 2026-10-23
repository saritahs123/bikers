import { Suspense } from "react";
import PaymentsView from "@/components/billing/PaymentsView";
import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";

export const metadata = {
  title: "Pagos | Ride Lab",
  description: "Historial de transacciones y conciliación de cobranza de facturas.",
};

export default function PaymentsPage() {
  return (
    <ProtectedServerPage screenCode="FACTURACION_PAGOS" title="Cobros y Pagos">
      <Suspense fallback={<div className="p-8 text-xs font-mono text-foreground-muted">Cargando Pagos...</div>}>
        <PaymentsView />
      </Suspense>
    </ProtectedServerPage>
  );
}
