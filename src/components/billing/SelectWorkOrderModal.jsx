"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Wrench,
  Search,
  X,
  RefreshCw,
  AlertCircle,
  Bike,
  CheckCircle2,
  Package,
  Layers
} from "lucide-react";

export default function SelectWorkOrderModal({ isOpen, onClose, onSelectOrder }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/facturacion/ordenes-facturables");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || "No se pudieron obtener las órdenes facturables.");
        setOrders([]);
        return;
      }
      const json = await res.json();
      setOrders(json.data || []);
    } catch {
      setError("No se pudieron obtener las órdenes listas para facturar.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchOrders();
      setSearchTerm("");
    }
  }, [isOpen, fetchOrders]);

  // Manejo de cierre con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Filtrado local por término de búsqueda
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    const term = searchTerm.toLowerCase().trim();
    return orders.filter((o) => {
      const cod = (o.codigo_orden || "").toLowerCase();
      const cliNom = (o.cliente?.nombre_completo || "").toLowerCase();
      const cliIden = (o.cliente?.identificacion || "").toLowerCase();
      const bicMar = (o.bicicleta?.marca || "").toLowerCase();
      const bicMod = (o.bicicleta?.modelo || "").toLowerCase();
      return (
        cod.includes(term) ||
        cliNom.includes(term) ||
        cliIden.includes(term) ||
        bicMar.includes(term) ||
        bicMod.includes(term)
      );
    });
  }, [orders, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl w-full max-w-5xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* 1. Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground tracking-tight">
                Seleccionar Orden de Trabajo
              </h2>
              <p className="text-xs text-foreground-muted">
                Solo se listan órdenes en <strong className="text-emerald-400 font-mono">LISTA_ENTREGA</strong> sin factura activa previa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-hover transition-colors cursor-pointer"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Barra de Búsqueda y Acciones */}
        <div className="px-6 py-3 border-b border-border/80 bg-surface/20 flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código de orden, cliente, cédula o bicicleta..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary transition-colors"
              autoFocus
            />
          </div>
          <button
            type="button"
            onClick={fetchOrders}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-surface border border-border text-foreground hover:bg-hover transition-colors disabled:opacity-50 cursor-pointer"
            title="Recargar órdenes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>

        {/* 3. Tabla de Órdenes */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-primary" />
              <p className="text-xs text-foreground-muted font-mono">Cargando órdenes facturables...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-error/10 border border-error/20 mx-auto flex items-center justify-center text-error">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Error al consultar órdenes facturables</p>
                <p className="text-xs text-foreground-muted max-w-md mx-auto">{error}</p>
              </div>
              <button
                type="button"
                onClick={fetchOrders}
                className="mt-2 px-3.5 py-1.5 bg-surface hover:bg-hover border border-border text-foreground rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Reintentar
              </button>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-surface-subtle border border-border mx-auto flex items-center justify-center text-foreground-muted">
                <Wrench className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  No hay órdenes de trabajo disponibles
                </p>
                <p className="text-xs text-foreground-muted max-w-md mx-auto">
                  {searchTerm
                    ? "No se encontraron órdenes que coincidan con el término de búsqueda."
                    : "No existen órdenes en estado 'LISTA_ENTREGA' pendientes de facturación en tu empresa."}
                </p>
              </div>
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-surface border-b border-border font-mono text-[11px] text-foreground-muted uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-3.5">ORDEN</th>
                      <th className="py-3 px-3.5">CLIENTE</th>
                      <th className="py-3 px-3.5">BICICLETA</th>
                      <th className="py-3 px-3 text-center">SERVICIOS</th>
                      <th className="py-3 px-3 text-center">REPUESTOS</th>
                      <th className="py-3 px-3.5 text-right">TOTAL</th>
                      <th className="py-3 px-3 text-center">ESTADO</th>
                      <th className="py-3 px-3.5 text-center">ACCIÓN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredOrders.map((o) => {
                      const totalServicios = o.servicios?.length || 0;
                      const totalRepuestos = o.repuestos?.length || 0;
                      const totalMonto = Number(o.totales?.total_orden || 0);

                      return (
                        <tr
                          key={o.orden_trabajo_id}
                          className="hover:bg-hover/50 transition-colors font-sans"
                        >
                          {/* ORDEN */}
                          <td className="py-3 px-3.5">
                            <div className="font-mono font-bold text-primary">
                              {o.codigo_orden}
                            </div>
                            <div className="text-[10px] text-foreground-muted font-mono">
                              ID #{o.orden_trabajo_id}
                            </div>
                          </td>

                          {/* CLIENTE */}
                          <td className="py-3 px-3.5">
                            <div className="font-semibold text-foreground">
                              {o.cliente?.nombre_completo || "Cliente General"}
                            </div>
                            {o.cliente?.identificacion && (
                              <div className="text-[10px] text-foreground-muted font-mono">
                                RNC/Céd: {o.cliente.identificacion}
                              </div>
                            )}
                            {o.cliente?.telefono_principal && (
                              <div className="text-[10px] text-foreground-muted">
                                Tel: {o.cliente.telefono_principal}
                              </div>
                            )}
                          </td>

                          {/* BICICLETA */}
                          <td className="py-3 px-3.5">
                            {o.bicicleta ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 font-medium text-foreground">
                                  <Bike className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                  <span>
                                    {o.bicicleta.marca} {o.bicicleta.modelo}
                                  </span>
                                </div>
                                {(o.bicicleta.color || o.bicicleta.ano) && (
                                  <div className="text-[10px] text-foreground-muted pl-5">
                                    {[o.bicicleta.color, o.bicicleta.ano].filter(Boolean).join(" • ")}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-foreground-muted italic text-[11px]">
                                Sin bicicleta asignada
                              </span>
                            )}
                          </td>

                          {/* SERVICIOS */}
                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                              <Layers className="w-3 h-3" />
                              {totalServicios}
                            </span>
                            <div className="text-[10px] text-foreground-muted font-mono mt-0.5">
                              RD$ {Number(o.totales?.subtotal_servicios || 0).toFixed(2)}
                            </div>
                          </td>

                          {/* REPUESTOS */}
                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                              <Package className="w-3 h-3" />
                              {totalRepuestos}
                            </span>
                            <div className="text-[10px] text-foreground-muted font-mono mt-0.5">
                              RD$ {Number(o.totales?.subtotal_repuestos || 0).toFixed(2)}
                            </div>
                          </td>

                          {/* TOTAL */}
                          <td className="py-3 px-3.5 text-right font-mono">
                            <div className="font-bold text-foreground text-sm">
                              RD$ {totalMonto.toFixed(2)}
                            </div>
                            {Number(o.totales?.descuento_total || 0) > 0 && (
                              <div className="text-[10px] text-emerald-400">
                                Desc: RD$ {Number(o.totales.descuento_total).toFixed(2)}
                              </div>
                            )}
                          </td>

                          {/* ESTADO */}
                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              {o.estado?.nombre || "LISTA ENTREGA"}
                            </span>
                          </td>

                          {/* ACCIÓN */}
                          <td className="py-3 px-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectOrder(o);
                                onClose();
                              }}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm transition-all cursor-pointer font-sans whitespace-nowrap"
                            >
                              Seleccionar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* 4. Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-surface/50 text-xs">
          <div className="text-foreground-muted font-mono text-[11px]">
            {filteredOrders.length} orden{filteredOrders.length === 1 ? "" : "es"} encontrada{filteredOrders.length === 1 ? "" : "s"}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-surface border border-border text-foreground hover:bg-hover transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
