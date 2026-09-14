"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  CreditCard,
  Search,
  RotateCcw,
  Eye,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Plus,
  DollarSign,
  ArrowUpDown,
  Loader2,
  Banknote,
  Landmark
} from "lucide-react";
import PaymentDetailModal from "./PaymentDetailModal";
import InvoiceDetailModal from "./InvoiceDetailModal";

export default function PaymentsView() {
  // Datos
  const [pagos, setPagos] = useState([]);
  const [summary, setSummary] = useState({
    total_cobrado: 0,
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
    total_pagos: 0
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    totalRecords: 0,
    totalPages: 1
  });
  const [tiposPagoCatalogo, setTiposPagoCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tipoPagoFilter, setTipoPagoFilter] = useState("TODOS");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [sortBy, setSortBy] = useState("fecha");
  const [sortOrder, setSortOrder] = useState("desc");

  // Modales
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [isPaymentDetailOpen, setIsPaymentDetailOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [isInvoiceDetailOpen, setIsInvoiceDetailOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Cargar catálogo de tipos de pago
  useEffect(() => {
    async function loadCatalogos() {
      try {
        const res = await fetch("/api/facturacion/catalogos");
        const json = await res.json();
        if (json.tipos_pago) {
          setTiposPagoCatalogo(json.tipos_pago);
        }
      } catch (err) {
        console.error("Error al cargar tipos de pago:", err);
      }
    }
    loadCatalogos();
  }, []);

  // Cargar Pagos desde el Backend
  const fetchPagos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (tipoPagoFilter && tipoPagoFilter !== "TODOS") params.set("tipo_pago", tipoPagoFilter);
      if (fechaDesde) params.set("fecha_desde", fechaDesde);
      if (fechaHasta) params.set("fecha_hasta", fechaHasta);
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      const res = await fetch(`/api/facturacion/pagos?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || json.error || "Error al cargar el historial de pagos.");
      }

      setPagos(json.data || []);
      if (json.summary) {
        setSummary({
          total_cobrado: Number(json.summary.total_cobrado || 0),
          efectivo: Number(json.summary.efectivo || 0),
          tarjeta: Number(json.summary.tarjeta || 0),
          transferencia: Number(json.summary.transferencia || 0),
          total_pagos: Number(json.summary.total_pagos || 0)
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
      console.error("Error fetching pagos:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, tipoPagoFilter, fechaDesde, fechaHasta, page, limit, sortBy, sortOrder]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPagos();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchPagos]);

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setTipoPagoFilter("TODOS");
    setFechaDesde("");
    setFechaHasta("");
    setPage(1);
    setSortBy("fecha");
    setSortOrder("desc");
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

  const handleOpenPaymentDetail = (payment) => {
    setSelectedPayment(payment);
    setIsPaymentDetailOpen(true);
  };

  const handleOpenInvoiceModal = (facturaId) => {
    setSelectedInvoiceId(facturaId);
    setIsInvoiceDetailOpen(true);
  };

  const formatMoney = (val) => {
    const num = parseFloat(val || 0);
    return `RD$ ${num.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString("es-DO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  const getTipoPagoBadge = (codigo, nombre) => {
    const cod = (codigo || "").toUpperCase();
    if (cod.includes("EFECTIVO")) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 inline-flex items-center gap-1">
          <Banknote className="w-3 h-3" />
          {nombre || "Efectivo"}
        </span>
      );
    }
    if (cod.includes("TARJETA")) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 inline-flex items-center gap-1">
          <CreditCard className="w-3 h-3" />
          {nombre || "Tarjeta"}
        </span>
      );
    }
    if (cod.includes("TRANSFERENCIA")) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/25 inline-flex items-center gap-1">
          <Landmark className="w-3 h-3" />
          {nombre || "Transferencia"}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-surface border border-border text-foreground-secondary inline-flex items-center gap-1">
        <DollarSign className="w-3 h-3" />
        {nombre || cod || "Otro"}
      </span>
    );
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    tipoPagoFilter !== "TODOS" ||
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
            <span className="text-foreground font-medium">Pagos</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 border border-primary/25 rounded-xl text-primary shrink-0">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Pagos
              </h1>
              <p className="text-xs text-foreground-muted mt-0.5">
                Historial de transacciones, conciliación de cobranza y trazabilidad de abonos
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

      {/* 2. Tarjetas de Métricas Superiores (Sección 3) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL COBRADO */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-sm hover:border-border-strong transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground-muted">
              Total Cobrado
            </span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 block">
              {formatMoney(summary.total_cobrado)}
            </span>
            <span className="text-[11px] text-foreground-muted mt-0.5 block">
              Monto total según filtros activos
            </span>
          </div>
        </div>

        {/* EFECTIVO */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-sm hover:border-border-strong transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground-muted">
              Efectivo
            </span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500 dark:text-emerald-400">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-foreground block">
              {formatMoney(summary.efectivo)}
            </span>
            <span className="text-[11px] text-foreground-muted mt-0.5 block">
              Cobros en caja / efectivo
            </span>
          </div>
        </div>

        {/* TARJETA */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-sm hover:border-border-strong transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground-muted">
              Tarjeta
            </span>
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500 dark:text-blue-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-foreground block">
              {formatMoney(summary.tarjeta)}
            </span>
            <span className="text-[11px] text-foreground-muted mt-0.5 block">
              Cobros con tarjeta / POS
            </span>
          </div>
        </div>

        {/* TRANSFERENCIA */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-sm hover:border-border-strong transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground-muted">
              Transferencia
            </span>
            <div className="p-2 bg-purple-500/10 rounded-xl text-purple-500 dark:text-purple-400">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-foreground block">
              {formatMoney(summary.transferencia)}
            </span>
            <span className="text-[11px] text-foreground-muted mt-0.5 block">
              Transferencias y depósitos
            </span>
          </div>
        </div>
      </div>

      {/* 3. Filtros (Sección 10) */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Buscar */}
          <div className="md:col-span-1 lg:col-span-1">
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-foreground-secondary mb-1">
              Buscar
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-foreground-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Factura, cliente, ID, ref..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-input text-foreground text-xs font-sans placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Tipo de Pago */}
          <div>
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-foreground-secondary mb-1">
              Tipo de Pago
            </label>
            <select
              value={tipoPagoFilter}
              onChange={(e) => {
                setTipoPagoFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-xs font-sans focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
            >
              <option value="TODOS">Todos los tipos</option>
              {tiposPagoCatalogo.map((tp) => (
                <option key={tp.tipo_pago_id} value={tp.codigo}>
                  {tp.nombre}
                </option>
              ))}
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

        {/* Botón Limpiar filtros */}
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

      {/* 4. Tabla de Pagos (Sección 4, 14, 20) */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface/80 border-b border-border text-foreground-muted font-mono uppercase text-[10px] tracking-wider select-none">
              <tr>
                <th
                  onClick={() => handleSort("fecha")}
                  className="py-3 px-4 cursor-pointer hover:text-foreground"
                >
                  <div className="flex items-center gap-1">
                    <span>Fecha</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("factura")}
                  className="py-3 px-3 cursor-pointer hover:text-foreground"
                >
                  <div className="flex items-center gap-1">
                    <span>Factura</span>
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
                <th
                  onClick={() => handleSort("tipo_pago")}
                  className="py-3 px-3 cursor-pointer hover:text-foreground"
                >
                  <div className="flex items-center gap-1">
                    <span>Tipo de Pago</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th className="py-3 px-3">Referencia</th>
                <th
                  onClick={() => handleSort("monto")}
                  className="py-3 px-4 text-right cursor-pointer hover:text-foreground"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Monto</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th className="py-3 px-3">Usuario</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-sans">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-foreground-muted">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-xs font-mono">Cargando pagos...</span>
                    </div>
                  </td>
                </tr>
              ) : pagos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-foreground-muted">
                    <div className="max-w-xs mx-auto space-y-2">
                      <CreditCard className="w-8 h-8 text-foreground-muted mx-auto opacity-40" />
                      <p className="text-sm font-semibold text-foreground">No se encontraron pagos</p>
                      <p className="text-xs text-foreground-muted">
                        {hasActiveFilters
                          ? "Intenta modificar o limpiar los filtros activos para ver más resultados."
                          : "Aún no se han registrado cobros ni pagos en el sistema."}
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
                pagos.map((p) => {
                  const isAnulada = p.factura_estado === "ANULADA";

                  return (
                    <tr
                      key={p.pago_id}
                      className="hover:bg-hover/60 transition-colors group cursor-pointer"
                      onClick={() => handleOpenPaymentDetail(p)}
                    >
                      {/* FECHA */}
                      <td className="py-3 px-4 font-mono text-[11px] text-foreground-secondary whitespace-nowrap">
                        {formatDateTime(p.fecha_pago)}
                      </td>

                      {/* FACTURA */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenInvoiceModal(p.factura_id);
                            }}
                            className="font-mono font-bold text-primary hover:underline cursor-pointer"
                            title="Ver Factura"
                          >
                            {p.codigo_factura}
                          </button>
                          {isAnulada && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-error-muted text-error border border-error/20">
                              ANULADA
                            </span>
                          )}
                        </div>
                      </td>

                      {/* CLIENTE */}
                      <td className="py-3 px-4">
                        <div className="max-w-[200px] truncate">
                          <span className="font-semibold text-foreground block truncate">
                            {p.cliente_nombre || "Consumidor Final"}
                          </span>
                          {p.cliente_identificacion && (
                            <span className="text-[10px] font-mono text-foreground-muted block truncate">
                              {p.cliente_identificacion}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* TIPO DE PAGO */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getTipoPagoBadge(p.tipo_pago_codigo, p.tipo_pago_nombre)}
                      </td>

                      {/* REFERENCIA */}
                      <td className="py-3 px-3 font-mono text-[11px] text-foreground-muted whitespace-nowrap">
                        {p.referencia || "—"}
                      </td>

                      {/* MONTO */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {formatMoney(p.monto)}
                      </td>

                      {/* USUARIO */}
                      <td className="py-3 px-3 text-[11px] text-foreground-secondary whitespace-nowrap">
                        {p.usuario_nombre || "Usuario no disponible"}
                      </td>

                      {/* ACCIONES */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentDetail(p)}
                            className="p-1.5 rounded-lg text-foreground-secondary hover:text-primary hover:bg-hover transition-colors cursor-pointer"
                            title="Ver detalle del pago"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenInvoiceModal(p.factura_id)}
                            className="p-1.5 rounded-lg text-foreground-secondary hover:text-primary hover:bg-hover transition-colors cursor-pointer"
                            title="Ver factura asociada"
                          >
                            <Receipt className="w-4 h-4" />
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

        {/* 5. Paginación (Sección 13) */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-foreground-muted bg-surface/30">
          <div className="flex items-center gap-2">
            <span>
              Total: <strong className="text-foreground">{pagination.totalRecords}</strong> pagos
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

      {/* 6. Modal Compacto de Detalle de Pago (Sección 18) */}
      {isPaymentDetailOpen && selectedPayment && (
        <PaymentDetailModal
          isOpen={isPaymentDetailOpen}
          onClose={() => {
            setIsPaymentDetailOpen(false);
            setSelectedPayment(null);
          }}
          pago={selectedPayment}
          onOpenInvoice={(facturaId) => {
            setIsPaymentDetailOpen(false);
            handleOpenInvoiceModal(facturaId);
          }}
        />
      )}

      {/* 7. Modal Completo de Factura (FAC-4, Sección 17) */}
      {isInvoiceDetailOpen && selectedInvoiceId && (
        <InvoiceDetailModal
          isOpen={isInvoiceDetailOpen}
          onClose={() => {
            setIsInvoiceDetailOpen(false);
            setSelectedInvoiceId(null);
          }}
          facturaId={selectedInvoiceId}
        />
      )}
    </div>
  );
}
