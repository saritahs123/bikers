import NewInvoiceView from "@/components/billing/NewInvoiceView";

export const metadata = {
  title: "Nueva Factura | Ride Lab",
  description: "Venta directa de productos y servicios con integración de inventario.",
};

export default function NewBillingPage() {
  return <NewInvoiceView />;
}
