import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";
import ProductTypesView from "@/components/inventory/catalogs/ProductTypesView";

export default function ProductTypesPage() {
  return (
    <ProtectedServerPage screenCode="CONFIG_TIPOS_PRODUCTO">
      <ProductTypesView />
    </ProtectedServerPage>
  );
}
