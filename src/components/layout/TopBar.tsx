"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Moon, Sun, Check, Menu } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export interface AuthenticatedUser {
  usuario_id: number;
  nombre_completo: string;
  nombre: string;
  apellido: string;
  identificador_principal: string;
  correo_acceso: string;
  correo_electronico: string;
  rol_nombre: string;
  cargo_nombre: string;
  empresa_nombre: string;
  iniciales: string;
  foto_url: string | null;
}

export function TopBar({
  user,
  isSidebarOpen = false,
  onMenuToggle,
}: {
  user: AuthenticatedUser;
  isSidebarOpen?: boolean;
  onMenuToggle?: () => void;
}) {
  const router = useRouter();
  const { theme, setTheme, isDark, isLight } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (err) {
      console.error("Error durante el cierre de sesión:", err);
      router.push("/login");
    }
  };

  const accessLabel = user.identificador_principal || user.correo_electronico || "Sin identificador";

  return (
    <header
      className={`fixed top-0 right-0 h-16 bg-surface border-b border-border flex justify-between items-center px-4 md:px-xl z-30 transition-all duration-300 ease-in-out ${
        isSidebarOpen ? "md:left-64 md:w-[calc(100%-16rem)] left-0 w-full" : "left-0 w-full"
      }`}
    >
      <div className="flex items-center gap-3 md:gap-4 min-w-0">
        <button
          type="button"
          onClick={onMenuToggle}
          className="p-2 rounded-xl border border-border bg-surface-subtle text-foreground-secondary hover:text-primary hover:border-primary/50 hover:bg-hover transition-all cursor-pointer flex items-center justify-center shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 shrink-0"
          title={isSidebarOpen ? "Ocultar menú" : "Mostrar menú"}
          aria-label={isSidebarOpen ? "Ocultar menú de navegación" : "Mostrar menú de navegación"}
        >
          <Menu className="w-5 h-5 transition-colors" />
        </button>

        <Link
          href="/"
          className="flex items-center transition-transform hover:scale-[1.02] focus:outline-none shrink-0"
          title="Bikers' Fort Core"
        >
          <Image
            src="/logo.png"
            alt="Bikers' Fort Logo"
            width={160}
            height={50}
            className="h-9 sm:h-11 md:h-12 w-auto object-contain shrink-0"
            priority
          />
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {/* Quick Theme Switcher Button */}
        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="p-2 rounded-xl border border-border bg-surface-subtle text-foreground-secondary hover:text-primary hover:border-primary/40 transition-all cursor-pointer flex items-center justify-center shadow-sm"
          title={isDark ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
          aria-label="Cambiar tema de apariencia"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-primary" />
          )}
        </button>

        {/* Authenticated User Banner & Profile Menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-3 hover:opacity-90 transition-all cursor-pointer focus:outline-none"
            title="Ver perfil y ajustes"
          >
            <div className="text-right hidden lg:block font-sans">
              <p className="text-[13px] font-bold text-foreground leading-tight">
                {user.nombre_completo}
              </p>
              <p className="text-[11px] text-foreground-muted leading-tight font-mono mt-0.5">
                {user.cargo_nombre || user.rol_nombre}
              </p>
            </div>

            <div className="w-10 h-10 rounded-full border border-primary/40 bg-primary/15 text-primary flex items-center justify-center font-mono font-bold text-xs shadow-md overflow-hidden shrink-0">
              {user.foto_url ? (
                <img src={user.foto_url} alt={user.nombre_completo} className="w-full h-full object-cover" />
              ) : (
                <span>{user.iniciales}</span>
              )}
            </div>
          </button>

          {/* Profile Dropdown Menu */}
          {dropdownOpen && user && (
            <div className="absolute right-0 mt-3 w-80 bg-surface-elevated border border-border rounded-2xl shadow-2xl z-50 overflow-hidden font-sans animate-in fade-in duration-150 text-foreground">
              {/* User Header */}
              <div className="p-4 bg-surface-subtle border-b border-border flex items-center gap-3">
                <div className="w-11 h-11 rounded-full border border-primary/40 bg-primary/15 text-primary flex items-center justify-center font-mono font-bold text-sm overflow-hidden shrink-0">
                  {user.foto_url ? (
                    <img src={user.foto_url} alt={user.nombre_completo} className="w-full h-full object-cover" />
                  ) : (
                    <span>{user.iniciales}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{user.nombre_completo}</p>
                  <p className="text-xs text-foreground-muted font-mono truncate" title={`Identificador de acceso: ${accessLabel}`}>
                    Acceso: {accessLabel}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-primary/15 text-primary border border-primary/30 rounded text-[10px] font-mono font-bold">
                    {user.empresa_nombre}
                  </span>
                </div>
              </div>

              <div className="p-2 space-y-1.5">
                {/* Role / Position Details */}
                <div className="px-3 py-2 text-xs font-mono text-foreground-muted border-b border-border mb-1 space-y-1">
                  <div className="flex justify-between items-center">
                    <span>Rol:</span>
                    <span className="text-foreground font-bold">{user.rol_nombre}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Cargo:</span>
                    <span className="text-foreground font-bold">{user.cargo_nombre}</span>
                  </div>
                </div>

                {/* Appearance Switcher Section */}
                <div className="px-3 py-2 border-b border-border">
                  <span className="text-[10px] font-mono font-bold text-foreground-muted uppercase tracking-wider block mb-2">
                    Apariencia
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTheme("dark")}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer border ${
                        isDark
                          ? "bg-primary/15 border-primary/40 text-primary font-bold shadow-sm"
                          : "bg-surface-subtle border-border/60 text-foreground-muted hover:text-foreground hover:bg-hover"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Moon className="w-3.5 h-3.5 shrink-0" />
                        <span>Dark</span>
                      </div>
                      {isDark && <Check className="w-3.5 h-3.5 text-primary" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme("light")}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer border ${
                        isLight
                          ? "bg-primary/15 border-primary/40 text-primary font-bold shadow-sm"
                          : "bg-surface-subtle border-border/60 text-foreground-muted hover:text-foreground hover:bg-hover"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Sun className="w-3.5 h-3.5 shrink-0" />
                        <span>Light</span>
                      </div>
                      {isLight && <Check className="w-3.5 h-3.5 text-primary" />}
                    </button>
                  </div>
                </div>

                {/* Profile Link */}
                <Link
                  href="/security/my-profile"
                  onClick={() => setDropdownOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-mono text-foreground-secondary hover:bg-hover hover:text-primary transition-all text-left cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">manage_accounts</span>
                  <span>Mi Perfil</span>
                </Link>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-mono text-error hover:bg-error-muted hover:text-error transition-all text-left cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  <span>{loggingOut ? "Cerrando sesión..." : "Cerrar Sesión"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
