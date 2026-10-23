import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";
import ProductsView from "@/components/workshop/ProductsView";

export default function ProductsPage() {
  return (
    <ProtectedServerPage screenCode="CONFIG_PRODUCTOS_TALLER">
      <ProductsView />
    </ProtectedServerPage>
  );
}
