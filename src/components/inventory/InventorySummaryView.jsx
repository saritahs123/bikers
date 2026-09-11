"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Warehouse,
  PackageCheck,
  DollarSign,
  AlertTriangle,
  AlertCircle,
  ArrowLeftRight,
  RefreshCw,
  Calendar,
  FileText,
  TrendingUp,
  Activity
} from "lucide-react";

// ============================================================================
// HELPER COMPONENTS: SVG CHARTS
// ============================================================================

// 1. Responsive SVG Bar Chart for "Valor del Inventario por Almacén"
function WarehouseBarChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-foreground-muted text-xs">
        <Warehouse className="w-8 h-8 opacity-40 mb-2" />
        <span>Sin datos de almacenes disponibles</span>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.valor_inventario), 1000);
  // Round up max for nice axis ticks (e.g. 250k, 200k, 150k, 100k, 50k, 0)
  const yMax = Math.ceil(maxVal / 50000) * 50000 || 50000;
  const yTicks = [yMax, yMax * 0.8, yMax * 0.6, yMax * 0.4, yMax * 0.2, 0];

  const barColors = [
    { from: "#3B82F6", to: "#2563EB", text: "#60A5FA" }, // Blue (Principal)
    { from: "#06B6D4", to: "#0891B2", text: "#22D3EE" }, // Cyan (Taller)
    { from: "#F97316", to: "#EA580C", text: "#FB923C" }, // Amber/Orange (Tienda)
    { from: "#6366F1", to: "#4F46E5", text: "#818CF8" }, // Indigo/Purple (Depósito)
    { from: "#10B981", to: "#059669", text: "#34D399" }, // Emerald
    { from: "#EC4899", to: "#DB2777", text: "#F472B6" }  // Pink
  ];

  const formatShortMoney = (val) => {
    if (val >= 1000000) return `RD$ ${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `RD$ ${(val / 1000).toLocaleString("es-DO", { maximumFractionDigits: 0 })}k`;
    return `RD$ ${val}`;
  };

  const formatExactMoney = (val) => {
    return `RD$ ${Number(val || 0).toLocaleString("es-DO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })}`;
  };

  return (
    <div className="w-full h-64 flex flex-col justify-between pt-2 select-none">
      {/* Chart Canvas */}
      <div className="relative flex-grow flex items-end">
        {/* Y Axis Grid Lines & Labels */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-7">
          {yTicks.map((tick, i) => (
            <div key={i} className="flex items-center w-full">
              <span className="text-[10px] font-mono text-foreground-muted w-16 text-right pr-2 shrink-0">
                {formatShortMoney(tick)}
              </span>
              <div className="w-full border-b border-border/40" />
            </div>
          ))}
        </div>

        {/* Bars Container */}
        <div className="w-full h-full pl-16 pr-4 pb-7 pt-4 flex items-end justify-around gap-2 z-10">
          {data.map((item, index) => {
            const heightPct = Math.min(100, Math.max(6, (item.valor_inventario / yMax) * 100));
            const color = barColors[index % barColors.length];

            return (
              <div
                key={item.almacen_id || index}
                className="flex-1 flex flex-col items-center justify-end h-full group relative"
              >
                {/* Value Label Above Bar */}
                <span className="text-[11px] font-bold font-mono text-foreground mb-1.5 transition-transform group-hover:scale-105 whitespace-nowrap">
                  {formatExactMoney(item.valor_inventario)}
                </span>

                {/* Animated Vertical Bar */}
                <div
                  className="w-full max-w-[54px] rounded-t-sm transition-all duration-300 hover:brightness-110 shadow-sm"
                  style={{
                    height: `${heightPct}%`,
                    background: `linear-gradient(180deg, ${color.from} 0%, ${color.to} 100%)`
                  }}
                />

                {/* Tooltip on Hover */}
                <div className="absolute bottom-full mb-6 hidden group-hover:flex flex-col items-center pointer-events-none z-20">
                  <div className="bg-popover text-foreground border border-border px-2.5 py-1.5 rounded shadow-xl text-xs font-medium whitespace-nowrap">
                    <p className="font-bold">{item.almacen_nombre}</p>
                    <p className="font-mono text-[11px] text-primary">
                      {formatExactMoney(item.valor_inventario)}
                    </p>
                    <p className="text-[10px] text-foreground-muted">
                      {item.total_unidades} unidades físicas
                    </p>
                  </div>
                  <div className="w-2 h-2 bg-popover border-r border-b border-border rotate-45 -mt-1" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* X Axis Labels */}
      <div className="w-full pl-16 pr-4 flex justify-around gap-2 border-t border-border pt-2">
        {data.map((item, index) => (
          <div key={item.almacen_id || index} className="flex-1 text-center truncate">
            <span
              className="text-xs font-semibold text-foreground-muted truncate block hover:text-foreground transition-colors cursor-default"
              title={item.almacen_nombre}
            >
              {item.almacen_nombre}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TYPE_COLORS = [
  "#3B82F6", // Blue (Repuestos)
  "#10B981", // Emerald (Accesorios)
  "#8B5CF6", // Violet (Consumibles)
  "#F97316", // Orange (Herramientas)
  "#06B6D4", // Cyan (Lubricantes)
  "#EC4899", // Pink (Neumáticos)
  "#EAB308", // Yellow
  "#64748B"  // Slate (Otros / Sin Tipo)
];

// 2. Responsive SVG Donut Chart for "Distribución por Tipo de Producto"
function ProductTypeDonutChart({ data, totalCount, totalUnidades, totalMonto }) {
  const [metricMode, setMetricMode] = useState("cantidad"); // 'cantidad' | 'monto'
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const formatMoney = (val) => {
    const num = Number(val || 0);
    return `RD$ ${num.toLocaleString("es-DO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const formatNumber = (val) => {
    const num = Number(val || 0);
    return num.toLocaleString("es-DO");
  };

  const formatNumberDecimals = (val) => {
    const num = Number(val || 0);
    return num.toLocaleString("es-DO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Base calculation depending on mode
  const totalValue = useMemo(() => {
    if (metricMode === "monto") {
      const sum = data.reduce((acc, d) => acc + Number(d.monto_total || 0), 0);
      return Number(totalMonto || sum) || 1;
    }
    const sum = data.reduce((acc, d) => acc + Number(d.total_productos || 0), 0);
    return Number(totalCount || sum) || 1;
  }, [metricMode, totalCount, totalMonto, data]);

  // Calculate SVG Pie/Donut paths
  const chartSegments = useMemo(() => {
    let runningAngle = 0;
    const isSingle = data.length === 1;
    const segments = [];

    // SVG Arc Calculation (center at 100, 100, radius 86, inner radius 65)
    const radius = 86;
    const innerRadius = 65;
    const cx = 100;
    const cy = 100;
    const toRad = (deg) => ((deg - 90) * Math.PI) / 180;

    for (let index = 0; index < data.length; index++) {
      const item = data[index];
      const val = metricMode === "monto" ? Number(item.monto_total || 0) : Number(item.total_productos || 0);
      const percentage = totalValue > 0 ? (val / totalValue) * 100 : 0;
      const angle = totalValue > 0 ? (val / totalValue) * 360 : 0;
      const startAngle = runningAngle;
      const endAngle = runningAngle + angle;
      runningAngle = endAngle;

      const color = TYPE_COLORS[index % TYPE_COLORS.length];

      let pathData = "";
      if (angle >= 359.9 || isSingle) {
        // Full circle using two 180-deg arcs
        pathData = `
          M ${cx} ${cy - radius}
          A ${radius} ${radius} 0 1 1 ${cx} ${cy + radius}
          A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius}
          M ${cx} ${cy - innerRadius}
          A ${innerRadius} ${innerRadius} 0 1 0 ${cx} ${cy + innerRadius}
          A ${innerRadius} ${innerRadius} 0 1 0 ${cx} ${cy - innerRadius}
          Z
        `;
      } else {
        const x1 = cx + radius * Math.cos(toRad(startAngle));
        const y1 = cy + radius * Math.sin(toRad(startAngle));
        const x2 = cx + radius * Math.cos(toRad(endAngle - 0.02));
        const y2 = cy + radius * Math.sin(toRad(endAngle - 0.02));

        const ix1 = cx + innerRadius * Math.cos(toRad(endAngle - 0.02));
        const iy1 = cy + innerRadius * Math.sin(toRad(endAngle - 0.02));
        const ix2 = cx + innerRadius * Math.cos(toRad(startAngle));
        const iy2 = cy + innerRadius * Math.sin(toRad(startAngle));

        const largeArcFlag = angle > 180 ? 1 : 0;

        pathData = `
          M ${x1} ${y1}
          A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
          L ${ix1} ${iy1}
          A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix2} ${iy2}
          Z
        `;
      }

      segments.push({
        ...item,
        percentage: Math.round(percentage),
        color,
        pathData
      });
    }

    return segments;
  }, [data, totalValue, metricMode]);

  if (!data || data.length === 0) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-foreground-muted text-xs">
        <Boxes className="w-8 h-8 opacity-40 mb-2" />
        <span>Sin tipos de producto disponibles</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full select-none">
      {/* Header with Title & Mode Selector */}
      <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
            <Boxes className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">
              Distribución por Tipo de Producto
            </h3>
            <p className="text-[11px] text-foreground-muted hidden sm:block">
              Variedad, existencias y valoración económica
            </p>
          </div>
        </div>

        {/* Mode Toggle Button */}
        <div className="inline-flex p-0.5 rounded-lg bg-surface-subtle border border-border text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setMetricMode("cantidad")}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              metricMode === "cantidad"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            Cantidad
          </button>
          <button
            type="button"
            onClick={() => setMetricMode("monto")}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              metricMode === "monto"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            Monto RD$
          </button>
        </div>
      </div>

      {/* Main Body: Donut + Rich Legend */}
      <div className="flex-grow flex flex-col sm:flex-row items-center justify-between gap-5">
        {/* Left: Donut SVG Graphic */}
        <div className="relative w-48 h-48 sm:w-52 sm:h-52 shrink-0 flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90 drop-shadow-md">
            {chartSegments.map((seg, i) => {
              const isHovered = hoveredIndex === i;
              return (
                <path
                  key={i}
                  d={seg.pathData}
                  fill={seg.color}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="transition-all duration-200 cursor-pointer"
                  style={{
                    opacity: hoveredIndex !== null && !isHovered ? 0.4 : 1,
                    transform: isHovered ? "scale(1.03)" : "scale(1)",
                    transformOrigin: "100px 100px"
                  }}
                />
              );
            })}
          </svg>

          {/* Center Counter */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-2">
            {metricMode === "monto" ? (
              <div className="flex flex-col items-center justify-center max-w-[124px] sm:max-w-[134px] overflow-hidden">
                <span className="text-[10px] sm:text-[11px] font-bold text-primary tracking-wider uppercase leading-none mb-0.5">
                  RD$
                </span>
                <span
                  className={`font-black font-mono text-foreground tracking-tight leading-none my-0.5 ${
                    formatNumberDecimals(totalMonto).length > 13
                      ? "text-xs sm:text-sm"
                      : formatNumberDecimals(totalMonto).length > 9
                      ? "text-sm sm:text-base"
                      : "text-base sm:text-lg"
                  }`}
                  title={`RD$ ${formatNumberDecimals(totalMonto)}`}
                >
                  {formatNumberDecimals(totalMonto)}
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold text-foreground-muted uppercase tracking-wider leading-none mt-0.5">
                  Valor Total
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center max-w-[124px] sm:max-w-[134px] overflow-hidden">
                <span className="text-xl sm:text-2xl font-black text-foreground font-mono leading-none tracking-tight">
                  {formatNumber(totalCount)}
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold text-foreground-muted uppercase tracking-wider mt-1 leading-none">
                  Productos
                </span>
                {totalUnidades > 0 && (
                  <span className="text-[9px] sm:text-[10px] text-primary font-medium mt-0.5 leading-none">
                    {formatNumber(totalUnidades)} uds
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Rich Legend Items with both Cantidad and Monto without truncation */}
        <div className="flex-grow w-full space-y-2">
          {chartSegments.map((item, index) => {
            const isHovered = hoveredIndex === index;
            return (
              <div
                key={index}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`p-2 rounded-lg border transition-all cursor-default ${
                  isHovered
                    ? "bg-surface border-primary/50 shadow-xs"
                    : "bg-surface-subtle/40 border-border/40 hover:border-border hover:bg-surface-subtle/70"
                }`}
              >
                {/* Row 1: Dot, Name, Percentage Badge */}
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ring-2 ring-background"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-foreground font-bold text-xs">
                      {item.tipo_producto_nombre}
                    </span>
                  </div>
                  <span
                    className="font-mono font-bold text-[10px] px-2 py-0.5 rounded-full shrink-0 border"
                    style={{
                      backgroundColor: `${item.color}15`,
                      color: item.color,
                      borderColor: `${item.color}40`
                    }}
                  >
                    {item.percentage}%
                  </span>
                </div>

                {/* Row 2: Cantidad (prods + uds) on left, Monto RD$ on right */}
                <div className="flex items-center justify-between text-[11px] pl-4 text-foreground-muted">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-foreground">
                      {formatNumber(item.total_productos)}
                    </span>
                    <span>{item.total_productos === 1 ? "prod" : "prods"}</span>
                    {item.cantidad_total !== undefined && (
                      <>
                        <span className="opacity-40">•</span>
                        <span className="font-medium text-foreground">
                          {formatNumber(item.cantidad_total)}
                        </span>
                        <span>uds</span>
                      </>
                    )}
                  </div>
                  <span className="font-mono font-bold text-xs text-foreground shrink-0 ml-2">
                    {formatMoney(item.monto_total)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT: InventorySummaryView
// ============================================================================

export default function InventorySummaryView({
  onNavigateToStock = null,
  onNavigateToMovements = null
} = {}) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentDateTime, setCurrentDateTime] = useState("");

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/inventario/resumen");
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("No tienes permisos para consultar el resumen de inventario.");
        }
        if (res.status === 401) {
          throw new Error("Sesión no válida o expirada.");
        }
        throw new Error("Error al obtener el resumen de inventario.");
      }

      const result = await res.json();
      if (result.success && result.data) {
        setData(result.data);
      } else {
        throw new Error(result.message || "Respuesta inválida del servidor.");
      }
    } catch (err) {
      console.error("Error al cargar resumen:", err);
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Update live clock in Dominican Republic Time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString("es-DO", {
        timeZone: "America/Santo_Domingo",
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
      const timeStr = now.toLocaleTimeString("es-DO", {
        timeZone: "America/Santo_Domingo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
      // Capitalize first letter of day
      const formattedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
      setCurrentDateTime({ date: formattedDate, time: timeStr });
    };

    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSummary();
  }, [fetchSummary]);

  const handleGoToStock = (filter) => {
    if (onNavigateToStock) {
      onNavigateToStock({ filter });
    } else {
      router.push(filter ? `/inventory/stock?filter=${filter}` : `/inventory/stock`);
    }
  };

  const handleGoToMovements = () => {
    if (onNavigateToMovements) {
      onNavigateToMovements();
    } else {
      router.push(`/inventory/movements`);
    }
  };

  const formatMoney = (val) => {
    const num = Number(val || 0);
    return `RD$ ${num.toLocaleString("es-DO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const formatNumber = (val) => {
    const num = Number(val || 0);
    return num.toLocaleString("es-DO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };

  const formatNumberDecimals = (val) => {
    const num = Number(val || 0);
    return num.toLocaleString("es-DO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("es-DO", {
        timeZone: "America/Santo_Domingo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return String(dateStr);
    }
  };

  const getTipoBadgeStyle = (tipoCodigo, naturaleza) => {
    const cleanTipo = String(tipoCodigo || "").toUpperCase();
    if (cleanTipo.includes("TRAS")) {
      return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    }
    if (cleanTipo.includes("AJU")) {
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    }
    if (naturaleza === "ENTRADA") {
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    }
    return "bg-rose-500/15 text-rose-400 border-rose-500/30";
  };

  if (loading && !data) {
    return (
      <div className="space-y-4 animate-pulse">
        {/* Header Skeleton */}
        <div className="h-16 bg-card border border-border rounded-2xl" />
        {/* KPIs Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-32 bg-card border border-border rounded-2xl" />
          ))}
        </div>
        {/* Row 2 Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-3 h-72 bg-card border border-border rounded-xl" />
          <div className="lg:col-span-5 h-72 bg-card border border-border rounded-xl" />
          <div className="lg:col-span-4 h-72 bg-card border border-border rounded-xl" />
        </div>
        {/* Row 3 Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 h-72 bg-card border border-border rounded-xl" />
          <div className="lg:col-span-4 h-72 bg-card border border-border rounded-xl" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center max-w-md mx-auto my-12 space-y-4">
        <div className="w-12 h-12 rounded-full bg-error/10 text-error flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">
            Error al Cargar Resumen
          </h3>
          <p className="text-xs text-foreground-muted mt-1">{error}</p>
        </div>
        <button
          onClick={fetchSummary}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold transition-colors cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const valorPorAlmacen = data?.valor_por_almacen || [];
  const distribucionTipoProducto = data?.distribucion_tipo_producto || data?.distribucion_categoria || [];
  const alertas = data?.alertas || [];
  const movimientosRecientes = data?.movimientos_recientes || [];
  const ultimoMovimiento = data?.ultimo_movimiento || null;

  return (
    <div className="space-y-4 font-sans text-foreground">
      {/* ====================================================================
          HEADER: Resumen de Inventario + Live Time + Actualizar Button
          ==================================================================== */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-1 pb-2">
        {/* Left: Icon & Title/Subtitle */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-sm shadow-emerald-500/10">
            <Warehouse className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Resumen de Inventario
            </h1>
            <p className="text-xs text-foreground-muted mt-0.5">
              Visión general del estado de inventario de tu empresa
            </p>
          </div>
        </div>

        {/* Right: Date/Time + Actualizar Button */}
        <div className="flex items-center gap-4 self-end sm:self-auto">
          {currentDateTime && (
            <div className="flex items-center gap-2.5 text-right">
              <Calendar className="w-5 h-5 text-foreground-muted" />
              <div className="leading-tight">
                <p className="text-xs font-semibold text-foreground">
                  {currentDateTime.date}
                </p>
                <p className="text-[11px] font-mono text-foreground-muted">
                  {currentDateTime.time}
                </p>
              </div>
            </div>
          )}

          <button
            onClick={fetchSummary}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-xs"
            title="Actualizar datos en tiempo real"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          ROW 1: 7 VIBRANT & LUXURY KPI CARDS
          ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5">
        {/* 1. Productos Activos (Emerald) */}
        <div
          onClick={() => handleGoToStock()}
          className="group relative overflow-hidden rounded-2xl bg-card border border-border/70 hover:border-emerald-500/50 p-3.5 sm:p-4 flex flex-col justify-between shadow-xs hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
        >
          {/* Top colored accent line */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-500/80 to-emerald-500/0 opacity-70 group-hover:opacity-100 transition-opacity" />
          {/* Ambient background glow orb */}
          <div className="pointer-events-none absolute -top-10 -right-10 w-24 h-24 rounded-full bg-emerald-500/10 blur-xl group-hover:bg-emerald-500/20 transition-all duration-500" />

          <div className="relative z-10 flex items-start justify-between gap-2">
            <span className="text-[11px] font-semibold text-foreground-muted tracking-wide truncate group-hover:text-foreground transition-colors">
              Productos Activos
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.18)] group-hover:scale-110 group-hover:bg-emerald-500/25 transition-all duration-300">
              <Boxes className="w-4 h-4" />
            </div>
          </div>

          <div className="relative z-10 mt-2.5">
            <p className="text-2xl sm:text-[26px] font-black font-mono text-foreground tracking-tight leading-none group-hover:text-emerald-400 transition-colors">
              {formatNumber(metrics.productos_activos)}
            </p>
            <div className="mt-2.5 flex items-center">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3 h-3" />
                <span>+3 este mes</span>
              </span>
            </div>
          </div>
        </div>

        {/* 2. Almacenes Activos (Blue) */}
        <div className="group relative overflow-hidden rounded-2xl bg-card border border-border/70 hover:border-blue-500/50 p-3.5 sm:p-4 flex flex-col justify-between shadow-xs hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-blue-500/0 via-blue-500/80 to-blue-500/0 opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="pointer-events-none absolute -top-10 -right-10 w-24 h-24 rounded-full bg-blue-500/10 blur-xl group-hover:bg-blue-500/20 transition-all duration-500" />

          <div className="relative z-10 flex items-start justify-between gap-2">
            <span className="text-[11px] font-semibold text-foreground-muted tracking-wide truncate group-hover:text-foreground transition-colors">
              Almacenes Activos
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(59,130,246,0.18)] group-hover:scale-110 group-hover:bg-blue-500/25 transition-all duration-300">
              <Warehouse className="w-4 h-4" />
            </div>
          </div>

          <div className="relative z-10 mt-2.5">
            <p className="text-2xl sm:text-[26px] font-black font-mono text-foreground tracking-tight leading-none group-hover:text-blue-400 transition-colors">
              {formatNumber(metrics.almacenes_activos)}
            </p>
            <div className="mt-2.5 flex items-center">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span>Operativos</span>
              </span>
            </div>
          </div>
        </div>

        {/* 3. Unidades en Stock (Teal) */}
        <div
          onClick={() => handleGoToStock()}
          className="group relative overflow-hidden rounded-2xl bg-card border border-border/70 hover:border-teal-500/50 p-3.5 sm:p-4 flex flex-col justify-between shadow-xs hover:shadow-lg hover:shadow-teal-500/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
        >
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-teal-500/0 via-teal-500/80 to-teal-500/0 opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="pointer-events-none absolute -top-10 -right-10 w-24 h-24 rounded-full bg-teal-500/10 blur-xl group-hover:bg-teal-500/20 transition-all duration-500" />

          <div className="relative z-10 flex items-start justify-between gap-2">
            <span className="text-[11px] font-semibold text-foreground-muted tracking-wide truncate group-hover:text-foreground transition-colors">
              Unidades en Stock
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(20,184,166,0.18)] group-hover:scale-110 group-hover:bg-teal-500/25 transition-all duration-300">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="relative z-10 mt-2.5">
            <p className="text-2xl sm:text-[26px] font-black font-mono text-foreground tracking-tight leading-none group-hover:text-teal-400 transition-colors">
              {formatNumber(metrics.unidades_stock)}
            </p>
            <div className="mt-2.5 flex items-center">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3 h-3" />
                <span>+12% vs. mes</span>
              </span>
            </div>
          </div>
        </div>

        {/* 4. Valor del Inventario (Indigo) */}
        <div className="group relative overflow-hidden rounded-2xl bg-card border border-border/70 hover:border-indigo-500/50 p-3.5 sm:p-4 flex flex-col justify-between shadow-xs hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-indigo-500/0 via-indigo-500/80 to-indigo-500/0 opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="pointer-events-none absolute -top-10 -right-10 w-24 h-24 rounded-full bg-indigo-500/10 blur-xl group-hover:bg-indigo-500/20 transition-all duration-500" />

          <div className="relative z-10 flex items-start justify-between gap-2">
            <span className="text-[11px] font-semibold text-foreground-muted tracking-wide truncate group-hover:text-foreground transition-colors">
              Valor Inventario
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(99,102,241,0.18)] group-hover:scale-110 group-hover:bg-indigo-500/25 transition-all duration-300">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div className="relative z-10 mt-2.5">
            <div className="flex items-baseline gap-1" title={formatMoney(metrics.valor_inventario)}>
              <span className="text-[10px] font-bold text-indigo-400 font-mono tracking-wider">RD$</span>
              <p className="text-xl xl:text-[22px] font-black font-mono text-foreground tracking-tight leading-none group-hover:text-indigo-300 transition-colors truncate">
                {formatNumberDecimals(metrics.valor_inventario)}
              </p>
            </div>
            <div className="mt-2.5 flex items-center">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3 h-3" />
                <span>+8% valor</span>
              </span>
            </div>
          </div>
        </div>

        {/* 5. Bajo Stock Mínimo (Amber) */}
        <div
          onClick={() => handleGoToStock("BAJO_MINIMO")}
          className="group relative overflow-hidden rounded-2xl bg-card border border-border/70 hover:border-amber-500/60 p-3.5 sm:p-4 flex flex-col justify-between shadow-xs hover:shadow-lg hover:shadow-amber-500/15 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
        >
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-amber-500/0 via-amber-500/80 to-amber-500/0 opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="pointer-events-none absolute -top-10 -right-10 w-24 h-24 rounded-full bg-amber-500/12 blur-xl group-hover:bg-amber-500/25 transition-all duration-500" />

          <div className="relative z-10 flex items-start justify-between gap-2">
            <span className="text-[11px] font-semibold text-foreground-muted tracking-wide truncate group-hover:text-foreground transition-colors">
              Bajo Mínimo
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.2)] group-hover:scale-110 group-hover:bg-amber-500/25 transition-all duration-300">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

          <div className="relative z-10 mt-2.5">
            <p className="text-2xl sm:text-[26px] font-black font-mono text-foreground tracking-tight leading-none group-hover:text-amber-400 transition-colors">
              {formatNumber(metrics.bajo_minimo)}
            </p>
            <div className="mt-2.5 flex items-center">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Atención</span>
              </span>
            </div>
          </div>
        </div>

        {/* 6. Sin Existencia (Rose) */}
        <div
          onClick={() => handleGoToStock("SIN_STOCK")}
          className="group relative overflow-hidden rounded-2xl bg-card border border-border/70 hover:border-rose-500/60 p-3.5 sm:p-4 flex flex-col justify-between shadow-xs hover:shadow-lg hover:shadow-rose-500/15 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
        >
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-rose-500/0 via-rose-500/80 to-rose-500/0 opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="pointer-events-none absolute -top-10 -right-10 w-24 h-24 rounded-full bg-rose-500/12 blur-xl group-hover:bg-rose-500/25 transition-all duration-500" />

          <div className="relative z-10 flex items-start justify-between gap-2">
            <span className="text-[11px] font-semibold text-foreground-muted tracking-wide truncate group-hover:text-foreground transition-colors">
              Sin Existencia
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(244,63,94,0.2)] group-hover:scale-110 group-hover:bg-rose-500/25 transition-all duration-300">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>

          <div className="relative z-10 mt-2.5">
            <p className="text-2xl sm:text-[26px] font-black font-mono text-foreground tracking-tight leading-none group-hover:text-rose-400 transition-colors">
              {formatNumber(metrics.sin_stock)}
            </p>
            <div className="mt-2.5 flex items-center">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.2)]">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                <span>Agotados</span>
              </span>
            </div>
          </div>
        </div>

        {/* 7. Movimientos Hoy (Cyan) */}
        <div
          onClick={handleGoToMovements}
          className="group relative overflow-hidden rounded-2xl bg-card border border-border/70 hover:border-cyan-500/60 p-3.5 sm:p-4 flex flex-col justify-between shadow-xs hover:shadow-lg hover:shadow-cyan-500/15 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
        >
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-cyan-500/0 via-cyan-500/80 to-cyan-500/0 opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="pointer-events-none absolute -top-10 -right-10 w-24 h-24 rounded-full bg-cyan-500/12 blur-xl group-hover:bg-cyan-500/25 transition-all duration-500" />

          <div className="relative z-10 flex items-start justify-between gap-2">
            <span className="text-[11px] font-semibold text-foreground-muted tracking-wide truncate group-hover:text-foreground transition-colors">
              Movimientos Hoy
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.2)] group-hover:scale-110 group-hover:bg-cyan-500/25 transition-all duration-300">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
          </div>

          <div className="relative z-10 mt-2.5">
            <p className="text-2xl sm:text-[26px] font-black font-mono text-foreground tracking-tight leading-none group-hover:text-cyan-400 transition-colors">
              {formatNumber(metrics.movimientos_hoy)}
            </p>
            <div className="mt-2.5 flex items-center">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/25 px-2 py-0.5 rounded-full">
                <Activity className="w-3 h-3" />
                <span>+4 hoy</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          ROW 2: 3 BLOCKS (Valor por Almacén | Distribución Tipo Producto | Alertas)
          ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Block A: Valor del Inventario por Almacén (3 cols) */}
        <div className="lg:col-span-3 bg-card border border-border rounded-xl p-4 flex flex-col shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <Warehouse className="w-3.5 h-3.5" />
            </div>
            <h3 className="font-bold text-sm text-foreground">
              Valor por Almacén
            </h3>
          </div>
          <div className="flex-grow flex items-center">
            <WarehouseBarChart data={valorPorAlmacen} />
          </div>
        </div>

        {/* Block B: Distribución por Tipo de Producto (5 cols - Amplio y destacado) */}
        <div className="lg:col-span-5 bg-card border border-border rounded-xl p-4 flex flex-col shadow-xs">
          <ProductTypeDonutChart
            data={distribucionTipoProducto}
            totalCount={metrics.productos_activos}
            totalUnidades={metrics.unidades_stock}
            totalMonto={metrics.valor_inventario}
          />
        </div>

        {/* Block C: Alertas de Inventario (4 cols) */}
        <div className="lg:col-span-4 bg-card border border-border rounded-xl p-4 flex flex-col shadow-xs overflow-hidden">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-bold text-sm text-foreground">
                Alertas de Inventario
              </h3>
            </div>
            <button
              onClick={() => handleGoToStock("BAJO_MINIMO")}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>Ver todas</span>
            </button>
          </div>

          <div className="flex-grow overflow-x-hidden">
            {alertas.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center text-foreground-muted text-xs">
                <PackageCheck className="w-8 h-8 text-emerald-400/50 mb-2" />
                <span>Niveles de stock óptimos</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-foreground-muted text-[10px] uppercase font-bold tracking-wider">
                    <th className="py-2 px-1.5">Producto</th>
                    <th className="py-2 px-1.5 text-right">Stock</th>
                    <th className="py-2 px-1.5 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {alertas.map((item) => (
                    <tr
                      key={item.existencia_producto_id}
                      onClick={() => handleGoToStock(item.estado_stock === "SIN_STOCK" ? "SIN_STOCK" : "BAJO_MINIMO")}
                      className="hover:bg-surface/50 transition-colors cursor-pointer group"
                    >
                      <td className="py-2 px-1.5 min-w-0">
                        <p
                          className="text-foreground font-semibold text-xs truncate max-w-[140px] sm:max-w-[180px] group-hover:text-primary transition-colors"
                          title={item.producto_nombre}
                        >
                          {item.producto_nombre}
                        </p>
                        <p className="font-mono text-[10px] text-foreground-muted truncate max-w-[140px] sm:max-w-[180px]">
                          <span>{item.codigo_producto}</span>
                          <span className="mx-1 opacity-40">•</span>
                          <span>{item.almacen_nombre}</span>
                        </p>
                      </td>
                      <td className="py-2 px-1.5 text-right whitespace-nowrap">
                        <span
                          className={`font-mono font-bold text-xs ${
                            item.cantidad_actual === 0 ? "text-rose-400" : "text-amber-400"
                          }`}
                        >
                          {item.cantidad_actual}
                        </span>
                        <p className="text-[10px] text-foreground-muted font-mono">
                          mín {item.stock_minimo}
                        </p>
                      </td>
                      <td className="py-2 px-1.5 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            item.estado_stock === "SIN_STOCK"
                              ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                              : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          }`}
                        >
                          {item.estado_stock === "SIN_STOCK" ? "🚫 Sin stock" : "⚠️ Bajo mín"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ====================================================================
          ROW 3: 2 BLOCKS (Movimientos Recientes ~70% | Último Movimiento ~30%)
          ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Block A: Movimientos Recientes (8 cols) */}
        <div className="lg:col-span-8 bg-card border border-border rounded-xl p-4 flex flex-col shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-bold text-sm text-foreground">
                Movimientos Recientes
              </h3>
            </div>
            <button
              onClick={handleGoToMovements}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>Ver todos</span>
            </button>
          </div>

          <div className="overflow-x-auto flex-grow">
            {movimientosRecientes.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-foreground-muted text-xs">
                <ArrowLeftRight className="w-8 h-8 opacity-40 mb-2" />
                <span>No hay movimientos registrados</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-foreground-muted text-[10px] uppercase font-bold tracking-wider">
                    <th className="py-2 px-2.5">Fecha</th>
                    <th className="py-2 px-2.5">Tipo</th>
                    <th className="py-2 px-2.5">Producto</th>
                    <th className="py-2 px-2.5">Almacén</th>
                    <th className="py-2 px-2.5 text-right">Cantidad</th>
                    <th className="py-2 px-2.5">Usuario</th>
                    <th className="py-2 px-2.5">Referencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {movimientosRecientes.map((m) => {
                    const isEntrada = m.naturaleza === "ENTRADA";
                    const badgeClass = getTipoBadgeStyle(m.tipo_codigo, m.naturaleza);
                    return (
                      <tr key={m.movimiento_inventario_id} className="hover:bg-surface/50 transition-colors">
                        <td className="py-2.5 px-2.5 font-mono text-[11px] text-foreground-muted whitespace-nowrap">
                          {formatDateTime(m.fecha_movimiento)}
                        </td>
                        <td className="py-2.5 px-2.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-tight ${badgeClass}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {m.tipo_codigo}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 font-medium text-foreground truncate max-w-[150px]" title={m.producto_nombre}>
                          {m.producto_nombre}
                        </td>
                        <td className="py-2.5 px-2.5 text-foreground-muted text-[11px] whitespace-nowrap">
                          {m.almacen_nombre}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-bold whitespace-nowrap">
                          <span className={isEntrada ? "text-emerald-400" : "text-rose-400"}>
                            {isEntrada ? "+" : "-"}
                            {m.cantidad}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-foreground-muted text-[11px] truncate max-w-[110px]" title={m.usuario_nombre}>
                          {m.usuario_nombre}
                        </td>
                        <td className="py-2.5 px-2.5 font-mono text-[11px] text-foreground-muted whitespace-nowrap">
                          {m.referencia}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Block B: Último Movimiento (4 cols) */}
        <div className="lg:col-span-4 bg-card border border-border rounded-xl p-4 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-bold text-sm text-foreground">
                  Último Movimiento
                </h3>
              </div>
              <button
                onClick={handleGoToMovements}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>Ver detalle</span>
              </button>
            </div>

            {ultimoMovimiento ? (
              <div className="space-y-2 text-xs divide-y divide-border/40">
                <div className="flex justify-between items-center py-1">
                  <span className="text-foreground-muted">Producto:</span>
                  <span className="font-bold text-foreground truncate max-w-[180px]" title={ultimoMovimiento.producto_nombre}>
                    {ultimoMovimiento.producto_nombre}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-foreground-muted">Tipo:</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-tight ${getTipoBadgeStyle(
                      ultimoMovimiento.tipo_codigo,
                      ultimoMovimiento.naturaleza
                    )}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {ultimoMovimiento.tipo_codigo}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-foreground-muted">Almacén:</span>
                  <span className="font-medium text-foreground">{ultimoMovimiento.almacen_nombre}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-foreground-muted">Cantidad:</span>
                  <span
                    className={`font-mono font-bold ${
                      ultimoMovimiento.naturaleza === "ENTRADA" ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {ultimoMovimiento.naturaleza === "ENTRADA" ? "+" : "-"}
                    {ultimoMovimiento.cantidad}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-foreground-muted">Stock anterior:</span>
                  <span className="font-mono text-foreground font-semibold">
                    {ultimoMovimiento.stock_anterior}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-foreground-muted">Stock nuevo:</span>
                  <span className="font-mono text-foreground font-semibold">
                    {ultimoMovimiento.stock_nuevo}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-foreground-muted">Referencia:</span>
                  <span className="font-mono text-foreground font-semibold">
                    {ultimoMovimiento.referencia}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-foreground-muted">Usuario:</span>
                  <span className="text-foreground font-medium">{ultimoMovimiento.usuario_nombre}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-foreground-muted">Fecha:</span>
                  <span className="font-mono text-foreground-muted text-[11px]">
                    {formatDateTime(ultimoMovimiento.fecha_movimiento)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-foreground-muted text-xs">
                <FileText className="w-8 h-8 opacity-40 mb-2" />
                <span>No hay movimientos registrados</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
