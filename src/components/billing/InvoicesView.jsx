"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Search,
  RotateCcw,
  Eye,
  Printer,
  ChevronLeft,
  ChevronRight,
  Plus,
  Receipt,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpDown,
  ExternalLink,
  Loader2
} from "lucide-react";
import InvoiceDetailModal from "./InvoiceDetailModal";
import InvoicePrintSelectorModal from "./InvoicePrintSelectorModal";

export default function InvoicesView() {
  const searchParams = useSearchParams();

  // Estados de datos
  const [invoices, setInvoices] = useState([]);
  const [metricas, setMetricas] = useState({
    total_facturas: 0,
    facturado: 0,
    pagado: 0,
    pendiente: 0
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    totalRecords: 0,
    totalPages: 1
  });
  const [loading, setLoading] = useState(true);

  // Estados de Filtros
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("TODOS");
  const [tipoFilter, setTipoFilter] = useState("TODOS");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [sortBy, setSortBy] = useState("fecha_factura");
  const [sortOrder, setSortOrder] = useState("desc");

  // Estado para Modal de Detalle
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Estado para Quick Print Modal
  const [quickPrintInvoice, setQuickPrintInvoice] = useState(null);
  const [isQuickPrintModalOpen, setIsQuickPrintModalOpen] = useState(false);
  const [loadingPrintData, setLoadingPrintData] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Manejo de Deep Linking por URL (?invoice_id=123, Sección 30)
  useEffect(() => {
    const invoiceIdParam = searchParams.get("invoice_id");
    if (invoiceIdParam) {
      const parsedId = parseInt(invoiceIdParam, 10);
      if (!isNaN(parsedId) && parsedId > 0) {
        const timer = setTimeout(() => {
          setSelectedInvoiceId(parsedId);
          setIsDetailModalOpen(true);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [searchParams]);

  // Carga de Facturas desde el Backend
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (estadoFilter && estadoFilter !== "TODOS") params.set("estado", estadoFilter);
      if (tipoFilter && tipoFilter !== "TODOS") params.set("tipo_factura", tipoFilter);
      if (fechaDesde) params.set("fecha_desde", fechaDesde);
      if (fechaHasta) params.set("fecha_hasta", fechaHasta);
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      const res = await fetch(`/api/facturacion/facturas?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || json.error || "Error al cargar facturas.");
      }

      setInvoices(json.data || []);
      if (json.metricas) {
        setMetricas({
          total_facturas: Number(json.metricas.total_facturas || 0),
          facturado: Number(json.metricas.facturado || 0),
          pagado: Number(json.metricas.pagado || 0),
          pendiente: Number(json.metricas.pendiente || 0)
        });
      }
      if (json.pagination) {
        setPagination({
          page: Number(json.pagination.page || 1),
          limit: Number(json.pagination.limit || 15),
          totalRecords: Number(json.pagination.totalRecords || 0),
          totalPages: Number(json.pagination.totalPages || 1)
        });
      }
    } catch (err) {
      console.error("Error al obtener listado de facturas:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, estadoFilter, tipoFilter, fechaDesde, fechaHasta, page, limit, sortBy, sortOrder]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInvoices();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchInvoices]);

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setEstadoFilter("TODOS");
    setTipoFilter("TODOS");
    setFechaDesde("");
    setFechaHasta("");
    setPage(1);
    setSortBy("fecha_factura");
    setSortOrder("desc");
  };

  const handleOpenDetail = (id) => {
    setSelectedInvoiceId(id);
    setIsDetailModalOpen(true);
    // Reflejar en URL sin recarga completa
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("invoice_id", String(id));
    window.history.pushState({}, "", currentUrl.toString());
  };

  const handleCloseDetail = () => {
    setIsDetailModalOpen(false);
    setSelectedInvoiceId(null);
    // Limpiar query param de URL
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete("invoice_id");
    window.history.pushState({}, "", currentUrl.pathname);
  };

  const handleInvoiceUpdated = () => {
    // Refrescar listado y métricas cuando se registre un pago
    fetchInvoices();
  };

  // Quick Print directo desde la fila de la tabla
  const handleQuickPrint = async (facturaId) => {
    try {
      setLoadingPrintData(true);
      const res = await fetch(`/api/facturacion/facturas/${facturaId}`);
      const json = await res.json();
      if (!res.ok || !json.data) {
        throw new Error(json.message || "No se pudo cargar la información para imprimir.");
      }
      setQuickPrintInvoice(json.data);
      setIsQuickPrintModalOpen(true);
    } catch (err) {
      console.error("Error cargando factura para imprimir:", err);
      alert(err.message || "Error al preparar la impresión.");
    } finally {
      setLoadingPrintData(false);
    }
  };

  const formatMoney = (val) => {
    const num = parseFloat(val || 0);
    return `RD$ ${num.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("es-DO", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (estado) => {
    const est = (estado || "").toUpperCase();
    switch (est) {
      case "PAGADA":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            PAGADA
          </span>
        );
      case "PARCIAL":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            PARCIAL
          </span>
        );
      case "PENDIENTE":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            PENDIENTE
          </span>
        );
      case "BORRADOR":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-surface border border-border text-foreground-muted inline-flex items-center gap-1">
            <FileText className="w-3 h-3" />
            BORRADOR
          </span>
        );
      case "ANULADA":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-error-muted text-error border border-error/30 inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            ANULADA
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-surface border border-border text-foreground-secondary">
            {est || "DESCONOCIDO"}
          </span>
        );
    }
  };

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    estadoFilter !== "TODOS" ||
    tipoFilter !== "TODOS" ||
    fechaDesde !== "" ||
    fechaHasta !== "";

  return (
    <div className="max-w-[1520px] mx-auto space-y-6 pb-16 font-sans text-foreground transition-colors animate-in fade-in duration-200">
      {/* 1. Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-foreground-muted mb-1 font-mono">
            <Link href="/billing" className="hover:text-primary transition-colors">
              Facturación
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">Facturas</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 border border-primary/25 rounded-xl text-primary shrink-0">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Facturas
              </h1>
              <p className="text-xs text-foreground-muted mt-0.5">
                Consulta histórica, detalle de cobranza e impresión de facturas
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/billing/new"
            className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Factura</span>
          </Link>
        </div>
      </div>

      {/* 2. Tarjetas de Métricas Superiores (Sección 2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* FACTURADO */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-sm hover:border-border-strong transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground-muted">
              Facturado
            </span>
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-foreground block">
              {formatMoney(metricas.facturado)}
            </span>
            <span className="text-[11px] text-foreground-muted mt-0.5 block">
              Total facturado según filtros
            </span>
          </div>
        </div>

        {/* PAGADO */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-sm hover:border-border-strong transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground-muted">
              Pagado
            </span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 block">
              {formatMoney(metricas.pagado)}
            </span>
            <span className="text-[11px] text-foreground-muted mt-0.5 block">
              Monto recaudado efectivamente
            </span>
          </div>
        </div>

        {/* PENDIENTE */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-sm hover:border-border-strong transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground-muted">
              Pendiente
            </span>
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-amber-600 dark:text-amber-400 block">
              {formatMoney(metricas.pendiente)}
            </span>
            <span className="text-[11px] text-foreground-muted mt-0.5 block">
              Balance pendiente por cobrar
            </span>
          </div>
        </div>

        {/* FACTURAS */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-sm hover:border-border-strong transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground-muted">
              Facturas
            </span>
            <div className="p-2 bg-purple-500/10 rounded-xl text-purple-500 dark:text-purple-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-foreground block">
              {metricas.total_facturas.toLocaleString()}
            </span>
            <span className="text-[11px] text-foreground-muted mt-0.5 block">
              Total de comprobantes emitidos
            </span>
          </div>
        </div>
      </div>

      {/* 3. Barra de Filtros (Sección 5) */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Búsqueda */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-foreground-secondary mb-1">
              Buscar
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-foreground-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Factura, cliente, RNC, OT..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-input text-foreground text-xs font-sans placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-foreground-secondary mb-1">
              Estado
            </label>
            <select
              value={estadoFilter}
              onChange={(e) => {
                setEstadoFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-xs font-sans focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
            >
              <option value="TODOS">Todos los estados</option>
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="PARCIAL">PARCIAL</option>
              <option value="PAGADA">PAGADA</option>
              <option value="BORRADOR">BORRADOR</option>
              <option value="ANULADA">ANULADA</option>
            </select>
          </div>

          {/* Tipo / Origen */}
          <div>
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-foreground-secondary mb-1">
              Origen
            </label>
            <select
              value={tipoFilter}
              onChange={(e) => {
                setTipoFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-xs font-sans focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
            >
              <option value="TODOS">Todos los orígenes</option>
              <option value="VENTA_DIRECTA">Venta Directa</option>
              <option value="ORDEN_TRABAJO">Orden de Trabajo</option>
            </select>
          </div>

          {/* Fecha Desde */}
          <div>
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-foreground-secondary mb-1">
              Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => {
                setFechaDesde(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Fecha Hasta */}
          <div>
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-foreground-secondary mb-1">
              Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => {
                setFechaHasta(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        {/* Botón Limpiar filtros si hay activos */}
        {hasActiveFilters && (
          <div className="flex justify-end pt-1 border-t border-border">
            <button
              type="button"
              onClick={handleClearFilters}
              className="flex items-center gap-1.5 text-xs font-mono font-bold text-foreground-muted hover:text-primary transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-hover"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar filtros</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. Tabla de Facturas (Sección 3) */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface/80 border-b border-border text-foreground-muted font-mono uppercase text-[10px] tracking-wider select-none">
              <tr>
                <th
                  onClick={() => handleSort("codigo_factura")}
                  className="py-3 px-4 cursor-pointer hover:text-foreground"
                >
                  <div className="flex items-center gap-1">
                    <span>Factura</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("fecha_factura")}
                  className="py-3 px-3 cursor-pointer hover:text-foreground"
                >
                  <div className="flex items-center gap-1">
                    <span>Fecha</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("cliente")}
                  className="py-3 px-4 cursor-pointer hover:text-foreground"
                >
                  <div className="flex items-center gap-1">
                    <span>Cliente</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th className="py-3 px-3">Origen</th>
                <th className="py-3 px-3">Orden Trabajo</th>
                <th
                  onClick={() => handleSort("total")}
                  className="py-3 px-3 text-right cursor-pointer hover:text-foreground"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Total</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("monto_pagado")}
                  className="py-3 px-3 text-right cursor-pointer hover:text-foreground"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Pagado</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("balance_pendiente")}
                  className="py-3 px-3 text-right cursor-pointer hover:text-foreground"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Pendiente</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th className="py-3 px-3 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-sans">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-foreground-muted">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-xs font-mono">Cargando facturas...</span>
                    </div>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-foreground-muted">
                    <div className="max-w-xs mx-auto space-y-2">
                      <FileText className="w-8 h-8 text-foreground-muted mx-auto opacity-40" />
                      <p className="text-sm font-semibold text-foreground">No se encontraron facturas</p>
                      <p className="text-xs text-foreground-muted">
                        {hasActiveFilters
                          ? "Intenta modificar o limpiar los filtros activos para ver más resultados."
                          : "Aún no se han emitido facturas en el sistema."}
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={handleClearFilters}
                          className="mt-2 px-3 py-1.5 text-xs font-mono font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg cursor-pointer"
                        >
                          Limpiar Filtros
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const isOT = Boolean(inv.orden_trabajo_id);
                  const pendiente = Number(inv.balance_pendiente || 0);

                  return (
                    <tr
                      key={inv.factura_id}
                      className="hover:bg-hover/60 transition-colors group cursor-pointer"
                      onClick={() => handleOpenDetail(inv.factura_id)}
                    >
                      {/* FACTURA */}
                      <td className="py-3 px-4 font-mono font-bold text-primary group-hover:underline whitespace-nowrap">
                        {inv.codigo_factura}
                      </td>

                      {/* FECHA */}
                      <td className="py-3 px-3 font-mono text-[11px] text-foreground-secondary whitespace-nowrap">
                        {formatDate(inv.fecha_factura)}
                      </td>

                      {/* CLIENTE */}
                      <td className="py-3 px-4">
                        <div className="max-w-[200px] truncate">
                          <span className="font-semibold text-foreground block truncate">
                            {inv.cliente_nombre || "Cliente General"}
                          </span>
                          {inv.cliente_identificacion && (
                            <span className="text-[10px] font-mono text-foreground-muted block truncate">
                              {inv.cliente_identificacion}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* ORIGEN */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            isOT
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                          }`}
                        >
                          {isOT ? "ORDEN DE TRABAJO" : "VENTA DIRECTA"}
                        </span>
                      </td>

                      {/* ORDEN TRABAJO */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isOT && inv.codigo_orden ? (
                          <Link
                            href={`/workshop?view=work_orders&order_id=${inv.orden_trabajo_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-[11px] font-bold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1 bg-surface border border-border px-2 py-0.5 rounded"
                          >
                            <span>{inv.codigo_orden}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </Link>
                        ) : (
                          <span className="font-mono text-foreground-muted text-center block w-6">—</span>
                        )}
                      </td>

                      {/* TOTAL */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-foreground whitespace-nowrap">
                        {formatMoney(inv.total)}
                      </td>

                      {/* PAGADO */}
                      <td className="py-3 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap font-medium">
                        {formatMoney(inv.monto_pagado)}
                      </td>

                      {/* PENDIENTE */}
                      <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                        {pendiente > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-bold">
                            {formatMoney(pendiente)}
                          </span>
                        ) : (
                          <span className="text-foreground-muted font-normal">—</span>
                        )}
                      </td>

                      {/* ESTADO */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {getStatusBadge(inv.estado)}
                      </td>

                      {/* ACCIONES */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(inv.factura_id)}
                            className="p-1.5 rounded-lg text-foreground-secondary hover:text-primary hover:bg-hover transition-colors cursor-pointer"
                            title="Ver detalle de factura"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickPrint(inv.factura_id)}
                            disabled={loadingPrintData}
                            className="p-1.5 rounded-lg text-foreground-secondary hover:text-primary hover:bg-hover transition-colors cursor-pointer disabled:opacity-50"
                            title="Imprimir factura (A4 o Ticket POS)"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Paginación (Sección 7) */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-foreground-muted bg-surface/30">
          <div className="flex items-center gap-2">
            <span>
              Total: <strong className="text-foreground">{pagination.totalRecords}</strong> registros
            </span>
            <span>•</span>
            <span>
              Página <strong className="text-foreground">{pagination.page}</strong> de{" "}
              <strong className="text-foreground">{pagination.totalPages}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 rounded-lg border border-border bg-input text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value={10}>10 por pág.</option>
              <option value={15}>15 por pág.</option>
              <option value={25}>25 por pág.</option>
              <option value={50}>50 por pág.</option>
            </select>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="p-1.5 rounded-lg border border-border hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages || loading}
                className="p-1.5 rounded-lg border border-border hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Página siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Modal de Detalle */}
      {isDetailModalOpen && selectedInvoiceId && (
        <InvoiceDetailModal
          isOpen={isDetailModalOpen}
          onClose={handleCloseDetail}
          facturaId={selectedInvoiceId}
          onInvoiceUpdated={handleInvoiceUpdated}
        />
      )}

      {/* 7. Modal de Impresión Rápida desde la tabla */}
      {isQuickPrintModalOpen && quickPrintInvoice && (
        <InvoicePrintSelectorModal
          isOpen={isQuickPrintModalOpen}
          onClose={() => {
            setIsQuickPrintModalOpen(false);
            setQuickPrintInvoice(null);
          }}
          invoiceData={quickPrintInvoice}
        />
      )}
    </div>
  );
}
