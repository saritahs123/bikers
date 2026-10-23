import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";
import OrderStatusesView from "@/components/workshop/OrderStatusesView";

export default function OrderStatusesPage() {
  return (
    <ProtectedServerPage screenCode="CONFIG_ESTADOS_ORDEN">
      <OrderStatusesView />
    </ProtectedServerPage>
  );
}
