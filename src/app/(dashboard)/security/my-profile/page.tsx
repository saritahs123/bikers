import { Suspense } from "react";
import UsersSecurityView from "@/app/(dashboard)/settings/security/components/UsersSecurityView";

export const metadata = {
  title: "Mi Perfil | Bikers Fort",
};

export default function MyProfilePage() {
  return (
    <div className="p-4 md:p-6 w-full max-w-[1600px] mx-auto min-h-screen relative bg-[var(--bg-color)]">
      <Suspense fallback={<div className="p-4 text-xs font-mono text-slate-400">Cargando perfil autenticado...</div>}>
        <UsersSecurityView isSelfMode={true} />
      </Suspense>
    </div>
  );
}
