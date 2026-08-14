"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  onMenuToggle,
}: {
  user: AuthenticatedUser;
  onMenuToggle?: () => void;
}) {
  const router = useRouter();
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
    <header className="fixed top-0 right-0 h-16 ml-0 md:ml-64 w-full md:w-[calc(100%-16rem)] bg-surface border-b border-outline-variant flex justify-between items-center px-4 md:px-xl z-40">
      <div className="flex items-center gap-md">
        <button
          type="button"
          onClick={onMenuToggle}
          className="md:hidden text-slate-300 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center"
          title="Abrir menú de navegación"
        >
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>
      </div>

      <div className="flex items-center gap-lg">
        <div className="flex items-center gap-md">
          <button className="relative text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-0 right-0 w-2 h-2 bg-error rounded-full border border-surface"></span>
          </button>
          <Link
            href="/security/my-profile"
            aria-label="Mi perfil y seguridad"
            className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer flex items-center justify-center"
          >
            <span className="material-symbols-outlined">settings</span>
          </Link>
        </div>

        <div className="h-8 w-[1px] bg-outline-variant"></div>

        {/* Authenticated User Banner & Profile Menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-3 hover:opacity-90 transition-all cursor-pointer focus:outline-none"
            title="Ver perfil de usuario"
          >
            <div className="text-right hidden lg:block font-sans">
              <p className="text-[13px] font-bold text-slate-100 leading-tight">
                {user.nombre_completo}
              </p>
              <p className="text-[11px] text-slate-400 leading-tight font-mono mt-0.5">
                {user.cargo_nombre || user.rol_nombre}
              </p>
            </div>

            <div className="w-10 h-10 rounded-full border border-[#bfce7f]/40 bg-[#84924a]/20 text-[#bfce7f] flex items-center justify-center font-mono font-bold text-xs shadow-md overflow-hidden shrink-0">
              {user.foto_url ? (
                <img src={user.foto_url} alt={user.nombre_completo} className="w-full h-full object-cover" />
              ) : (
                <span>{user.iniciales}</span>
              )}
            </div>
          </button>

          {/* Profile Dropdown Menu */}
          {dropdownOpen && user && (
            <div className="absolute right-0 mt-3 w-72 bg-[#161a21] border border-[#2d3748] rounded-2xl shadow-2xl z-50 overflow-hidden font-sans animate-in fade-in duration-150">
              <div className="p-4 bg-[#1c2129] border-b border-[#2d3748] flex items-center gap-3">
                <div className="w-11 h-11 rounded-full border border-[#bfce7f]/40 bg-[#84924a]/20 text-[#bfce7f] flex items-center justify-center font-mono font-bold text-sm overflow-hidden shrink-0">
                  {user.foto_url ? (
                    <img src={user.foto_url} alt={user.nombre_completo} className="w-full h-full object-cover" />
                  ) : (
                    <span>{user.iniciales}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-100 truncate">{user.nombre_completo}</p>
                  <p className="text-xs text-slate-400 font-mono truncate" title={`Identificador de acceso: ${accessLabel}`}>
                    Acceso: {accessLabel}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-[#84924a]/20 text-[#bfce7f] border border-[#bfce7f]/30 rounded text-[10px] font-mono font-bold">
                    {user.empresa_nombre}
                  </span>
                </div>
              </div>

              <div className="p-2 space-y-1">
                <div className="px-3 py-2 text-xs font-mono text-slate-400 border-b border-slate-800/80 mb-1">
                  <div className="flex justify-between items-center">
                    <span>Rol:</span>
                    <span className="text-slate-200 font-bold">{user.rol_nombre}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span>Cargo:</span>
                    <span className="text-slate-200 font-bold">{user.cargo_nombre}</span>
                  </div>
                </div>

                <Link
                  href="/security/my-profile"
                  onClick={() => setDropdownOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-mono text-slate-200 hover:bg-[#252c37] hover:text-[#bfce7f] transition-all text-left cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">manage_accounts</span>
                  <span>Mi Perfil</span>
                </Link>

                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-mono text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 transition-all text-left cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base text-rose-400">logout</span>
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
