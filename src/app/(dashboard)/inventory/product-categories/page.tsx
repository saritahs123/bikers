import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";
import ProductCategoriesView from "@/components/inventory/catalogs/ProductCategoriesView";

export default function ProductCategoriesPage() {
  return (
    <ProtectedServerPage screenCode="CONFIG_CATEGORIAS_PRODUCTO">
      <ProductCategoriesView />
    </ProtectedServerPage>
  );
}
