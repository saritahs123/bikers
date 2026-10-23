import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";
import UserTypesSecurityView from "../components/UserTypesSecurityView";

export const metadata = {
  title: "Gestión de Tipos de Usuario | Ride Lab",
};

export default function UserTypesPage() {
  return (
    <ProtectedServerPage screenCode="SEGURIDAD_TIPOS_USUARIO">
      <div className="p-4 md:p-6 w-full max-w-[1600px] mx-auto min-h-screen relative bg-background text-foreground">
        <UserTypesSecurityView />
      </div>
    </ProtectedServerPage>
  );
}
