"use client";
import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 flex flex-col relative w-full min-w-0">
        <TopBar onMenuToggle={() => setMobileOpen(!mobileOpen)} />
        <main className="ml-0 md:ml-64 mt-16 p-4 md:p-xl h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar w-full md:w-[calc(100%-16rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
