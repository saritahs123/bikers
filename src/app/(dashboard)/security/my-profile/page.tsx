import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getWorkshopSession } from "@/lib/workshop-session";
import UsersSecurityView from "@/app/(dashboard)/settings/security/components/UsersSecurityView";

export const metadata = {
  title: "Mi Perfil | Ride Lab",
};

export default async function MyProfilePage() {
  const session = await getWorkshopSession();
  if (!session || !session.usuario_id) {
    redirect("/login");
  }

  return (
    <div className="p-4 md:p-6 w-full max-w-[1600px] mx-auto min-h-screen relative bg-background text-foreground">
      <Suspense fallback={<div className="p-4 text-xs font-mono text-foreground-muted">Cargando perfil autenticado...</div>}>
        <UsersSecurityView isSelfMode={true} />
      </Suspense>
    </div>
  );
}
