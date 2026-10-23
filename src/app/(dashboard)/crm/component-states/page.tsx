import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";
import ComponentStatesView from "@/components/crm/ComponentStatesView";

export default function ComponentStatesPage() {
  return (
    <ProtectedServerPage screenCode="CONFIG_ESTADOS_COMPONENTES">
      <ComponentStatesView />
    </ProtectedServerPage>
  );
}
