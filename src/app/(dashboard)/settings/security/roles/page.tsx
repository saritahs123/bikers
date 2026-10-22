import RolesSecurityView from "../components/RolesSecurityView";

export const metadata = {
  title: "Matriz de Roles (RBAC) | Ride Lab",
};

export default function RolesPage() {
  return (
    <div className="w-full min-h-screen relative bg-background text-foreground">
      <RolesSecurityView />
    </div>
  );
}
