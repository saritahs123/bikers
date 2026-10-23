import RolesSecurityView from "../components/RolesSecurityView";
import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";

export const metadata = {
  title: "Matriz de Roles (RBAC) | Ride Lab",
};

export default function RolesPage() {
  return (
    <ProtectedServerPage screenCode="SEGURIDAD" title="Matriz de Roles (RBAC)">
      <div className="w-full min-h-screen relative bg-background text-foreground">
        <RolesSecurityView />
      </div>
    </ProtectedServerPage>
  );
}
