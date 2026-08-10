"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import WorkOrderServicesView from "@/components/workshop/WorkOrderServicesView";

export default function WorkOrderServicesPageClient({ ordenId }: { ordenId: string }) {
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
    } catch (err: any) {
      console.error("Error fetching order in Screen 11:", err);
      setError(err.message || "No se pudo cargar la orden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ordenId) {
      fetchOrder();
    }
  }, [ordenId]);

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3 bg-[#161a21] border border-[#2d3748] rounded-2xl text-slate-300 font-mono text-xs max-w-5xl mx-auto my-8">
        <Loader2 className="w-8 h-8 animate-spin text-[#bfce7f]" />
        <span>Cargando servicios de la orden de trabajo #{ordenId}...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-8 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 font-sans text-xs space-y-4 max-w-5xl mx-auto my-8">
        <div className="flex items-center gap-2 font-bold font-mono text-sm">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>Error de Carga</span>
        </div>
        <p>{error || "No se encontró la orden de trabajo especificada."}</p>
        <div>
          <Link
            href={`/workshop?order_id=${ordenId}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1c2129] border border-[#2d3748] text-slate-200 font-mono text-xs rounded-xl hover:bg-[#252c37]"
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
      <div className="flex items-center justify-between bg-[#161a21] p-4 border border-[#2d3748] rounded-2xl shadow-lg">
        <div className="flex items-center gap-3">
          <Link
            href={`/workshop?order_id=${ordenId}`}
            className="px-4 py-2 bg-[#1c2129] hover:bg-[#252c37] border border-[#2d3748] text-slate-200 text-xs font-mono font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 text-slate-400" />
            VOLVER AL DETALLE DE LA OT
          </Link>
          <span className="text-slate-500 text-xs font-mono hidden sm:inline">|</span>
          <span className="text-xs font-mono text-slate-400 hidden sm:inline">
            Orden: <strong className="text-[#bfce7f]">{order.codigo_orden}</strong>
          </span>
        </div>

        <div className="text-right text-xs font-mono">
          <span className="text-slate-400">Estado Orden: </span>
          <span className="font-bold text-slate-200 uppercase px-2 py-0.5 bg-[#0a0c10] border border-[#2d3748] rounded-md">
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
