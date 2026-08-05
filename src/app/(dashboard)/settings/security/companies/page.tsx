import CompaniesSecurityView from "../components/CompaniesSecurityView";

export const metadata = {
  title: "Gestión de Empresas | Bikers Fort",
};

export default function CompaniesPage() {
  return (
    <div className="p-4 md:p-6 w-full max-w-[1600px] mx-auto min-h-screen relative bg-[#0e1117]">
      <CompaniesSecurityView />
    </div>
  );
}
