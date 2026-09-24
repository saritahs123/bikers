"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar, AuthenticatedUser } from "@/components/layout/TopBar";

export function DashboardShell({
  user,
  children,
}: {
  user: AuthenticatedUser & { session_expires_at?: string | null };
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 1024;
    }
    return true;
  });

  // Periodic, on-focus, and exact-expiration session validity check
  useEffect(() => {
    let exactTimer: ReturnType<typeof setTimeout> | null = null;

    const checkSessionValidity = async () => {
      try {
        const res = await fetch("/api/auth/heartbeat", { method: "POST" });
        if (res.status === 401) {
          const data = await res.json().catch(() => ({}));
          if (data.error === "SESSION_EXPIRED" || data.error === "SESSION_REVOKED") {
            window.location.href = `/login?reason=${data.error}`;
          }
        }
      } catch {
        // Network or silent error
      }
    };

    // Schedule exact trigger at the moment of expiration
    if (user?.session_expires_at) {
      const expTime = new Date(user.session_expires_at).getTime();
      if (!isNaN(expTime)) {
        const msLeft = expTime - Date.now();
        if (msLeft <= 0) {
          checkSessionValidity();
        } else {
          // Trigger precisely when expiration happens (+200ms buffer)
          exactTimer = setTimeout(() => {
            checkSessionValidity();
          }, msLeft + 200);
        }
      }
    }

    const interval = setInterval(checkSessionValidity, 30000); // Check every 30 seconds
    window.addEventListener("focus", checkSessionValidity);

    return () => {
      if (exactTimer) clearTimeout(exactTimer);
      clearInterval(interval);
      window.removeEventListener("focus", checkSessionValidity);
    };
  }, [user?.session_expires_at]);

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
