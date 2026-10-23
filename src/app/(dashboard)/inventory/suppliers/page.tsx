import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";
import SuppliersView from "@/components/inventory/catalogs/SuppliersView";

export default function SuppliersPage() {
  return (
    <ProtectedServerPage screenCode="CONFIG_PROVEEDORES">
      <SuppliersView />
    </ProtectedServerPage>
  );
}
