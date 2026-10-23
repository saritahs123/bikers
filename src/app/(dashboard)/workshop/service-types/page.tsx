import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";
import ServiceTypesView from "@/components/workshop/ServiceTypesView";

export default function ServiceTypesPage() {
  return (
    <ProtectedServerPage screenCode="CONFIG_SERVICIOS">
      <ServiceTypesView />
    </ProtectedServerPage>
  );
}
