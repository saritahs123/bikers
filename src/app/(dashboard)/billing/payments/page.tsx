import { Suspense } from "react";
import PaymentsView from "@/components/billing/PaymentsView";

export const metadata = {
  title: "Pagos | Ride Lab",
  description: "Historial de transacciones y conciliación de cobranza de facturas.",
};

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs font-mono text-foreground-muted">Cargando Pagos...</div>}>
      <PaymentsView />
    </Suspense>
  );
}
