import CustomersView from "@/components/crm/CustomersView";
import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";

export const metadata = {
  title: "Clientes CRM | Ride Lab",
  description: "Gestión centralizada de clientes y cuentas.",
};

export default function CustomersPage() {
  return (
    <ProtectedServerPage screenCode="CRM_CLIENTES" title="Clientes CRM">
      <CustomersView />
    </ProtectedServerPage>
  );
}
