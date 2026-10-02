import OrderNotificationsView from "@/components/settings/OrderNotificationsView";

export const metadata = {
  title: "Notificaciones de Órdenes | Ride Lab",
  description: "Consulta y seguimiento de las notificaciones enviadas a clientes.",
};

export default function OrderNotificationsPage() {
  return (
    <div className="w-full h-full flex flex-col min-h-0 relative bg-background text-foreground">
      <OrderNotificationsView />
    </div>
  );
}
