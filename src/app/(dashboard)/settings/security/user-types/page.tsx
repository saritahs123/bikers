import UserTypesSecurityView from "../components/UserTypesSecurityView";

export const metadata = {
  title: "Gestión de Tipos de Usuario | Bikers Fort",
};

export default function UserTypesPage() {
  return (
    <div className="p-4 md:p-6 w-full max-w-[1600px] mx-auto min-h-screen relative bg-[#0e1117]">
      <UserTypesSecurityView />
    </div>
  );
}
