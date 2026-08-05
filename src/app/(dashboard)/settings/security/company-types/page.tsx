import CompanyTypesSecurityView from "../components/CompanyTypesSecurityView";

export const metadata = {
  title: "Tipos de Empresa | Bikers Fort",
};

export default function CompanyTypesPage() {
  return (
    <div className="p-4 md:p-6 w-full max-w-[1600px] mx-auto min-h-screen relative bg-[var(--bg-color)]">
      <CompanyTypesSecurityView />
    </div>
  );
}
