import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";
import ClientLevelsView from "@/components/crm/ClientLevelsView";

export default function ClientLevelsPage() {
  return (
    <ProtectedServerPage screenCode="CONFIG_NIVELES_CLIENTES">
      <ClientLevelsView />
    </ProtectedServerPage>
  );
}
