"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export function ReportAccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 font-mono text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-4 shadow-lg animate-in fade-in zoom-in duration-200">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <h1 className="text-xl md:text-2xl font-bold text-foreground mb-2 tracking-tight uppercase">
        Acceso Restringido al Módulo de Reportes
      </h1>

      <p className="text-sm text-foreground-secondary max-w-md mb-6 leading-relaxed">
        Su rol funcional actual no cuenta con autorización para consultar este reporte.
        Comuníquese con el administrador del sistema para solicitar permisos en la matriz de acceso del módulo Seguridad.
      </p>

      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface-subtle text-foreground text-xs font-semibold hover:border-primary/50 hover:bg-hover transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>VOLVER AL INICIO</span>
        </Link>
      </div>
    </div>
  );
}
