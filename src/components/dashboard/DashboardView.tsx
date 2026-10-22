"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench,
  Users,
  Clock,
  BarChart3,
  PieChart,
  RefreshCw,
  Loader2,
  AlertCircle,
  ArrowRight,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Receipt,
  X,
  Layers,
  FileText,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  RotateCcw
} from "lucide-react";

interface InitialMetrics {
  totalOrdenes?: number;
  totalClientes?: number;
  ordenesActivas?: number;
  ingresosDia?: number;
  nuevosClientesSemana?: number;
  cuentasPorPagar?: number;
  cuentasPorCobrar?: number;
}

interface EstadoCatalogItem {
  estado_orden_id: number;
  codigo: string;
  nombre: string;
  color_estado?: string;
  orden_visual?: number;
}

interface TipoOrdenCatalogItem {
  tipo_servicio_id: number;
  nombre: string;
  categoria_nombre?: string;
}

interface MetodoPagoCatalogItem {
  tipo_pago_id: number;
  codigo: string;
  nombre: string;
}

interface OrigenCatalogItem {
  id: string;
  nombre: string;
}

interface OrderDailyItem {
  fecha: string;
  day: string;
  etiqueta: string;
  label: string;
  ordenes_registradas: number;
  ordenes_entregadas: number;
  servicios_realizados: number;
}

interface OrderByTypeItem {
  tipo_servicio_id: number;
  name: string;
  categoria: string;
  count: number;
  percentage: number;
  color: string;
}

interface AssociatedOrderItem {
  id: number;
  codigo: string;
  cliente: string;
  vehiculo: string;
  servicio: string;
  estado: string;
  estado_codigo: string;
  color_estado: string;
  mecanico: string;
  fecha: string;
  fecha_iso: string;
  fecha_registro_iso?: string;
  fecha_entrega_iso?: string | null;
  total: number;
}

interface IncomeDailyItem {
  fecha: string;
  day: string;
  etiqueta: string;
  label: string;
  monto_total: number;
  monto_servicios_taller: number;
  monto_repuestos: number;
  monto_venta_directa: number;
  count_pagos: number;
}

interface IncomeByMethodItem {
  tipo_pago_id: number;
  name: string;
  codigo: string;
  count: number;
  total: number;
  percentage: number;
  color: string;
}

interface IncomeByOriginItem {
  id: string;
  name: string;
  total: number;
  percentage: number;
  color: string;
}

interface PaymentListItem {
  pago_id: number;
  fecha: string;
  fecha_iso: string;
  monto: number;
  monto_total_factura: number;
  metodo_nombre: string;
  metodo_codigo: string;
  factura_numero: string;
  factura_id: number;
  orden_id: number | null;
  orden_codigo: string | null;
  cliente_nombre: string;
  origen_principal: string;
}

export interface DesgloseRecaudado {
  taller: number;
  ventaDirecta: number;
  facturasAnteriores: number;
}

interface DashboardDataState {
  catalogs?: {
    estados: EstadoCatalogItem[];
    tipos_orden: TipoOrdenCatalogItem[];
    metodos_pago: MetodoPagoCatalogItem[];
    origenes: OrigenCatalogItem[];
  };
  desgloseRecaudado?: DesgloseRecaudado;
  totalOrdenes?: number;
  total_ordenes?: number;
  totalClientes?: number;
  total_clientes?: number;
  ordenesActivas?: number;
  ordenesActivasTaller?: number;
  cuentasPorPagar?: number;
  cuentasPorCobrar?: number;
  facturasPendientesCobroCount?: number;
  montoTotalOrdenes?: number;
  totalFacturado?: number;
  facturasEmitidasCount?: number;
  ordenesFacturadasCount?: number;
  montoPendienteFacturar?: number;
  ordenesPendientesFacturarCount?: number;
  desgloseEstados?: {
    enProceso: number;
    recibidas: number;
    listas: number;
    entregadas: number;
  };
  ordenes?: {
    total: number;
    promedioDiario: number | string;
    totalRegistradas?: number;
    totalEntregadas?: number;
    totalServicios?: number;
    totalProductos?: number;
    serviciosEntregadas?: number;
    productosEntregadas?: number;
    totalGlobal?: number;
    totalActivas?: number;
    totalActivasGlobal?: number;
    totalActivasTaller?: number;
    diaMayorActividad?: { etiqueta: string; cantidad: number };
    desgloseActivas?: {
      pendientes: number;
      enReparacion: number;
      paraEntrega: number;
      enHold: number;
    };
    desgloseEstados?: {
      enProceso: number;
      recibidas: number;
      listas: number;
      entregadas: number;
    };
    desgloseEstadosTaller?: {
      enProceso: number;
      recibidas: number;
      listas: number;
      entregadas?: number;
    };
    clientesUnicos?: number;
    dailyData?: OrderDailyItem[];
    byType?: OrderByTypeItem[];
    ordersList?: AssociatedOrderItem[];
  };
  ingresos?: {
    montoTotalOrdenes?: number;
    totalOrdenes?: number;
    totalFacturado?: number;
    facturasEmitidasCount?: number;
    ordenesFacturadasCount?: number;
    montoPendienteFacturar?: number;
    ordenesPendientesFacturarCount?: number;
    totalRecibido: number;
    desgloseRecaudado?: DesgloseRecaudado;
    promedioDiario: number;
    cantidadPagos: number;
    cuentasPorCobrar?: number;
    facturasPendientesCobroCount?: number;
    cuentasPorPagar?: number;
    cuentasPorPagarComprasPendientes?: number;
    diaMayorRecaudacion?: { etiqueta: string; monto: number };
    comparacionPeriodoAnterior?: {
      totalActual: number;
      totalAnterior: number;
      diferencia: number;
      porcentajeCambio: number;
      tendencia: "up" | "down" | "neutral";
      periodoAnteriorTexto: string;
    };
    dailyData?: IncomeDailyItem[];
    byMetodoPago?: IncomeByMethodItem[];
    byOrigen?: IncomeByOriginItem[];
    paymentsList?: PaymentListItem[];
  };
  weeklyData?: OrderDailyItem[];
  categoryBreakdown?: Array<{ name: string; percentage: number; count: string; color: string }>;
  recentOrders?: AssociatedOrderItem[];
}

function getDefaultSantoDomingoDates() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const now = new Date();
  const toStr = formatter.format(now);
  const [y, m, d] = toStr.split("-").map(Number);
  const fromDate = new Date(Date.UTC(y, m - 1, d - 6));
  const fromStr = fromDate.toISOString().split("T")[0];
  return { fromStr, toStr };
}

export default function DashboardView({ initialMetrics }: { initialMetrics?: InitialMetrics }) {
  const router = useRouter();

  // Navigation tab: Órdenes de Trabajo vs Análisis de Ingresos
  const [activeTab, setActiveTab] = useState<"ordenes" | "ingresos">("ordenes");

  // Date Range state: defaults to last 7 calendar days in America/Santo_Domingo
  const [fromDate, setFromDate] = useState<string>(() => getDefaultSantoDomingoDates().fromStr);
  const [toDate, setToDate] = useState<string>(() => getDefaultSantoDomingoDates().toStr);

  // Filters for Órdenes de Trabajo
  const [selectedEstadoId, setSelectedEstadoId] = useState<string>("");
  const [selectedTipoOrdenId, setSelectedTipoOrdenId] = useState<string>("");

  // Filters for Ingresos
  const [selectedMetodoPagoId, setSelectedMetodoPagoId] = useState<string>("");
  const [selectedOrigen, setSelectedOrigen] = useState<string>("TODOS");

  // Income Distribution Sub-Tab: "metodo" | "origen"
  const [incomeDistTab, setIncomeDistTab] = useState<"metodo" | "origen">("metodo");

  // Interactive Day Filter from Chart clicks
  const [selectedDayFilter, setSelectedDayFilter] = useState<string | null>(null);

  // Pagination for Órdenes de Trabajo Asociadas (3 items per page)
  const [ordersCurrentPage, setOrdersCurrentPage] = useState<number>(1);
  const ORDERS_PER_PAGE = 3;

  // Loading & Data State
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [dashboardData, setDashboardData] = useState<DashboardDataState | null>(null);

  // Hover Tooltip States for Charts (with coordinates pre-clamped)
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const [hoveredIncomeBarIndex, setHoveredIncomeBarIndex] = useState<number | null>(null);
  const [incomeTooltipPos, setIncomeTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Chart Scroll & Card Refs
  const chartScrollRef = useRef<HTMLDivElement>(null);
  const chartCardRef = useRef<HTMLDivElement>(null);
  const incomeChartScrollRef = useRef<HTMLDivElement>(null);
  const incomeChartCardRef = useRef<HTMLDivElement>(null);

  // Fetch Dashboard Data from Backend API (called by user interaction)
  const fetchDashboard = useCallback(
    async (
      from: string,
      to: string,
      estadoId: string,
      tipoOrdenId: string,
      metodoPagoId: string,
      origen: string
    ) => {
      if (!from || !to) {
        setError("Debe seleccionar las fechas 'Desde' y 'Hasta'.");
        return;
      }
      if (from > to) {
        setError("La fecha 'Desde' no puede ser posterior a la fecha 'Hasta'.");
        return;
      }

      setLoading(true);
      setError("");

      try {
        let url = `/api/dashboard?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

        if (estadoId) url += `&estado_id=${encodeURIComponent(estadoId)}`;
        if (tipoOrdenId) url += `&tipo_orden_id=${encodeURIComponent(tipoOrdenId)}`;
        if (metodoPagoId) url += `&metodo_pago_id=${encodeURIComponent(metodoPagoId)}`;
        if (origen && origen !== "TODOS") url += `&origen=${encodeURIComponent(origen)}`;

        const res = await fetch(url);
        const json = await res.json();

        if (!res.ok) {
          if (res.status === 401) {
            if (typeof window !== "undefined" && window.location.pathname !== "/login") {
              window.location.replace("/login");
            }
            return;
          }
          setError(json.message || "Error al cargar las métricas.");
          return;
        }

        setDashboardData(json.data);
      } catch {
        setError("Error de conexión con el servidor.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Initial load
  useEffect(() => {
    let ignore = false;
    const initialDates = getDefaultSantoDomingoDates();
    const url = `/api/dashboard?from=${encodeURIComponent(initialDates.fromStr)}&to=${encodeURIComponent(initialDates.toStr)}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login") {
            window.location.replace("/login");
          }
          return res.json().then((json) => {
            throw new Error(json.message || "Error al cargar datos.");
          });
        }
        return res.json();
      })
      .then((json) => {
        if (!ignore) {
          setDashboardData(json.data);
          setLoading(false);
        }
      })
      .catch((fetchErr) => {
        if (!ignore) {
          setError(fetchErr.message || "Error de conexión con el servidor.");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleFromDateChange = (newFrom: string) => {
    setFromDate(newFrom);
    if (!newFrom || !toDate) {
      setError("Debe seleccionar una fecha 'Desde' válida.");
      return;
    }
    if (newFrom > toDate) {
      setError("La fecha 'Desde' no puede ser posterior a la fecha 'Hasta'.");
      return;
    }
    setError("");
    setSelectedDayFilter(null);
    setOrdersCurrentPage(1);
    fetchDashboard(newFrom, toDate, selectedEstadoId, selectedTipoOrdenId, selectedMetodoPagoId, selectedOrigen);
  };

  const handleToDateChange = (newTo: string) => {
    setToDate(newTo);
    if (!fromDate || !newTo) {
      setError("Debe seleccionar una fecha 'Hasta' válida.");
      return;
    }
    if (fromDate > newTo) {
      setError("La fecha 'Desde' no puede ser posterior a la fecha 'Hasta'.");
      return;
    }
    setError("");
    setSelectedDayFilter(null);
    setOrdersCurrentPage(1);
    fetchDashboard(fromDate, newTo, selectedEstadoId, selectedTipoOrdenId, selectedMetodoPagoId, selectedOrigen);
  };

  // Effect for filter updates on Orders tab
  const handleApplyOrderFilters = (newEstado: string, newTipo: string) => {
    setSelectedEstadoId(newEstado);
    setSelectedTipoOrdenId(newTipo);
    setSelectedDayFilter(null);
    setOrdersCurrentPage(1);
    fetchDashboard(fromDate, toDate, newEstado, newTipo, selectedMetodoPagoId, selectedOrigen);
  };

  // Effect for filter updates on Income tab
  const handleApplyIncomeFilters = (newMetodo: string, newOrigen: string) => {
    setSelectedMetodoPagoId(newMetodo);
    setSelectedOrigen(newOrigen);
    setSelectedDayFilter(null);
    setOrdersCurrentPage(1);
    fetchDashboard(fromDate, toDate, selectedEstadoId, selectedTipoOrdenId, newMetodo, newOrigen);
  };

  const handleResetFilters = () => {
    const def = getDefaultSantoDomingoDates();
    setFromDate(def.fromStr);
    setToDate(def.toStr);
    setSelectedEstadoId("");
    setSelectedTipoOrdenId("");
    setSelectedMetodoPagoId("");
    setSelectedOrigen("TODOS");
    setSelectedDayFilter(null);
    setOrdersCurrentPage(1);
    fetchDashboard(def.fromStr, def.toStr, "", "", "", "TODOS");
  };

  // Auto-scroll charts to right edge on long data series
  useEffect(() => {
    if (chartScrollRef.current && (dashboardData?.ordenes?.dailyData?.length || 0) > 10) {
      const timer = setTimeout(() => {
        if (chartScrollRef.current) {
          chartScrollRef.current.scrollLeft = chartScrollRef.current.scrollWidth;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [dashboardData, activeTab]);

  useEffect(() => {
    if (incomeChartScrollRef.current && (dashboardData?.ingresos?.dailyData?.length || 0) > 10) {
      const timer = setTimeout(() => {
        if (incomeChartScrollRef.current) {
          incomeChartScrollRef.current.scrollLeft = incomeChartScrollRef.current.scrollWidth;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [dashboardData, activeTab]);

  // Format RD$ Currency Helper
  const formatRD = (val: number | string | undefined | null) => {
    const num = Number(val || 0);
    return `RD$ ${num.toLocaleString("es-DO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  // Extract Catalogs
  const catalogs = dashboardData?.catalogs || {
    estados: [],
    tipos_orden: [],
    metodos_pago: [],
    origenes: [
      { id: "TODOS", nombre: "Todos los orígenes" },
      { id: "VENTA_DIRECTA", nombre: "Venta Directa" },
      { id: "TALLER", nombre: "Órdenes de Taller" },
      { id: "REPUESTOS", nombre: "Repuestos" }
    ]
  };

  // Extract Global Snapshot & Filtered Metrics
  const totalClientesVal = dashboardData?.totalClientes ?? dashboardData?.total_clientes ?? initialMetrics?.totalClientes ?? 0;
  const ordenesActivasVal = dashboardData?.ordenes?.totalActivas ?? dashboardData?.ordenesActivas ?? initialMetrics?.ordenesActivas ?? 0;
  const desgloseEstados = dashboardData?.ordenes?.desgloseEstados || dashboardData?.desgloseEstados || { enProceso: 0, recibidas: 0, listas: 0, entregadas: 0 };

  // --- 1. DATA FOR ÓRDENES TAB ---
  const ordersSection = dashboardData?.ordenes;
  const ordersDailyData: OrderDailyItem[] = ordersSection?.dailyData || dashboardData?.weeklyData || [];
  const ordersByTypeData: OrderByTypeItem[] = ordersSection?.byType || [];
  const rawOrdersList: AssociatedOrderItem[] = ordersSection?.ordersList || dashboardData?.recentOrders || [];

  // Filter consultation list if an interactive day was clicked
  const displayedOrdersList = selectedDayFilter
    ? rawOrdersList.filter(
        (o) =>
          o.fecha_iso === selectedDayFilter ||
          o.fecha_registro_iso === selectedDayFilter ||
          o.fecha_entrega_iso === selectedDayFilter
      )
    : rawOrdersList;

  // Ensure orders are strictly ordered by event date descending, then id desc
  const sortedOrdersList = useMemo(() => {
    return [...displayedOrdersList].sort((a, b) => {
      const dateA = a.fecha_iso || a.fecha_registro_iso || "";
      const dateB = b.fecha_iso || b.fecha_registro_iso || "";
      if (dateB !== dateA) return dateB.localeCompare(dateA);
      return b.id - a.id;
    });
  }, [displayedOrdersList]);

  const totalOrdersCount = sortedOrdersList.length;
  const totalOrdersPages = Math.max(1, Math.ceil(totalOrdersCount / ORDERS_PER_PAGE));
  const safeOrdersPage = Math.min(Math.max(1, ordersCurrentPage), totalOrdersPages);

  const paginatedOrders = useMemo(() => {
    const start = (safeOrdersPage - 1) * ORDERS_PER_PAGE;
    return sortedOrdersList.slice(start, start + ORDERS_PER_PAGE);
  }, [sortedOrdersList, safeOrdersPage]);

  const totalOrdenesKPI = ordersSection?.total ?? ordersSection?.totalRegistradas ?? ordersDailyData.reduce((acc, c) => acc + (c.ordenes_registradas || 0), 0);
  const totalRegistradasPeriodo = totalOrdenesKPI;
  const totalServiciosKPI = ordersSection?.totalServicios ?? 0;
  const totalProductosKPI = ordersSection?.totalProductos ?? 0;

  const totalEntregadasPeriodo = ordersSection?.totalEntregadas ?? ordersDailyData.reduce((acc, c) => acc + (c.ordenes_entregadas || 0), 0);
  const serviciosEntregadas = ordersSection?.serviciosEntregadas ?? totalServiciosKPI;
  const productosEntregadas = ordersSection?.productosEntregadas ?? 0;

  const promedioDiarioOrdenes = ordersSection?.promedioDiario !== undefined
    ? Math.ceil(Number(ordersSection.promedioDiario))
    : (ordersDailyData.length > 0 ? Math.ceil(totalOrdenesKPI / ordersDailyData.length) : 0);

  const desgloseActivas = ordersSection?.desgloseActivas || {
    pendientes: desgloseEstados.recibidas,
    enReparacion: desgloseEstados.enProceso,
    paraEntrega: desgloseEstados.listas,
    enHold: 0
  };

  const clientesUnicosVal = ordersSection?.clientesUnicos ?? totalClientesVal;
  const diaMayorActividad = ordersSection?.diaMayorActividad || { etiqueta: "Sin actividad", cantidad: 0 };

  // Orders Chart dynamic Y-axis scale
  const maxDailyOrders = Math.max(
    1,
    ...ordersDailyData.map((d) => Math.max(d.ordenes_registradas || 0, d.ordenes_entregadas || 0))
  );
  const ordersYAxisMax = maxDailyOrders <= 3 ? 4 : maxDailyOrders <= 6 ? 6 : Math.ceil(maxDailyOrders / 2) * 2;
  const ordersYTicks = [ordersYAxisMax, Math.round(ordersYAxisMax * 0.75), Math.round(ordersYAxisMax * 0.5), Math.round(ordersYAxisMax * 0.25), 0];
  const distinctOrdersYTicks = Array.from(new Set(ordersYTicks));
  const hasAnyOrderActivity = totalRegistradasPeriodo > 0 || totalEntregadasPeriodo > 0;

  // --- 2. DATA FOR INGRESOS TAB ---
  const incomeSection = dashboardData?.ingresos;
  const montoTotalOrdenesVal = Number(incomeSection?.montoTotalOrdenes ?? dashboardData?.montoTotalOrdenes ?? 0);
  const totalOrdenesVal = Number(incomeSection?.totalOrdenes ?? dashboardData?.totalOrdenes ?? totalRegistradasPeriodo ?? 0);
  const montoPendienteFacturarVal = Number(incomeSection?.montoPendienteFacturar ?? dashboardData?.montoPendienteFacturar ?? 0);
  const ordenesPendientesFacturarCount = Number(incomeSection?.ordenesPendientesFacturarCount ?? dashboardData?.ordenesPendientesFacturarCount ?? 0);

  const totalRecibidoActual = Number(incomeSection?.totalRecibido || 0);
  const desgloseRecaudado: DesgloseRecaudado = incomeSection?.desgloseRecaudado ?? dashboardData?.desgloseRecaudado ?? {
    taller: 0,
    ventaDirecta: 0,
    facturasAnteriores: 0
  };
  const promedioDiarioIngresos = Number(incomeSection?.promedioDiario || 0);
  const cantidadPagosPeriodo = Number(incomeSection?.cantidadPagos || 0);
  const cuentasPorCobrarMonto = Number(incomeSection?.cuentasPorCobrar ?? dashboardData?.cuentasPorCobrar ?? 0);
  const facturasPendientesCobroCount = Number(
    incomeSection?.facturasPendientesCobroCount ?? dashboardData?.facturasPendientesCobroCount ?? 0
  );
  const comparacionPeriodo = incomeSection?.comparacionPeriodoAnterior || {
    totalActual: 0,
    totalAnterior: 0,
    diferencia: 0,
    porcentajeCambio: 0,
    tendencia: "neutral" as const,
    periodoAnteriorTexto: ""
  };

  const incomeDailyData: IncomeDailyItem[] = incomeSection?.dailyData || [];
  const incomeByMethod: IncomeByMethodItem[] = incomeSection?.byMetodoPago || [];
  const incomeByOrigin: IncomeByOriginItem[] = incomeSection?.byOrigen || [];
  const rawPaymentsList: PaymentListItem[] = incomeSection?.paymentsList || [];

  // Filter payments consultation if interactive day filter is active
  const displayedPaymentsList = selectedDayFilter
    ? rawPaymentsList.filter((p) => p.fecha_iso === selectedDayFilter)
    : rawPaymentsList;

  const diaMayorRecaudacion = incomeSection?.diaMayorRecaudacion || { etiqueta: "Sin cobros", monto: 0 };

  // Income Chart dynamic Y-axis scale
  const maxDailyIncomeVal = Math.max(100, ...incomeDailyData.map((d) => d.monto_total || 0));
  const incomeYAxisMax = maxDailyIncomeVal <= 1000 ? 1000 : Math.ceil(maxDailyIncomeVal / 1000) * 1000;
  const incomeYTicks = [
    incomeYAxisMax,
    Math.round(incomeYAxisMax * 0.75),
    Math.round(incomeYAxisMax * 0.5),
    Math.round(incomeYAxisMax * 0.25),
    0
  ];
  const distinctIncomeYTicks = Array.from(new Set(incomeYTicks));
  const hasAnyIncomeActivity = totalRecibidoActual > 0;

  const formatYTick = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${Math.round(val / 1000)}k`;
    return `${val}`;
  };

  const defaultDates = getDefaultSantoDomingoDates();
  const isCustomRangeActive = fromDate !== defaultDates.fromStr || toDate !== defaultDates.toStr;
  const hasActiveFilters =
    Boolean(selectedEstadoId) ||
    Boolean(selectedTipoOrdenId) ||
    Boolean(selectedMetodoPagoId) ||
    selectedOrigen !== "TODOS" ||
    Boolean(selectedDayFilter) ||
    isCustomRangeActive;

  return (
    <div className="max-w-[1550px] mx-auto space-y-3.5 animate-in fade-in duration-300">

      {/* 1. Header & Controls Banner */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-2.5 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-sans text-xl md:text-2xl font-black text-foreground tracking-tight">
                Dashboard General
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-success/15 border border-success/30 text-success font-mono text-[10.5px] font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Datos en tiempo real
              </span>
            </div>
            <p className="text-foreground-muted font-mono text-xs mt-0.5">
              Monitoreo operativo de órdenes de trabajo, ingresos cobrados y flujo comercial
            </p>
          </div>

          {/* Controls: Date Range Selector (Desde - Hasta) & Refresh */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-surface-subtle border border-border rounded-xl px-3 py-1.5 flex flex-wrap items-center gap-3 font-mono text-xs shadow-sm">
              <div className="flex items-center gap-1.5 text-foreground-muted font-bold">
                <Calendar size={13} className="text-primary" />
                <span className="hidden sm:inline">Rango:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <label htmlFor="dashboard-date-from" className="text-foreground-muted text-[11px]">Desde:</label>
                <input
                  id="dashboard-date-from"
                  type="date"
                  value={fromDate}
                  onChange={(e) => handleFromDateChange(e.target.value)}
                  className="bg-input border border-border rounded-lg px-2.5 py-1 text-foreground font-mono text-xs focus:border-primary outline-none transition-colors"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label htmlFor="dashboard-date-to" className="text-foreground-muted text-[11px]">Hasta:</label>
                <input
                  id="dashboard-date-to"
                  type="date"
                  value={toDate}
                  onChange={(e) => handleToDateChange(e.target.value)}
                  className="bg-input border border-border rounded-lg px-2.5 py-1 text-foreground font-mono text-xs focus:border-primary outline-none transition-colors"
                />
              </div>
              {isCustomRangeActive && (
                <button
                  type="button"
                  onClick={() => {
                    const def = getDefaultSantoDomingoDates();
                    setFromDate(def.fromStr);
                    setToDate(def.toStr);
                    setError("");
                    setSelectedDayFilter(null);
                    setOrdersCurrentPage(1);
                    fetchDashboard(def.fromStr, def.toStr, selectedEstadoId, selectedTipoOrdenId, selectedMetodoPagoId, selectedOrigen);
                  }}
                  className="p-1 text-foreground-muted hover:text-primary hover:bg-hover rounded-md transition-colors cursor-pointer"
                  title="Restablecer a los últimos 7 días"
                >
                  <RotateCcw size={13} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                fetchDashboard(
                  fromDate,
                  toDate,
                  selectedEstadoId,
                  selectedTipoOrdenId,
                  selectedMetodoPagoId,
                  selectedOrigen
                )
              }
              className="p-2 bg-surface-subtle border border-border rounded-xl text-foreground-secondary hover:text-foreground hover:bg-hover transition-colors cursor-pointer shadow-sm"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
            </button>
          </div>
        </div>

        {/* Top-Level Navigation Tabs: ÓRDENES DE TRABAJO vs INGRESOS */}
        <div className="pt-2 border-t border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-surface-subtle p-1.5 rounded-xl border border-border">
            <button
              onClick={() => {
                setActiveTab("ordenes");
                setSelectedDayFilter(null);
                setOrdersCurrentPage(1);
              }}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === "ordenes"
                  ? "bg-card text-primary shadow-sm border border-primary/30"
                  : "text-foreground-muted hover:text-foreground hover:bg-hover"
              }`}
            >
              <Wrench size={15} />
              <span>Órdenes de Trabajo</span>
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-primary/15 text-primary border border-primary/20">
                {ordersDailyData.reduce((acc, c) => acc + (c.ordenes_registradas || 0), 0)}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab("ingresos");
                setSelectedDayFilter(null);
                setOrdersCurrentPage(1);
              }}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === "ingresos"
                  ? "bg-card text-emerald-500 shadow-sm border border-emerald-500/30"
                  : "text-foreground-muted hover:text-foreground hover:bg-hover"
              }`}
            >
              <DollarSign size={15} />
              <span>Análisis de Ingresos</span>
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                {formatRD(totalRecibidoActual)}
              </span>
            </button>
          </div>

          {/* Context Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === "ordenes" ? (
              <>
                {/* Filter by Estado */}
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-foreground-muted hidden md:inline">Estado:</span>
                  <select
                    value={selectedEstadoId}
                    onChange={(e) => handleApplyOrderFilters(e.target.value, selectedTipoOrdenId)}
                    className="bg-input border border-border rounded-lg px-2.5 py-1.5 text-foreground font-mono text-xs focus:border-primary outline-none cursor-pointer"
                  >
                    <option value="">Todos los estados</option>
                    {catalogs.estados.map((est) => (
                      <option key={est.estado_orden_id} value={est.estado_orden_id}>
                        {est.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter by Tipo de Orden */}
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-foreground-muted hidden md:inline">Tipo / Servicio:</span>
                  <select
                    value={selectedTipoOrdenId}
                    onChange={(e) => handleApplyOrderFilters(selectedEstadoId, e.target.value)}
                    className="bg-input border border-border rounded-lg px-2.5 py-1.5 text-foreground font-mono text-xs focus:border-primary outline-none max-w-[200px] cursor-pointer"
                  >
                    <option value="">Todos los servicios</option>
                    {catalogs.tipos_orden.map((to) => (
                      <option key={to.tipo_servicio_id} value={to.tipo_servicio_id}>
                        {to.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                {/* Filter by Método de Pago */}
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-foreground-muted hidden md:inline">Método:</span>
                  <select
                    value={selectedMetodoPagoId}
                    onChange={(e) => handleApplyIncomeFilters(e.target.value, selectedOrigen)}
                    className="bg-input border border-border rounded-lg px-2.5 py-1.5 text-foreground font-mono text-xs focus:border-primary outline-none cursor-pointer"
                  >
                    <option value="">Todos los métodos</option>
                    {catalogs.metodos_pago.map((mp) => (
                      <option key={mp.tipo_pago_id} value={mp.tipo_pago_id}>
                        {mp.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter by Origen del Ingreso */}
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-foreground-muted hidden md:inline">Origen:</span>
                  <select
                    value={selectedOrigen}
                    onChange={(e) => handleApplyIncomeFilters(selectedMetodoPagoId, e.target.value)}
                    className="bg-input border border-border rounded-lg px-2.5 py-1.5 text-foreground font-mono text-xs focus:border-primary outline-none cursor-pointer"
                  >
                    {catalogs.origenes.map((orig) => (
                      <option key={orig.id} value={orig.id}>
                        {orig.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 bg-surface-subtle border border-border hover:border-error/40 text-foreground-muted hover:text-error rounded-lg font-mono text-xs transition-colors flex items-center gap-1 cursor-pointer"
                title="Limpiar todos los filtros"
              >
                <X size={12} />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>

        {/* Active interactive day banner (if clicked on chart) */}
        {selectedDayFilter && (
          <div className="bg-primary/10 border border-primary/30 rounded-xl px-3 py-2 flex items-center justify-between text-xs font-mono text-primary animate-in fade-in duration-150">
            <span className="flex items-center gap-2">
              <Calendar size={14} />
              Filtrando resultados específicamente para la fecha: <strong>{selectedDayFilter}</strong>
            </span>
            <button
              onClick={() => {
                setSelectedDayFilter(null);
                setOrdersCurrentPage(1);
              }}
              className="text-xs hover:underline flex items-center gap-1 font-bold cursor-pointer"
            >
              Mostrar todo el período <X size={12} />
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-error/15 border border-error/30 rounded-xl text-error text-xs flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-error" />
            <span>{error}</span>
          </div>
          <button
            onClick={() =>
              fetchDashboard(
                fromDate,
                toDate,
                selectedEstadoId,
                selectedTipoOrdenId,
                selectedMetodoPagoId,
                selectedOrigen
              )
            }
            className="px-3 py-1 bg-error/20 rounded-lg hover:bg-error/30 font-bold cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW A: ÓRDENES DE TRABAJO */}
      {/* ========================================================================= */}
      {activeTab === "ordenes" && (
        <div className="space-y-3.5">

          {/* KPI Cards Grid for Orders: 5 Cards (~30% reduced height, no footers) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">

            {/* KPI 1: Órdenes Ingresadas */}
            <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-mono text-[11px] text-foreground-muted font-bold uppercase tracking-wider block">
                    ÓRDENES INGRESADAS
                  </span>
                  <div className="p-1.5 bg-primary/15 border border-primary/30 rounded-lg text-primary group-hover:scale-105 transition-transform">
                    <Wrench size={16} />
                  </div>
                </div>
                <div>
                  <h3 className="font-mono text-2xl lg:text-3xl font-black text-primary leading-tight">
                    {loading && !dashboardData ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : totalOrdenesKPI}
                  </h3>
                </div>
                <div className="text-[11px] text-foreground-muted font-mono mt-1.5 flex items-center gap-1.5 truncate">
                  <span className="text-foreground-secondary font-medium">Servicios: <span className="font-bold text-foreground">{totalServiciosKPI}</span></span>
                  <span className="text-border-focus font-bold">|</span>
                  <span className="text-foreground-secondary font-medium">Productos: <span className="font-bold text-foreground">{totalProductosKPI}</span></span>
                </div>
                <p className="text-[10px] text-foreground-muted/80 font-mono mt-1.5 truncate" title="Por fecha de registro en el período">
                  Por fecha de registro en el período
                </p>
              </div>
            </div>

            {/* KPI 2: Promedio Diario */}
            <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm relative overflow-hidden group hover:border-sky-500/50 transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-mono text-[11px] text-foreground-muted font-bold uppercase tracking-wider block">
                    PROMEDIO DIARIO
                  </span>
                  <div className="p-1.5 bg-sky-500/15 border border-sky-500/30 rounded-lg text-sky-500 group-hover:scale-105 transition-transform">
                    <BarChart3 size={16} />
                  </div>
                </div>
                <div>
                  <h3 className="font-mono text-2xl lg:text-3xl font-black text-foreground leading-tight">
                    {loading && !dashboardData ? (
                      <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
                    ) : (
                      `${promedioDiarioOrdenes}`
                    )}
                  </h3>
                </div>
                <p className="text-[11px] text-sky-600 dark:text-sky-400 font-mono mt-1.5 font-medium truncate">
                  órdenes ingresadas por día
                </p>
              </div>
            </div>

            {/* KPI 3: Órdenes Entregadas */}
            <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm relative overflow-hidden group hover:border-emerald-500/50 transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-mono text-[11px] text-foreground-muted font-bold uppercase tracking-wider block">
                    ÓRDENES ENTREGADAS
                  </span>
                  <div className="p-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-500 group-hover:scale-105 transition-transform">
                    <CheckCircle2 size={16} />
                  </div>
                </div>
                <div>
                  <h3 className="font-mono text-2xl lg:text-3xl font-black text-emerald-500 leading-tight">
                    {loading && !dashboardData ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500" /> : totalEntregadasPeriodo}
                  </h3>
                </div>
                <div className="text-[11px] text-foreground-muted font-mono mt-1.5 flex items-center gap-1.5 truncate">
                  <span className="text-foreground-secondary font-medium">Servicios: <span className="font-bold text-foreground">{serviciosEntregadas}</span></span>
                  <span className="text-border-focus font-bold">|</span>
                  <span className="text-foreground-secondary font-medium">Productos: <span className="font-bold text-foreground">{productosEntregadas}</span></span>
                </div>
                <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-mono mt-1.5 truncate" title="Por fecha de entrega real en el período">
                  Por fecha de entrega real en el período
                </p>
              </div>
            </div>

            {/* KPI 4: Activas en Taller */}
            <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm relative overflow-hidden group hover:border-amber-500/50 transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-mono text-[11px] text-foreground-muted font-bold uppercase tracking-wider block">
                    ACTIVAS EN TALLER
                  </span>
                  <div className="p-1.5 bg-amber-500/15 border border-amber-500/30 rounded-lg text-amber-500 group-hover:scale-105 transition-transform">
                    <Clock size={16} />
                  </div>
                </div>
                <div>
                  <h3 className="font-mono text-2xl lg:text-3xl font-black text-amber-500 leading-tight">
                    {loading && !dashboardData ? <Loader2 className="w-6 h-6 animate-spin text-amber-500" /> : ordenesActivasVal}
                  </h3>
                </div>
                <p className="text-[10.5px] text-foreground-muted font-mono mt-1.5 leading-snug truncate" title={`Pendientes: ${desgloseActivas.pendientes} • En reparación: ${desgloseActivas.enReparacion} • Para entrega: ${desgloseActivas.paraEntrega}`}>
                  <span>Pendientes: <span className="font-bold text-foreground">{desgloseActivas.pendientes}</span></span>
                  <span className="mx-1 text-foreground-disabled">•</span>
                  <span>En reparación: <span className="font-bold text-foreground">{desgloseActivas.enReparacion}</span></span>
                  <span className="mx-1 text-foreground-disabled">•</span>
                  <span>Para entrega: <span className="font-bold text-foreground">{desgloseActivas.paraEntrega}</span></span>
                </p>
              </div>
            </div>

            {/* KPI 5: Total Clientes */}
            <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm relative overflow-hidden group hover:border-purple-500/50 transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-mono text-[11px] text-foreground-muted font-bold uppercase tracking-wider block">
                    TOTAL CLIENTES
                  </span>
                  <div className="p-1.5 bg-purple-500/15 border border-purple-500/30 rounded-lg text-purple-500 group-hover:scale-105 transition-transform">
                    <Users size={16} />
                  </div>
                </div>
                <div>
                  <h3 className="font-mono text-2xl lg:text-3xl font-black text-foreground leading-tight">
                    {loading && !dashboardData ? <Loader2 className="w-6 h-6 animate-spin text-purple-500" /> : clientesUnicosVal}
                  </h3>
                </div>
                <p className="text-[11px] text-purple-600 dark:text-purple-400 font-mono mt-1.5 font-medium truncate">
                  Clientes únicos en el período
                </p>
              </div>
            </div>

          </div>

          {/* Middle Charts Grid: Flujo Operativo Diario & Órdenes por Tipo */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">

            {/* Chart 1: Flujo Operativo Diario (8 cols) */}
            <div
              ref={chartCardRef}
              className="lg:col-span-8 bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between min-h-[275px] max-h-[315px] transition-colors min-w-0 relative"
            >
              {/* Floating Tooltip outside scroll clipping boundary */}
              {hoveredBarIndex !== null && ordersDailyData[hoveredBarIndex] && tooltipPos && (
                <div
                  style={{
                    left: `${tooltipPos.x}px`,
                    top: `${tooltipPos.y}px`,
                    transform: "translateX(-50%)"
                  }}
                  className="absolute bg-surface-elevated/95 backdrop-blur-md border border-primary/60 p-2.5 rounded-xl shadow-2xl text-foreground font-mono text-xs z-50 min-w-[200px] pointer-events-none animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="font-bold border-b border-border pb-1 mb-1 text-primary flex justify-between">
                    <span>
                      {ordersDailyData[hoveredBarIndex].label
                        ? `${ordersDailyData[hoveredBarIndex].day} ${ordersDailyData[hoveredBarIndex].label}`
                        : ordersDailyData[hoveredBarIndex].etiqueta}
                    </span>
                    <span className="text-foreground-muted text-[9px]">Click para filtrar ↓</span>
                  </div>
                  <div className="space-y-1 text-[10.5px]">
                    <div className="flex justify-between items-center">
                      <span className="text-foreground-muted flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm bg-primary" /> Registradas:
                      </span>
                      <span className="font-bold text-primary">{ordersDailyData[hoveredBarIndex].ordenes_registradas || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-foreground-muted flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm bg-info" /> Entregadas:
                      </span>
                      <span className="font-bold text-info">{ordersDailyData[hoveredBarIndex].ordenes_entregadas || 0}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-border/60 text-foreground-muted text-[9.5px]">
                      <span>Servicios ejecutados:</span>
                      <span className="font-bold text-foreground">{ordersDailyData[hoveredBarIndex].servicios_realizados || 0}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Chart Header & Legend */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-2 mb-1.5 shrink-0">
                <div>
                  <h3 className="font-sans text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                    <BarChart3 size={17} className="text-primary" />
                    Cantidad de Órdenes por Día
                  </h3>
                  <p className="text-foreground-muted font-mono text-[11px] mt-0.5">
                    Órdenes registradas y entregadas por día durante el período seleccionado
                  </p>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-mono shrink-0">
                  <span className="flex items-center gap-1.5 text-foreground-secondary font-medium">
                    <span className="w-2 h-2 rounded-sm bg-primary" />
                    Registradas
                  </span>
                  <span className="flex items-center gap-1.5 text-foreground-secondary font-medium">
                    <span className="w-2 h-2 rounded-sm bg-info" />
                    Entregadas
                  </span>
                </div>
              </div>

              {/* Bar Chart Area */}
              {loading && !dashboardData ? (
                <div className="flex-1 flex items-center justify-center font-mono text-xs text-foreground-muted gap-2 min-h-[140px]">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" /> Cargando flujo de órdenes...
                </div>
              ) : ordersDailyData.length === 0 || !hasAnyOrderActivity ? (
                <div className="flex-1 flex flex-col items-center justify-center font-mono text-xs text-foreground-disabled gap-2 min-h-[140px]">
                  <BarChart3 size={24} className="text-foreground-disabled opacity-60" />
                  <span>No se registraron ni entregaron órdenes en este período.</span>
                </div>
              ) : (
                <div className="flex-1 min-h-[140px] max-h-[165px] relative flex flex-col justify-end pt-1 pb-0.5 min-w-0 overflow-hidden">
                  <div className="flex items-stretch h-full relative min-w-0">
                    {/* Fixed Y-Axis */}
                    <div className="w-6 shrink-0 flex flex-col justify-between pb-7 pr-1 select-none pointer-events-none">
                      {distinctOrdersYTicks.map((tickVal, tIdx) => (
                        <span key={tIdx} className="text-[9px] font-mono font-bold text-foreground-disabled text-right block leading-none">
                          {tickVal}
                        </span>
                      ))}
                    </div>

                    {/* Scrollable Canvas */}
                    <div
                      ref={chartScrollRef}
                      className="flex-1 min-w-0 overflow-x-auto custom-scrollbar relative flex flex-col justify-end pb-0.5"
                    >
                      <div
                        style={{
                          minWidth: ordersDailyData.length > 14 ? `${ordersDailyData.length * 48}px` : "100%"
                        }}
                        className="w-full h-full flex flex-col justify-end relative"
                      >
                        {/* Horizontal Grid Lines */}
                        <div className="absolute inset-x-0 inset-y-0 flex flex-col justify-between pointer-events-none pb-7">
                          {distinctOrdersYTicks.map((_, tIdx) => (
                            <div key={tIdx} className="w-full border-t border-border/60 h-0" />
                          ))}
                        </div>

                        {/* Grouped Bars */}
                        <div className="w-full h-24 sm:h-28 flex items-end justify-around gap-1 sm:gap-2 px-1 z-10">
                          {ordersDailyData.map((item, idx) => {
                            const regCount = item.ordenes_registradas || 0;
                            const entCount = item.ordenes_entregadas || 0;
                            const regHeightPct = regCount > 0 ? Math.max(14, Math.round((regCount / ordersYAxisMax) * 100)) : 0;
                            const entHeightPct = entCount > 0 ? Math.max(14, Math.round((entCount / ordersYAxisMax) * 100)) : 0;

                            const parts = (item.fecha || "").split("-");
                            const dayNum = parseInt(parts[2] || "1", 10);
                            const monthNamesShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                            const monthName = monthNamesShort[parseInt(parts[1] || "1", 10) - 1] || "";
                            const prevItem = idx > 0 ? ordersDailyData[idx - 1] : null;
                            const prevParts = prevItem ? (prevItem.fecha || "").split("-") : [];
                            const isMonthStart = idx === 0 || parts[1] !== prevParts[1] || dayNum === 1;

                            const isSelected = selectedDayFilter === item.fecha;

                            const barWidthClass =
                              ordersDailyData.length <= 7
                                ? "w-3.5 sm:w-5 md:w-6"
                                : ordersDailyData.length <= 14
                                ? "w-3 sm:w-4"
                                : "w-2.5 sm:w-3";

                            return (
                              <div
                                key={idx}
                                style={{ minWidth: ordersDailyData.length > 14 ? "40px" : undefined }}
                                onClick={() => {
                                  if (selectedDayFilter === item.fecha) {
                                    setSelectedDayFilter(null);
                                  } else {
                                    setSelectedDayFilter(item.fecha);
                                  }
                                }}
                                onMouseEnter={(e) => {
                                  setHoveredBarIndex(idx);
                                  if (chartCardRef.current) {
                                    const rect = chartCardRef.current.getBoundingClientRect();
                                    const cardWidth = rect ? rect.width : 600;
                                    const rawX = e.clientX - (rect ? rect.left : 0);
                                    const rawY = e.clientY - (rect ? rect.top : 0);
                                    const x = Math.min(Math.max(110, rawX), cardWidth - 110);
                                    const y = Math.max(50, rawY - 120);
                                    setTooltipPos({ x, y });
                                  }
                                }}
                                onMouseMove={(e) => {
                                  if (chartCardRef.current) {
                                    const rect = chartCardRef.current.getBoundingClientRect();
                                    const cardWidth = rect ? rect.width : 600;
                                    const rawX = e.clientX - (rect ? rect.left : 0);
                                    const rawY = e.clientY - (rect ? rect.top : 0);
                                    const x = Math.min(Math.max(110, rawX), cardWidth - 110);
                                    const y = Math.max(50, rawY - 120);
                                    setTooltipPos({ x, y });
                                  }
                                }}
                                onMouseLeave={() => {
                                  setHoveredBarIndex(null);
                                  setTooltipPos(null);
                                }}
                                className={`flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer rounded-lg transition-all py-0.5 ${
                                  isSelected ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-surface-subtle/50"
                                }`}
                              >
                                <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-20 sm:h-24 pb-0.5">
                                  {/* Bar 1: Registradas */}
                                  <div className="flex flex-col items-center justify-end h-full">
                                    {regCount > 0 && (
                                      <span className="text-[9px] sm:text-[10px] font-mono font-black text-primary mb-0.5 animate-in fade-in leading-none drop-shadow-sm">
                                        {regCount}
                                      </span>
                                    )}
                                    <div
                                      style={{ height: `${regHeightPct}%` }}
                                      className={`${barWidthClass} rounded-t-md transition-all duration-300 ${
                                        regCount > 0
                                          ? "bg-gradient-to-t from-primary/75 via-primary/90 to-primary shadow-sm shadow-primary/30 group-hover:brightness-125"
                                          : "h-0"
                                      }`}
                                    />
                                  </div>

                                  {/* Bar 2: Entregadas */}
                                  <div className="flex flex-col items-center justify-end h-full">
                                    {entCount > 0 && (
                                      <span className="text-[9px] sm:text-[10px] font-mono font-black text-info mb-0.5 animate-in fade-in leading-none drop-shadow-sm">
                                        {entCount}
                                      </span>
                                    )}
                                    <div
                                      style={{ height: `${entHeightPct}%` }}
                                      className={`${barWidthClass} rounded-t-md transition-all duration-300 ${
                                        entCount > 0
                                          ? "bg-gradient-to-t from-info/75 via-info/90 to-info shadow-sm shadow-info/30 group-hover:brightness-125"
                                          : "h-0"
                                      }`}
                                    />
                                  </div>
                                </div>

                                {/* Date Label */}
                                <div className="flex flex-col items-center leading-tight mt-1 min-w-0 select-none">
                                  <span className="font-mono text-[9px] sm:text-[10px] font-semibold text-foreground-muted group-hover:text-foreground transition-colors truncate">
                                    {item.day}
                                  </span>
                                  <span
                                    className={`font-mono text-[9.5px] sm:text-[10.5px] ${
                                      isMonthStart ? "font-black text-primary" : "text-foreground-secondary font-medium"
                                    }`}
                                  >
                                    {dayNum < 10 ? `0${dayNum}` : dayNum}
                                    {isMonthStart && ordersDailyData.length > 7 ? ` ${monthName}` : ""}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4 Indicators Bottom Strip (Compact) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-2 mt-1 border-t border-border font-mono text-xs shrink-0">
                <div className="bg-surface-subtle border border-border rounded-lg px-2 py-1 text-center">
                  <span className="text-[8.5px] text-foreground-muted font-bold uppercase block truncate">Ingresadas</span>
                  <span className="text-xs sm:text-sm font-black text-primary truncate block">{totalRegistradasPeriodo}</span>
                  <span className="text-[8px] text-foreground-disabled block truncate">Por fecha registro</span>
                </div>

                <div className="bg-surface-subtle border border-border rounded-lg px-2 py-1 text-center">
                  <span className="text-[8.5px] text-foreground-muted font-bold uppercase block truncate">Entregadas</span>
                  <span className="text-xs sm:text-sm font-black text-info truncate block">{totalEntregadasPeriodo}</span>
                  <span className="text-[8px] text-foreground-disabled block truncate">Por entrega real</span>
                </div>

                <div className="bg-surface-subtle border border-border rounded-lg px-2 py-1 text-center">
                  <span className="text-[8.5px] text-foreground-muted font-bold uppercase block truncate">Promedio</span>
                  <span className="text-xs sm:text-sm font-black text-foreground truncate block">{promedioDiarioOrdenes}/día</span>
                  <span className="text-[8px] text-foreground-disabled block truncate">Ritmo diario</span>
                </div>

                <div className="bg-warning/10 border border-warning/30 rounded-lg px-2 py-1 text-center">
                  <span className="text-[8.5px] text-warning font-bold uppercase block truncate">Pico Actividad</span>
                  <span className="text-xs sm:text-sm font-black text-warning truncate block" title={diaMayorActividad.etiqueta}>
                    {diaMayorActividad.etiqueta}
                  </span>
                  <span className="text-[8px] text-warning/80 block truncate">
                    {diaMayorActividad.cantidad > 0 ? `${diaMayorActividad.cantidad} órdenes` : "Sin actividad"}
                  </span>
                </div>
              </div>
            </div>

            {/* Chart 2: Órdenes por Tipo de Servicio (4 cols) */}
            <div className="lg:col-span-4 bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between min-h-[275px] max-h-[315px] transition-colors min-w-0">
              <div className="border-b border-border pb-2 mb-1.5 shrink-0">
                <h3 className="font-sans text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                  <PieChart size={17} className="text-info" />
                  Órdenes por Tipo de Servicio
                </h3>
                <p className="text-foreground-muted font-mono text-[11px] mt-0.5 truncate">
                  Distribución según el tipo de servicio contratado
                </p>
              </div>

              {loading && !dashboardData ? (
                <div className="flex-1 flex items-center justify-center font-mono text-xs text-foreground-muted gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-info" /> Cargando tipos de servicios...
                </div>
              ) : ordersByTypeData.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center font-mono text-xs text-foreground-disabled text-center gap-2">
                  <PieChart size={24} className="opacity-50" />
                  <span>No hay servicios registrados en este período.</span>
                </div>
              ) : (
                <div className="space-y-1.5 py-0.5 overflow-y-auto max-h-[155px] custom-scrollbar pr-1">
                  {ordersByTypeData.map((typeItem, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        const newTipo = selectedTipoOrdenId === String(typeItem.tipo_servicio_id) ? "" : String(typeItem.tipo_servicio_id);
                        handleApplyOrderFilters(selectedEstadoId, newTipo);
                      }}
                      className={`space-y-0.5 p-1.5 rounded-lg transition-all cursor-pointer ${
                        selectedTipoOrdenId === String(typeItem.tipo_servicio_id)
                          ? "bg-primary/15 ring-1 ring-primary"
                          : "hover:bg-surface-subtle"
                      }`}
                    >
                      <div className="flex justify-between items-center font-mono text-[11px]">
                        <span className="text-foreground font-bold flex items-center gap-1.5 truncate pr-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: typeItem.color }} />
                          <span className="truncate">{typeItem.name}</span>
                        </span>
                        <span className="text-foreground-muted shrink-0 text-[10.5px]">{typeItem.percentage}%</span>
                      </div>
                      <div className="w-full bg-surface-subtle h-1.5 rounded-full overflow-hidden border border-border">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${typeItem.percentage}%`, backgroundColor: typeItem.color }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[9.5px] font-mono text-foreground-muted">
                        <span className="truncate max-w-[65%]">{typeItem.categoria}</span>
                        <span className="font-bold shrink-0">{typeItem.count} {typeItem.count === 1 ? "orden" : "órdenes"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-2 p-1.5 bg-surface-subtle border border-border rounded-lg flex items-center justify-between text-[10.5px] font-mono text-foreground-muted shrink-0">
                <span>Click para filtrar por tipo</span>
                <span className="font-bold text-primary">{ordersByTypeData.length} categorías</span>
              </div>
            </div>

          </div>

          {/* Bottom Table: Consulta de Órdenes Asociadas al Resultado */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b border-border pb-2.5">
              <div>
                <h3 className="font-sans text-base font-bold text-foreground flex items-center gap-2">
                  <FileText size={17} className="text-primary" />
                  Órdenes de Trabajo Asociadas
                  <span className="text-xs font-mono font-normal text-foreground-muted">
                    ({totalOrdersCount} {totalOrdersCount === 1 ? "orden encontrada" : "órdenes encontradas"})
                  </span>
                </h3>
                <p className="text-foreground-muted font-mono text-[11px] mt-0.5">
                  Consulta de órdenes que cumplen con los filtros y período seleccionados
                </p>
              </div>

              <button
                onClick={() => router.push("/work-orders")}
                className="text-xs font-mono text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer self-start sm:self-auto"
              >
                Módulo completo de órdenes <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="border border-border rounded-xl overflow-hidden bg-surface">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-surface-subtle select-none">
                      <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider">CÓDIGO</th>
                      <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider">CLIENTE / VEHÍCULO</th>
                      <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider">SERVICIO PRINCIPAL</th>
                      <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider text-center">ESTADO</th>
                      <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider">MECÁNICO</th>
                      <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider">FECHA</th>
                      <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider text-right">TOTAL RD$</th>
                      <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider text-center">ACCIÓN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading && !dashboardData ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center font-mono text-xs text-foreground-muted">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-primary" />
                          Cargando órdenes de trabajo asociadas...
                        </td>
                      </tr>
                    ) : totalOrdersCount === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center font-mono text-xs text-foreground-disabled">
                          No se encontraron órdenes para los criterios y fechas seleccionados.
                        </td>
                      </tr>
                    ) : (
                      paginatedOrders.map((order) => {
                        return (
                          <tr
                            key={order.id}
                            className="hover:bg-hover transition-colors group"
                          >
                            <td className="py-3 px-4 font-mono font-bold text-primary whitespace-nowrap">
                              {order.codigo}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-foreground font-mono">{order.cliente}</span>
                                <span className="text-[11px] text-foreground-muted font-mono">{order.vehiculo}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-foreground-secondary text-[11px]">
                              {order.servicio}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span
                                style={{
                                  borderColor: order.color_estado || "#38bdf8",
                                  color: order.color_estado || "#38bdf8"
                                }}
                                className="px-2.5 py-0.5 rounded-lg border bg-surface-subtle font-mono text-[9.5px] font-bold uppercase tracking-wider"
                              >
                                {order.estado}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-foreground-secondary whitespace-nowrap">
                              {order.mecanico}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-foreground-muted whitespace-nowrap">
                              {order.fecha}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-foreground text-right whitespace-nowrap">
                              {formatRD(order.total)}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <button
                                onClick={() => router.push(`/work-orders?order_id=${order.id}`)}
                                className="px-2.5 py-1 bg-surface-subtle hover:bg-primary/20 text-foreground-secondary hover:text-primary rounded-lg border border-border font-mono text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                Ver orden <ChevronRight size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Discrete Pagination Bar */}
              {totalOrdersCount > 0 && (
                <div className="border-t border-border bg-surface-subtle/50 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono">
                  <div className="text-foreground-muted text-[11px]">
                    Mostrando{" "}
                    <span className="font-bold text-foreground">
                      {(safeOrdersPage - 1) * ORDERS_PER_PAGE + 1}
                    </span>
                    {" - "}
                    <span className="font-bold text-foreground">
                      {Math.min(safeOrdersPage * ORDERS_PER_PAGE, totalOrdersCount)}
                    </span>
                    {" de "}
                    <span className="font-bold text-primary">{totalOrdersCount}</span> órdenes
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOrdersCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safeOrdersPage <= 1}
                      className="px-2.5 py-1 rounded-lg border border-border bg-surface text-foreground-secondary hover:text-foreground hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                      title="Página anterior"
                    >
                      <ChevronLeft size={12} />
                      <span>Anterior</span>
                    </button>

                    <div className="px-2.5 py-1 rounded-lg bg-surface border border-border text-[11px] text-foreground-muted">
                      Página <span className="font-bold text-foreground">{safeOrdersPage}</span> de{" "}
                      <span className="font-bold text-foreground">{totalOrdersPages}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setOrdersCurrentPage((p) => Math.min(totalOrdersPages, p + 1))}
                      disabled={safeOrdersPage >= totalOrdersPages}
                      className="px-2.5 py-1 rounded-lg border border-border bg-surface text-foreground-secondary hover:text-foreground hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                      title="Página siguiente"
                    >
                      <span>Siguiente</span>
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW B: ANÁLISIS DE INGRESOS */}
      {/* ========================================================================= */}
      {activeTab === "ingresos" && (
        <div className="space-y-6">

          {/* KPI Cards Grid for Income */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">

            {/* KPI 1: Total de Órdenes */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-emerald-500/50 transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2 gap-1.5">
                  <span className="font-mono text-xs text-foreground-muted font-bold uppercase tracking-wider block whitespace-nowrap">
                    TOTAL DE ÓRDENES
                  </span>
                  <div className="p-2 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-500 group-hover:scale-110 transition-transform shrink-0">
                    <Wrench size={18} />
                  </div>
                </div>
                <div className="mt-1">
                  <h3 className="font-mono text-2xl md:text-3xl font-black text-emerald-500">
                    {loading && !dashboardData ? (
                      <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
                    ) : (
                      formatRD(montoTotalOrdenesVal)
                    )}
                  </h3>
                </div>
                <p className="text-xs text-foreground-muted font-mono mt-2 leading-relaxed">
                  {totalOrdenesVal === 1 ? "1 orden registrada en el período" : `${totalOrdenesVal} órdenes registradas en el período`}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border text-[11px] font-mono text-foreground-disabled flex justify-between items-center">
                <span>Órdenes registradas</span>
                <span className="text-emerald-500 font-bold">
                  {totalOrdenesVal === 1 ? "1 orden" : `${totalOrdenesVal} órdenes`}
                </span>
              </div>
            </div>

            {/* KPI 2: Pendiente de Facturar */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-sky-500/50 transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2 gap-1.5">
                  <span className="font-mono text-xs text-foreground-muted font-bold uppercase tracking-wider block whitespace-nowrap">
                    PENDIENTE DE FACTURAR
                  </span>
                  <div className="p-2 bg-sky-500/15 border border-sky-500/30 rounded-xl text-sky-500 group-hover:scale-110 transition-transform shrink-0">
                    <Clock size={18} />
                  </div>
                </div>
                <div className="mt-1">
                  <h3 className="font-mono text-2xl md:text-3xl font-black text-foreground">
                    {loading && !dashboardData ? (
                      <Loader2 className="w-7 h-7 animate-spin text-sky-500" />
                    ) : (
                      formatRD(montoPendienteFacturarVal)
                    )}
                  </h3>
                </div>
                <p className="text-xs text-sky-600 dark:text-sky-400 font-mono mt-2 font-medium">
                  Monto de órdenes sin facturar en el período seleccionado
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border text-[11px] font-mono text-foreground-disabled flex justify-between items-center">
                <span>Órdenes sin facturar</span>
                <span className="text-sky-500 font-bold">
                  {ordenesPendientesFacturarCount > 0
                    ? `${ordenesPendientesFacturarCount} ${ordenesPendientesFacturarCount === 1 ? "orden" : "órdenes"}`
                    : "Al día"}
                </span>
              </div>
            </div>

            {/* KPI 3: Cuenta por Cobrar (RD$) */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-amber-500/50 transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2 gap-1.5">
                  <span className="font-mono text-xs text-foreground-muted font-bold uppercase tracking-wider block whitespace-nowrap">
                    CUENTA POR COBRAR
                  </span>
                  <div className="p-2 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-500 group-hover:scale-110 transition-transform shrink-0">
                    <Receipt size={18} />
                  </div>
                </div>
                <div className="mt-1">
                  <h3 className="font-mono text-2xl md:text-3xl font-black text-amber-500">
                    {loading && !dashboardData ? (
                      <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
                    ) : (
                      formatRD(cuentasPorCobrarMonto)
                    )}
                  </h3>
                </div>
                <p className="text-xs text-foreground-muted font-mono mt-2 leading-relaxed">
                  Saldo pendiente de facturas emitidas en el período
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border text-[11px] font-mono text-foreground-disabled flex justify-between items-center">
                <span>Facturas por cobrar</span>
                <span className="text-amber-500/90 font-bold">
                  {facturasPendientesCobroCount > 0
                    ? `${facturasPendientesCobroCount} ${facturasPendientesCobroCount === 1 ? "factura" : "facturas"}`
                    : "Al día"}
                </span>
              </div>
            </div>

            {/* KPI 4: Comparación con Período Anterior */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2 gap-1.5">
                  <span className="font-mono text-xs text-foreground-muted font-bold uppercase tracking-wider block whitespace-nowrap">
                    VS PERÍODO ANTERIOR
                  </span>
                  <div
                    className={`p-2 rounded-xl group-hover:scale-110 transition-transform border shrink-0 ${
                      comparacionPeriodo.tendencia === "up"
                        ? "bg-success/15 border-success/30 text-success"
                        : comparacionPeriodo.tendencia === "down"
                        ? "bg-error/15 border-error/30 text-error"
                        : "bg-surface-subtle border-border text-foreground-muted"
                    }`}
                  >
                    {comparacionPeriodo.tendencia === "up" ? (
                      <TrendingUp size={18} />
                    ) : comparacionPeriodo.tendencia === "down" ? (
                      <TrendingDown size={18} />
                    ) : (
                      <Layers size={18} />
                    )}
                  </div>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <h3
                    className={`font-mono text-2xl md:text-3xl font-black ${
                      comparacionPeriodo.tendencia === "up"
                        ? "text-success"
                        : comparacionPeriodo.tendencia === "down"
                        ? "text-error"
                        : "text-foreground"
                    }`}
                  >
                    {loading && !dashboardData ? (
                      <Loader2 className="w-7 h-7 animate-spin text-primary" />
                    ) : (
                      `${comparacionPeriodo.porcentajeCambio > 0 ? "+" : ""}${comparacionPeriodo.porcentajeCambio}%`
                    )}
                  </h3>
                </div>
                <p className="text-xs text-foreground-muted font-mono mt-2 leading-relaxed">
                  Previo: {formatRD(comparacionPeriodo.totalAnterior)}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border text-[11px] font-mono text-foreground-disabled">
                {comparacionPeriodo.diferencia >= 0
                  ? `+ ${formatRD(comparacionPeriodo.diferencia)} netos`
                  : `- ${formatRD(Math.abs(comparacionPeriodo.diferencia))} netos`}
              </div>
            </div>

            {/* KPI 5: Total Recaudado y Desglose por Origen */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-purple-500/50 transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2 gap-1.5">
                  <span className="font-mono text-xs text-foreground-muted font-bold uppercase tracking-wider block whitespace-nowrap">
                    TOTAL RECAUDADO
                  </span>
                  <div className="p-2 bg-purple-500/15 border border-purple-500/30 rounded-xl text-purple-500 group-hover:scale-110 transition-transform shrink-0">
                    <CreditCard size={18} />
                  </div>
                </div>
                <div className="mt-1">
                  <h3 className="font-mono text-2xl md:text-3xl font-black text-foreground">
                    {loading && !dashboardData ? (
                      <Loader2 className="w-7 h-7 animate-spin text-purple-500" />
                    ) : (
                      formatRD(totalRecibidoActual)
                    )}
                  </h3>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border text-[11px] font-mono space-y-1">
                <div className="flex justify-between items-center text-foreground-muted">
                  <span className="truncate pr-1">Taller:</span>
                  <span className="font-bold text-foreground shrink-0">
                    {formatRD(desgloseRecaudado.taller)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-foreground-muted">
                  <span className="truncate pr-1">Venta directa:</span>
                  <span className="font-bold text-foreground shrink-0">
                    {formatRD(desgloseRecaudado.ventaDirecta)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-foreground-muted">
                  <span className="truncate pr-1">Facturas / OTs anteriores:</span>
                  <span className="font-bold text-foreground shrink-0">
                    {formatRD(desgloseRecaudado.facturasAnteriores)}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Middle Charts Grid for Income: Ingresos Diarios (8 cols) & Categorías (4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Chart 1: Ingresos Diarios en RD$ (8 cols) */}
            <div
              ref={incomeChartCardRef}
              className="lg:col-span-8 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[420px] max-h-[500px] transition-colors min-w-0 relative"
            >
              {/* Floating Tooltip for Income Chart */}
              {hoveredIncomeBarIndex !== null && incomeDailyData[hoveredIncomeBarIndex] && incomeTooltipPos && (
                <div
                  style={{
                    left: `${incomeTooltipPos.x}px`,
                    top: `${incomeTooltipPos.y}px`,
                    transform: "translateX(-50%)"
                  }}
                  className="absolute bg-surface-elevated/95 backdrop-blur-md border border-emerald-500/60 p-3 rounded-xl shadow-2xl text-foreground font-mono text-xs z-50 min-w-[220px] pointer-events-none animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="font-bold border-b border-border pb-1 mb-1.5 text-emerald-500 flex justify-between">
                    <span>
                      {incomeDailyData[hoveredIncomeBarIndex].label
                        ? `${incomeDailyData[hoveredIncomeBarIndex].day} ${incomeDailyData[hoveredIncomeBarIndex].label}`
                        : incomeDailyData[hoveredIncomeBarIndex].etiqueta}
                    </span>
                    <span className="text-foreground-muted text-[10px]">Click para filtrar ↓</span>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-foreground-muted">Total Cobrado:</span>
                      <span className="font-bold text-emerald-500">{formatRD(incomeDailyData[hoveredIncomeBarIndex].monto_total)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-foreground-secondary">
                      <span>• Servicios Taller:</span>
                      <span>{formatRD(incomeDailyData[hoveredIncomeBarIndex].monto_servicios_taller)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-foreground-secondary">
                      <span>• Repuestos:</span>
                      <span>{formatRD(incomeDailyData[hoveredIncomeBarIndex].monto_repuestos)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-foreground-secondary">
                      <span>• Venta Directa:</span>
                      <span>{formatRD(incomeDailyData[hoveredIncomeBarIndex].monto_venta_directa)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-border/60 text-foreground-muted text-[10px]">
                      <span>Cantidad de cobros:</span>
                      <span className="font-bold text-foreground">{incomeDailyData[hoveredIncomeBarIndex].count_pagos || 0} pagos</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Chart Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-3 mb-3 shrink-0">
                <div>
                  <h3 className="font-sans text-base font-bold text-foreground flex items-center gap-2">
                    <DollarSign size={18} className="text-emerald-500" />
                    Ingresos Diarios (RD$)
                  </h3>
                  <p className="text-foreground-muted font-mono text-xs mt-0.5">
                    Dinero real recaudado en caja/banco por día durante el período seleccionado
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                  <span className="flex items-center gap-1.5 text-foreground-secondary font-medium">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    Cobros efectivos
                  </span>
                </div>
              </div>

              {/* Income Bar Chart Area */}
              {loading && !dashboardData ? (
                <div className="flex-1 flex items-center justify-center font-mono text-xs text-foreground-muted gap-2 min-h-[210px]">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-500" /> Cargando flujo de ingresos...
                </div>
              ) : incomeDailyData.length === 0 || !hasAnyIncomeActivity ? (
                <div className="flex-1 flex flex-col items-center justify-center font-mono text-xs text-foreground-disabled gap-2 min-h-[210px]">
                  <DollarSign size={28} className="text-foreground-disabled opacity-60" />
                  <span>No se registraron cobros en el período seleccionado.</span>
                </div>
              ) : (
                <div className="flex-1 min-h-[220px] relative flex flex-col justify-end pt-3 pb-1 min-w-0 overflow-hidden">
                  <div className="flex items-stretch h-full relative min-w-0">
                    {/* Fixed Y-Axis */}
                    <div className="w-12 shrink-0 flex flex-col justify-between pb-10 pr-2 select-none pointer-events-none">
                      {distinctIncomeYTicks.map((tickVal, tIdx) => (
                        <span key={tIdx} className="text-[9.5px] font-mono font-bold text-foreground-disabled text-right block leading-none">
                          {formatYTick(tickVal)}
                        </span>
                      ))}
                    </div>

                    {/* Scrollable Plot Area */}
                    <div
                      ref={incomeChartScrollRef}
                      className="flex-1 min-w-0 overflow-x-auto custom-scrollbar relative flex flex-col justify-end pb-1"
                    >
                      <div
                        style={{
                          minWidth: incomeDailyData.length > 14 ? `${incomeDailyData.length * 52}px` : "100%"
                        }}
                        className="w-full h-full flex flex-col justify-end relative"
                      >
                        {/* Horizontal Grid Lines */}
                        <div className="absolute inset-x-0 inset-y-0 flex flex-col justify-between pointer-events-none pb-10">
                          {distinctIncomeYTicks.map((_, tIdx) => (
                            <div key={tIdx} className="w-full border-t border-border/60 h-0" />
                          ))}
                        </div>

                        {/* Revenue Bars */}
                        <div className="w-full h-44 flex items-end justify-around gap-1 sm:gap-2 px-1 z-10">
                          {incomeDailyData.map((item, idx) => {
                            const totalDay = item.monto_total || 0;
                            const heightPct = totalDay > 0 ? Math.max(14, Math.round((totalDay / incomeYAxisMax) * 100)) : 0;

                            const parts = (item.fecha || "").split("-");
                            const dayNum = parseInt(parts[2] || "1", 10);
                            const monthNamesShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                            const monthName = monthNamesShort[parseInt(parts[1] || "1", 10) - 1] || "";
                            const prevItem = idx > 0 ? incomeDailyData[idx - 1] : null;
                            const prevParts = prevItem ? (prevItem.fecha || "").split("-") : [];
                            const isMonthStart = idx === 0 || parts[1] !== prevParts[1] || dayNum === 1;

                            const isSelected = selectedDayFilter === item.fecha;

                            const barWidthClass =
                              incomeDailyData.length <= 7
                                ? "w-6 sm:w-8 md:w-10"
                                : incomeDailyData.length <= 14
                                ? "w-5 sm:w-6 md:w-7"
                                : "w-4 sm:w-5";

                            return (
                              <div
                                key={idx}
                                style={{ minWidth: incomeDailyData.length > 14 ? "44px" : undefined }}
                                onClick={() => {
                                  if (selectedDayFilter === item.fecha) {
                                    setSelectedDayFilter(null);
                                  } else {
                                    setSelectedDayFilter(item.fecha);
                                  }
                                }}
                                onMouseEnter={(e) => {
                                  setHoveredIncomeBarIndex(idx);
                                  if (incomeChartCardRef.current) {
                                    const rect = incomeChartCardRef.current.getBoundingClientRect();
                                    const cardWidth = rect ? rect.width : 600;
                                    const rawX = e.clientX - (rect ? rect.left : 0);
                                    const rawY = e.clientY - (rect ? rect.top : 0);
                                    const x = Math.min(Math.max(120, rawX), cardWidth - 120);
                                    const y = Math.max(65, rawY - 140);
                                    setIncomeTooltipPos({ x, y });
                                  }
                                }}
                                onMouseMove={(e) => {
                                  if (incomeChartCardRef.current) {
                                    const rect = incomeChartCardRef.current.getBoundingClientRect();
                                    const cardWidth = rect ? rect.width : 600;
                                    const rawX = e.clientX - (rect ? rect.left : 0);
                                    const rawY = e.clientY - (rect ? rect.top : 0);
                                    const x = Math.min(Math.max(120, rawX), cardWidth - 120);
                                    const y = Math.max(65, rawY - 140);
                                    setIncomeTooltipPos({ x, y });
                                  }
                                }}
                                onMouseLeave={() => {
                                  setHoveredIncomeBarIndex(null);
                                  setIncomeTooltipPos(null);
                                }}
                                className={`flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer rounded-xl transition-all py-1 ${
                                  isSelected ? "bg-emerald-500/20 ring-1 ring-emerald-500" : "hover:bg-surface-subtle/50"
                                }`}
                              >
                                <div className="w-full flex items-end justify-center h-34 pb-0.5">
                                  <div className="flex flex-col items-center justify-end h-full">
                                    {totalDay > 0 && (
                                      <span className="text-[9.5px] sm:text-[10.5px] font-mono font-black text-emerald-500 mb-1 animate-in fade-in leading-none drop-shadow-sm whitespace-nowrap">
                                        {totalDay >= 1000 ? `${(totalDay / 1000).toFixed(1)}k` : Math.round(totalDay)}
                                      </span>
                                    )}
                                    <div
                                      style={{ height: `${heightPct}%` }}
                                      className={`${barWidthClass} rounded-t-lg transition-all duration-300 ${
                                        totalDay > 0
                                          ? "bg-gradient-to-t from-emerald-600 via-emerald-500 to-emerald-400 shadow-sm shadow-emerald-500/30 group-hover:brightness-125"
                                          : "h-0"
                                      }`}
                                    />
                                  </div>
                                </div>

                                {/* Date Label */}
                                <div className="flex flex-col items-center leading-tight mt-2 min-w-0 select-none">
                                  <span className="font-mono text-[9.5px] sm:text-[10.5px] font-semibold text-foreground-muted group-hover:text-foreground transition-colors truncate">
                                    {item.day}
                                  </span>
                                  <span
                                    className={`font-mono text-[10px] sm:text-[11px] ${
                                      isMonthStart ? "font-black text-emerald-500" : "text-foreground-secondary font-medium"
                                    }`}
                                  >
                                    {dayNum < 10 ? `0${dayNum}` : dayNum}
                                    {isMonthStart && incomeDailyData.length > 7 ? ` ${monthName}` : ""}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4 Bottom Strip Indicators for Income */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 pt-3 mt-1 border-t border-border font-mono text-xs shrink-0">
                <div className="bg-surface-subtle border border-border rounded-xl p-2.5 text-center">
                  <span className="text-[9.5px] text-foreground-muted font-bold uppercase block">Total Recaudado</span>
                  <span className="text-sm font-black text-emerald-500">{formatRD(totalRecibidoActual)}</span>
                  <span className="text-[9px] text-foreground-disabled block mt-0.5">{cantidadPagosPeriodo} transacciones</span>
                </div>

                <div className="bg-surface-subtle border border-border rounded-xl p-2.5 text-center">
                  <span className="text-[9.5px] text-foreground-muted font-bold uppercase block">Promedio Diario</span>
                  <span className="text-sm font-black text-foreground">{formatRD(promedioDiarioIngresos)}/día</span>
                  <span className="text-[9px] text-foreground-disabled block mt-0.5">Recaudación por jornada</span>
                </div>

                <div className="bg-warning/10 border border-warning/30 rounded-xl p-2.5 text-center">
                  <span className="text-[9.5px] text-warning font-bold uppercase block">Mayor Recaudación</span>
                  <span className="text-sm font-black text-warning truncate block" title={diaMayorRecaudacion.etiqueta}>
                    {diaMayorRecaudacion.etiqueta}
                  </span>
                  <span className="text-[9px] text-warning/80 block truncate mt-0.5">
                    {diaMayorRecaudacion.monto > 0 ? formatRD(diaMayorRecaudacion.monto) : "Sin recaudación"}
                  </span>
                </div>

                <div className="bg-surface-subtle border border-border rounded-xl p-2.5 text-center">
                  <span className="text-[9.5px] text-foreground-muted font-bold uppercase block">Crecimiento vs Previo</span>
                  <span
                    className={`text-sm font-black ${
                      comparacionPeriodo.tendencia === "up"
                        ? "text-success"
                        : comparacionPeriodo.tendencia === "down"
                        ? "text-error"
                        : "text-foreground"
                    }`}
                  >
                    {comparacionPeriodo.porcentajeCambio > 0 ? "+" : ""}
                    {comparacionPeriodo.porcentajeCambio}%
                  </span>
                  <span className="text-[9px] text-foreground-disabled block mt-0.5">
                    {formatRD(comparacionPeriodo.diferencia)} variación
                  </span>
                </div>
              </div>
            </div>

            {/* Chart 2: Distribución por Método de Pago & Origen (4 cols) */}
            <div className="lg:col-span-4 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[420px] max-h-[500px] transition-colors min-w-0">
              <div className="border-b border-border pb-3 mb-3 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-sans text-base font-bold text-foreground flex items-center gap-2">
                    <PieChart size={18} className="text-emerald-500" />
                    Distribución de Ingresos
                  </h3>
                </div>

                {/* Sub-tab toggle: Método de Pago vs Origen del Ingreso */}
                <div className="flex items-center gap-1 bg-surface-subtle p-1 rounded-xl border border-border mt-2 font-mono text-[11px]">
                  <button
                    onClick={() => setIncomeDistTab("metodo")}
                    className={`flex-1 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      incomeDistTab === "metodo"
                        ? "bg-card text-emerald-500 shadow-sm border border-emerald-500/30"
                        : "text-foreground-muted hover:text-foreground hover:bg-hover"
                    }`}
                  >
                    Método de Pago
                  </button>
                  <button
                    onClick={() => setIncomeDistTab("origen")}
                    className={`flex-1 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      incomeDistTab === "origen"
                        ? "bg-card text-emerald-500 shadow-sm border border-emerald-500/30"
                        : "text-foreground-muted hover:text-foreground hover:bg-hover"
                    }`}
                  >
                    Origen del Ingreso
                  </button>
                </div>
              </div>

              {loading && !dashboardData ? (
                <div className="flex-1 flex items-center justify-center font-mono text-xs text-foreground-muted gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-500" /> Cargando distribución...
                </div>
              ) : incomeDistTab === "metodo" ? (
                incomeByMethod.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center font-mono text-xs text-foreground-disabled text-center gap-2">
                    <CreditCard size={24} className="opacity-50" />
                    <span>No hay métodos de pago registrados en este período.</span>
                  </div>
                ) : (
                  <div className="space-y-3 py-1 overflow-y-auto max-h-[240px] custom-scrollbar pr-1">
                    {incomeByMethod.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          const newMetodo = selectedMetodoPagoId === String(item.tipo_pago_id) ? "" : String(item.tipo_pago_id);
                          handleApplyIncomeFilters(newMetodo, selectedOrigen);
                        }}
                        className={`space-y-1 p-2 rounded-xl transition-all cursor-pointer ${
                          selectedMetodoPagoId === String(item.tipo_pago_id)
                            ? "bg-emerald-500/15 ring-1 ring-emerald-500"
                            : "hover:bg-surface-subtle"
                        }`}
                      >
                        <div className="flex justify-between items-center font-mono text-xs">
                          <span className="text-foreground font-bold flex items-center gap-2 truncate pr-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="truncate">{item.name}</span>
                          </span>
                          <span className="text-emerald-500 font-bold shrink-0">{item.percentage}%</span>
                        </div>
                        <div className="w-full bg-surface-subtle h-2 rounded-full overflow-hidden border border-border">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-mono text-foreground-muted">
                          <span>{item.count} {item.count === 1 ? "cobro" : "cobros"}</span>
                          <span className="font-bold text-foreground">{formatRD(item.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                incomeByOrigin.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center font-mono text-xs text-foreground-disabled text-center gap-2">
                    <Layers size={24} className="opacity-50" />
                    <span>No hay orígenes registrados en este período.</span>
                  </div>
                ) : (
                  <div className="space-y-3 py-1 overflow-y-auto max-h-[240px] custom-scrollbar pr-1">
                    {incomeByOrigin.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          const newOrig = selectedOrigen === item.id ? "TODOS" : item.id;
                          handleApplyIncomeFilters(selectedMetodoPagoId, newOrig);
                        }}
                        className={`space-y-1 p-2 rounded-xl transition-all cursor-pointer ${
                          selectedOrigen === item.id
                            ? "bg-emerald-500/15 ring-1 ring-emerald-500"
                            : "hover:bg-surface-subtle"
                        }`}
                      >
                        <div className="flex justify-between items-center font-mono text-xs">
                          <span className="text-foreground font-bold flex items-center gap-2 truncate pr-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="truncate">{item.name}</span>
                          </span>
                          <span className="text-emerald-500 font-bold shrink-0">{item.percentage}%</span>
                        </div>
                        <div className="w-full bg-surface-subtle h-2 rounded-full overflow-hidden border border-border">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-mono text-foreground-muted">
                          <span className="uppercase text-[9px] font-bold tracking-wider">{item.id}</span>
                          <span className="font-bold text-foreground">{formatRD(item.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              <div className="mt-3 p-3 bg-surface-subtle border border-border rounded-xl flex items-center justify-between text-[11px] font-mono text-foreground-muted shrink-0">
                <span>Cálculo contable exacto sin duplicidad</span>
                <span className="font-bold text-emerald-500">Pagos Reales</span>
              </div>
            </div>

          </div>

          {/* Bottom Table: Detalle y Consulta de Cobros Registrados */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-3">
              <div>
                <h3 className="font-sans text-base font-bold text-foreground flex items-center gap-2">
                  <Receipt size={18} className="text-emerald-500" />
                  Consulta de Cobros e Ingresos Reales
                  <span className="text-xs font-mono font-normal text-foreground-muted">
                    ({displayedPaymentsList.length} {displayedPaymentsList.length === 1 ? "cobro registrado" : "cobros registrados"})
                  </span>
                </h3>
                <p className="text-foreground-muted font-mono text-xs mt-0.5">
                  Detalle de pagos efectivamente aplicados con fecha, método, origen y factura asociada
                </p>
              </div>

              <div className="font-mono text-xs text-foreground-muted self-start sm:self-auto">
                Total en lista: <strong className="text-emerald-500">{formatRD(displayedPaymentsList.reduce((acc, p) => acc + (p.monto || 0), 0))}</strong>
              </div>
            </div>

            <div className="border border-border rounded-xl overflow-hidden bg-surface">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-surface-subtle select-none">
                      <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider">FECHA COBRO</th>
                      <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider">COMPROBANTE / FACTURA</th>
                      <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider">ORDEN / ORIGEN</th>
                      <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider">CLIENTE</th>
                      <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider text-center">MÉTODO PAGO</th>
                      <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider text-center">CLASIFICACIÓN</th>
                      <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider text-right">MONTO COBRADO (RD$)</th>
                      <th className="py-3 px-4 font-mono text-[10px] text-foreground-secondary font-bold uppercase tracking-wider text-center">ACCIÓN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading && !dashboardData ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center font-mono text-xs text-foreground-muted">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-emerald-500" />
                          Cargando detalle de ingresos y cobros...
                        </td>
                      </tr>
                    ) : displayedPaymentsList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center font-mono text-xs text-foreground-disabled">
                          No se encontraron cobros registrados para los criterios seleccionados.
                        </td>
                      </tr>
                    ) : (
                      displayedPaymentsList.map((payment) => {
                        const methodBadgeClass =
                          payment.metodo_codigo === "EFECTIVO"
                            ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                            : payment.metodo_codigo === "TARJETA"
                            ? "bg-sky-500/15 text-sky-500 border-sky-500/30"
                            : payment.metodo_codigo === "TRANSFERENCIA"
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "bg-surface-subtle text-foreground-muted border-border";

                        const originBadgeClass =
                          payment.origen_principal === "VENTA_DIRECTA"
                            ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
                            : payment.origen_principal === "REPUESTOS"
                            ? "bg-sky-500/15 text-sky-500 border-sky-500/30"
                            : "bg-primary/15 text-primary border-primary/30";

                        const originLabel =
                          payment.origen_principal === "VENTA_DIRECTA"
                            ? "Venta Directa"
                            : payment.origen_principal === "REPUESTOS"
                            ? "Repuestos"
                            : "Taller";

                        return (
                          <tr
                            key={payment.pago_id}
                            className="hover:bg-hover transition-colors group"
                          >
                            <td className="py-3 px-4 font-mono text-xs text-foreground-muted whitespace-nowrap">
                              {payment.fecha}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-foreground whitespace-nowrap">
                              {payment.factura_numero}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {payment.orden_codigo ? (
                                <span className="font-mono text-primary font-bold">
                                  {payment.orden_codigo}
                                </span>
                              ) : (
                                <span className="font-mono text-foreground-disabled text-[11px] italic">
                                  Mostrador (Sin OT)
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-foreground whitespace-nowrap">
                              {payment.cliente_nombre}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span className={`px-2.5 py-0.5 rounded-lg border font-mono text-[9.5px] font-bold uppercase tracking-wider ${methodBadgeClass}`}>
                                {payment.metodo_nombre}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span className={`px-2.5 py-0.5 rounded-lg border font-mono text-[9.5px] font-bold uppercase tracking-wider ${originBadgeClass}`}>
                                {originLabel}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono font-black text-emerald-500 text-right whitespace-nowrap">
                              {formatRD(payment.monto)}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {payment.orden_id ? (
                                <button
                                  onClick={() => router.push(`/work-orders?order_id=${payment.orden_id}`)}
                                  className="px-2.5 py-1 bg-surface-subtle hover:bg-emerald-500/20 text-foreground-secondary hover:text-emerald-500 rounded-lg border border-border font-mono text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                                >
                                  Ver orden <ChevronRight size={12} />
                                </button>
                              ) : (
                                <span className="font-mono text-[10px] text-foreground-disabled">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
