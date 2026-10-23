import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";
import ProductBrandsView from "@/components/inventory/catalogs/ProductBrandsView";

export default function ProductBrandsPage() {
  return (
    <ProtectedServerPage screenCode="CONFIG_MARCAS_PRODUCTO">
      <ProductBrandsView />
    </ProtectedServerPage>
  );
}
