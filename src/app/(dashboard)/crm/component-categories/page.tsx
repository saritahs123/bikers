import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";
import ComponentCategoriesView from "@/components/crm/ComponentCategoriesView";

export default function ComponentCategoriesPage() {
  return (
    <ProtectedServerPage screenCode="CONFIG_CATEGORIAS_COMPONENTES">
      <ComponentCategoriesView />
    </ProtectedServerPage>
  );
}
