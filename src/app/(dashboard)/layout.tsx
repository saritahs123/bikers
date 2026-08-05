import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col relative w-full">
        <TopBar />
        <main className="ml-64 mt-16 p-xl h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar w-[calc(100%-16rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
