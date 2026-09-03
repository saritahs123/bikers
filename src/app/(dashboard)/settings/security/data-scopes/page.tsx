import DataScopesSecurityView from "../components/DataScopesSecurityView";

export const metadata = {
  title: "Alcance de Datos | Ride Lab",
};

export default function DataScopesPage() {
  return (
    <div className="p-4 md:p-6 w-full max-w-[1600px] mx-auto min-h-screen relative bg-background text-foreground">
      <DataScopesSecurityView />
    </div>
  );
}
