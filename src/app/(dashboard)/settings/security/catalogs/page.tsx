import CatalogsSecurityView from "../components/CatalogsSecurityView";

export const metadata = {
  title: "Panel de Catálogos Maestros | Bikers Fort",
};

export default function CatalogsPage() {
  return (
    <div className="p-4 md:p-6 w-full max-w-[1600px] mx-auto min-h-screen relative bg-[var(--bg-color)]">
      <CatalogsSecurityView />
    </div>
  );
}
