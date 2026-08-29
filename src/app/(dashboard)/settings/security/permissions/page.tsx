import PermissionsSecurityView from "../components/PermissionsSecurityView";

export const metadata = {
  title: "Reglas Operativas | Bikers Fort",
};

export default function PermissionsPage() {
  return (
    <div className="p-4 md:p-6 w-full max-w-[1600px] mx-auto min-h-screen relative bg-background text-foreground">
      <PermissionsSecurityView />
    </div>
  );
}
