import PositionsSecurityView from "../components/PositionsSecurityView";

export const metadata = {
  title: "Gestión de Cargos | Ride Lab",
};

export default function PositionsPage() {
  return (
    <div className="p-4 md:p-6 w-full max-w-[1600px] mx-auto min-h-screen relative bg-background text-foreground">
      <PositionsSecurityView />
    </div>
  );
}
