"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar, AuthenticatedUser } from "@/components/layout/TopBar";

export function DashboardShell({
  user,
  children,
}: {
  user: AuthenticatedUser;
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Close sidebar on mobile/tablet on initial client mount
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, []);

  const handleNavigate = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNavigate={handleNavigate}
      />
      <div className="flex-1 flex flex-col relative w-full min-w-0">
        <TopBar
          user={user}
          isSidebarOpen={isSidebarOpen}
          onMenuToggle={() => setIsSidebarOpen((prev) => !prev)}
        />
        <main
          className={`mt-16 p-4 md:p-8 h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar w-full transition-all duration-300 ease-in-out ${
            isSidebarOpen ? "md:ml-64 md:w-[calc(100%-16rem)]" : "ml-0 w-full"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
