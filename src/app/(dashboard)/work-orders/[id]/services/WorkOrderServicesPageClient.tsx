"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import WorkOrderServicesView from "@/components/workshop/WorkOrderServicesView";

export default function WorkOrderServicesPageClient({ ordenId }: { ordenId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/taller/ordenes/${ordenId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar la orden de trabajo.");
      setOrder(data.data);
    } catch (err: unknown) {
      console.error("Error fetching order in Screen 11:", err);
      const errMsg = err instanceof Error ? err.message : "No se pudo cargar la orden.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ordenId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordenId]);

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3 bg-card border border-border rounded-2xl text-foreground-secondary font-mono text-xs max-w-5xl mx-auto my-8 shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span>Cargando servicios de la orden de trabajo #{ordenId}...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-8 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-500 dark:text-rose-400 font-sans text-xs space-y-4 max-w-5xl mx-auto my-8">
        <div className="flex items-center gap-2 font-bold font-mono text-sm">
          <AlertTriangle className="w-5 h-5 text-rose-500 dark:text-rose-400 shrink-0" />
          <span>Error de Carga</span>
        </div>
        <p>{error || "No se encontró la orden de trabajo especificada."}</p>
        <div>
          <Link
            href={`/workshop?order_id=${ordenId}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface-subtle border border-border text-foreground font-mono text-xs rounded-xl hover:bg-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> VOLVER AL DETALLE DE LA OT
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto p-4 sm:p-6 space-y-6">
      {/* Navigation Top Bar */}
      <div className="flex items-center justify-between bg-card p-4 border border-border rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href={`/workshop?order_id=${ordenId}`}
            className="px-4 py-2 bg-surface-subtle hover:bg-hover border border-border text-foreground text-xs font-mono font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 text-foreground-muted" />
            VOLVER AL DETALLE DE LA OT
          </Link>
          <span className="text-foreground-muted text-xs font-mono hidden sm:inline">|</span>
          <span className="text-xs font-mono text-foreground-muted hidden sm:inline">
            Orden: <strong className="text-primary">{order.codigo_orden}</strong>
          </span>
        </div>

        <div className="text-right text-xs font-mono">
          <span className="text-foreground-muted">Estado Orden: </span>
          <span className="font-bold text-foreground uppercase px-2 py-0.5 bg-surface-subtle border border-border rounded-md">
            {order.estado_nombre}
          </span>
        </div>
      </div>

      {/* Screen 11 Main View */}
      <WorkOrderServicesView
        ordenId={parseInt(ordenId, 10)}
        services={order.servicios || []}
        onRefresh={fetchOrder}
        order={order}
        backUrl={`/workshop?order_id=${ordenId}`}
      />
    </div>
  );
}
