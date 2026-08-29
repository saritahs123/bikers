import RolesSecurityView from "../components/RolesSecurityView";

export const metadata = {
  title: "Matriz de Roles (RBAC) | Bikers Fort",
};

export default function RolesPage() {
  return (
    <div className="p-4 md:p-6 w-full max-w-[1600px] mx-auto min-h-screen relative bg-background text-foreground">
      <RolesSecurityView />
    </div>
  );
}
