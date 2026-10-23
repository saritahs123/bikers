"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, User, LogOut, RefreshCw, Sparkles } from "lucide-react";

interface NeutralWelcomeViewProps {
  user?: {
    nombre_completo?: string | null;
    nombre_usuario?: string | null;
    email?: string | null;
    rol_nombre?: string | null;
    empresa_nombre?: string | null;
  } | null;
}

export function NeutralWelcomeView({ user }: NeutralWelcomeViewProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
      router.push("/login");
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  const displayName = user?.nombre_completo || user?.nombre_usuario || user?.email || "Usuario";
  const roleName = user?.rol_nombre || "Perfil Estándar";
  const companyName = user?.empresa_nombre || "Biker's Fort Core";

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-card border border-border/80 rounded-3xl p-8 sm:p-10 text-center shadow-xl relative overflow-hidden backdrop-blur-sm">
        {/* Subtle decorative glow accents */}
        <div className="absolute -top-14 -right-14 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-14 -left-14 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        {/* Central Welcoming Icon */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shadow-sm">
          <Shield className="w-8 h-8" />
        </div>

        {/* Brand Welcome Pill */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-surface-subtle border border-border text-foreground-secondary text-xs font-mono font-medium mb-3">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Ride Lab • {companyName}</span>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground mb-3">
          Bienvenido a Ride Lab
        </h1>

        {/* Primary User-Facing Message */}
        <p className="text-sm sm:text-base font-medium text-foreground-secondary mb-4 font-mono">
          Actualmente no tienes módulos habilitados para tu perfil.
        </p>

        {/* Institutional Explanation */}
        <p className="text-xs text-foreground-muted leading-relaxed mb-6 font-mono max-w-md mx-auto">
          Tu cuenta ha sido validada exitosamente en el sistema. Para comenzar a operar con las herramientas de Taller, Facturación, Inventario o Reportes, solicita a tu Administrador la habilitación de los módulos correspondientes a tu rol.
        </p>

        {/* User Account Summary Card */}
        <div className="mb-8 p-3.5 rounded-2xl bg-surface-subtle border border-border/80 text-left font-mono text-xs space-y-1.5 shadow-inner">
          <div className="flex items-center justify-between text-foreground">
            <span className="text-foreground-secondary">Usuario:</span>
            <span className="font-bold truncate max-w-[220px]">{displayName}</span>
          </div>
          <div className="flex items-center justify-between text-foreground">
            <span className="text-foreground-secondary">Rol asignado:</span>
            <span className="font-semibold text-primary">{roleName}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/security/my-profile"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-surface-subtle text-foreground font-mono text-xs font-bold uppercase tracking-wider hover:bg-hover hover:border-primary/40 transition-all cursor-pointer shadow-sm"
          >
            <User className="w-4 h-4 text-foreground-secondary" />
            <span>Mi Perfil</span>
          </Link>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface-subtle text-foreground font-mono text-xs font-bold uppercase tracking-wider hover:bg-hover hover:border-primary/40 transition-all cursor-pointer disabled:opacity-50"
            title="Revisar permisos asignados recientemente"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Verificando..." : "Actualizar"}</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-mono text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition-all cursor-pointer shadow-md shadow-primary/20 disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            <span>{loggingOut ? "Saliendo..." : "Cerrar Sesión"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default NeutralWelcomeView;
