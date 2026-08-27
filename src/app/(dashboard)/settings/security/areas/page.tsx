import AreasSecurityView from "../components/AreasSecurityView";

export const metadata = {
  title: "Gestión de Áreas | Bikers Fort",
};

export default function AreasPage() {
  return (
    <div className="p-4 md:p-6 w-full max-w-[1600px] mx-auto min-h-screen relative bg-background text-foreground">
      <AreasSecurityView />
    </div>
  );
}
