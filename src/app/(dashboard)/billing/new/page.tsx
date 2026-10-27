import NewInvoiceView from "@/components/billing/NewInvoiceView";
import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";

export const metadata = {
  title: "Nueva Factura | Ride Lab",
  description: "Venta directa de productos y servicios con integración de inventario.",
};

export default function NewBillingPage() {
  return (
    <ProtectedServerPage
      screenCode="FACTURACION_NUEVA"
      requiredAction="puede_crear"
    >
      <NewInvoiceView />
    </ProtectedServerPage>
  );
}
