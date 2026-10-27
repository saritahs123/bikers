import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";
import CompanyTypesSecurityView from "../components/CompanyTypesSecurityView";

export const metadata = {
  title: "Tipos de Empresa | Ride Lab",
};

export default function CompanyTypesPage() {
  return (
    <ProtectedServerPage screenCode="SEGURIDAD_TIPOS_EMPRESA">
      <div className="p-4 md:p-6 w-full max-w-[1600px] mx-auto min-h-screen relative bg-background text-foreground">
        <CompanyTypesSecurityView />
      </div>
    </ProtectedServerPage>
  );
}
