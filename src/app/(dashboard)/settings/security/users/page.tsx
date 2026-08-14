import { Suspense } from "react";
import UsersSecurityView from "../components/UsersSecurityView";

export const metadata = {
  title: "Administrar Usuarios | Bikers Fort",
};

export default function UsersPage() {
  return (
    <div className="p-4 md:p-6 w-full max-w-[1600px] mx-auto min-h-screen relative bg-[var(--bg-color)]">
      <Suspense fallback={<div className="p-4 text-xs text-slate-400">Cargando usuarios...</div>}>
        <UsersSecurityView />
      </Suspense>
    </div>
  );
}
