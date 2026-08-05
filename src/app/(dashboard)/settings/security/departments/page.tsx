import DepartmentsSecurityView from "../components/DepartmentsSecurityView";

export const metadata = {
  title: "Gestión de Departamentos | Bikers Fort",
};

export default function DepartmentsPage() {
  return (
    <div className="p-4 md:p-6 w-full max-w-[1600px] mx-auto min-h-screen relative bg-[#0e1117]">
      <DepartmentsSecurityView />
    </div>
  );
}
