import { Suspense } from "react";
import UsersSecurityView from "../components/UsersSecurityView";

export const metadata = {
  title: "Administrar Usuarios | Ride Lab",
};

export default function UsersPage() {
  return (
    <div className="p-4 md:p-6 w-full max-w-[1600px] mx-auto min-h-screen relative bg-background text-foreground">
      <Suspense fallback={<div className="p-4 text-xs font-mono text-foreground-muted">Cargando usuarios...</div>}>
        <UsersSecurityView />
      </Suspense>
    </div>
  );
}
