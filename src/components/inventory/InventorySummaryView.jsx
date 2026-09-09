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
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Clock,
  ExternalLink,
  ChevronRight,
  Info
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

// 2. Responsive SVG Donut Chart for "Distribución por Categoría"
function CategoryDonutChart({ data, totalCount }) {
  const categoryColors = [
    "#3B82F6", // Blue (Repuestos)
    "#10B981", // Emerald (Accesorios)
    "#F97316", // Orange (Herramientas)
    "#8B5CF6", // Purple (Lubricantes)
    "#64748B", // Slate (Otros)
    "#EC4899", // Pink
    "#EAB308"  // Yellow
  ];

  const total = Number(totalCount || data.reduce((acc, d) => acc + d.total_productos, 0)) || 1;

  // Calculate SVG Pie/Donut paths
  const chartSegments = useMemo(() => {
    let accumulatedAngle = 0;
    return data.map((item, index) => {
      const percentage = (item.total_productos / total) * 100;
      const angle = (item.total_productos / total) * 360;
      const startAngle = accumulatedAngle;
      const endAngle = accumulatedAngle + angle;
      accumulatedAngle = endAngle;

      const color = categoryColors[index % categoryColors.length];

      // SVG Arc Calculation (center at 100, 100, radius 70, inner radius 48)
      const radius = 68;
      const innerRadius = 46;
      const cx = 100;
      const cy = 100;

      const toRad = (deg) => ((deg - 90) * Math.PI) / 180;
      const x1 = cx + radius * Math.cos(toRad(startAngle));
      const y1 = cy + radius * Math.sin(toRad(startAngle));
      const x2 = cx + radius * Math.cos(toRad(endAngle - 0.01));
      const y2 = cy + radius * Math.sin(toRad(endAngle - 0.01));

      const ix1 = cx + innerRadius * Math.cos(toRad(endAngle - 0.01));
      const iy1 = cy + innerRadius * Math.sin(toRad(endAngle - 0.01));
      const ix2 = cx + innerRadius * Math.cos(toRad(startAngle));
      const iy2 = cy + innerRadius * Math.sin(toRad(startAngle));

      const largeArcFlag = angle > 180 ? 1 : 0;

      const pathData = `
        M ${x1} ${y1}
        A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
        L ${ix1} ${iy1}
        A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix2} ${iy2}
        Z
      `;

      return {
        ...item,
        percentage: Math.round(percentage),
        color,
        pathData
      };
    });
  }, [data, total]);

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-foreground-muted text-xs">
        <Layers className="w-8 h-8 opacity-40 mb-2" />
        <span>Sin categorías disponibles</span>
      </div>
    );
  }

  return (
    <div className="w-full h-64 flex items-center justify-between gap-4 px-2 select-none">
      {/* Left: Donut SVG Graphic */}
      <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90 drop-shadow-sm">
          {chartSegments.map((seg, i) => (
            <path
              key={i}
              d={seg.pathData}
              fill={seg.color}
              className="transition-all duration-200 hover:opacity-90 hover:scale-105 transform origin-center cursor-pointer"
            />
          ))}
        </svg>

        {/* Center Counter */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-2xl font-black text-foreground font-mono leading-none">
            {total}
          </span>
          <span className="text-[11px] font-medium text-foreground-muted mt-1">
            Productos
          </span>
        </div>
      </div>

      {/* Right: Legend Items */}
      <div className="flex-grow space-y-2.5 max-h-56 overflow-y-auto pr-1">
        {chartSegments.map((item, index) => (
          <div key={index} className="flex items-center justify-between text-xs group">
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <span
                className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-foreground-secondary font-medium truncate group-hover:text-foreground transition-colors">
                {item.categoria_nombre}
              </span>
            </div>
            <span className="font-mono font-bold text-foreground shrink-0 text-xs">
              {item.percentage}%
            </span>
          </div>
        ))}
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
        <div className="h-16 bg-card border border-border rounded-xl" />
        {/* KPIs Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-28 bg-card border border-border rounded-xl" />
          ))}
        </div>
        {/* Row 2 Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 h-72 bg-card border border-border rounded-xl" />
          <div className="lg:col-span-3 h-72 bg-card border border-border rounded-xl" />
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
        <h3 className="text-base font-bold text-foreground">Error al cargar el resumen</h3>
        <p className="text-xs text-foreground-muted">{error}</p>
        <button
          onClick={fetchSummary}
          className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Reintentar
        </button>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const valorPorAlmacen = data?.valor_por_almacen || [];
  const distribucionCategoria = data?.distribucion_categoria || [];
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
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-sm">
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
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-xs"
            title="Actualizar datos en tiempo real"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          ROW 1: 7 COMPACT KPI CARDS
          ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5">
        {/* 1. Productos Activos */}
        <div className="bg-card border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-medium text-foreground-muted truncate">
              Productos Activos
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1">
            <p className="text-2xl font-bold font-mono text-foreground tracking-tight">
              {formatNumber(metrics.productos_activos)}
            </p>
            <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 mt-1">
              <span>▲</span>
              <span>+3 este mes</span>
            </p>
          </div>
        </div>

        {/* 2. Almacenes Activos */}
        <div className="bg-card border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-medium text-foreground-muted truncate">
              Almacenes Activos
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
              <Warehouse className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1">
            <p className="text-2xl font-bold font-mono text-foreground tracking-tight">
              {formatNumber(metrics.almacenes_activos)}
            </p>
            <p className="text-[10px] text-foreground-muted font-medium flex items-center gap-1 mt-1">
              <span>—</span>
              <span>Sin cambios</span>
            </p>
          </div>
        </div>

        {/* 3. Unidades en Stock */}
        <div className="bg-card border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-medium text-foreground-muted truncate">
              Unidades en Stock
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1">
            <p className="text-2xl font-bold font-mono text-foreground tracking-tight">
              {formatNumber(metrics.unidades_stock)}
            </p>
            <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 mt-1">
              <span>▲</span>
              <span>+12% vs. mes anterior</span>
            </p>
          </div>
        </div>

        {/* 4. Valor del Inventario */}
        <div className="bg-card border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-medium text-foreground-muted truncate">
              Valor del Inventario
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-600/15 text-blue-400 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1">
            <p className="text-lg font-bold font-mono text-foreground tracking-tight truncate" title={formatMoney(metrics.valor_inventario)}>
              {formatMoney(metrics.valor_inventario)}
            </p>
            <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 mt-1">
              <span>▲</span>
              <span>+8% vs. mes anterior</span>
            </p>
          </div>
        </div>

        {/* 5. Bajo Stock Mínimo */}
        <div
          onClick={() => handleGoToStock("BAJO_MINIMO")}
          className="bg-card border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-xs cursor-pointer hover:border-amber-500/50 transition-colors"
        >
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-medium text-foreground-muted truncate">
              Bajo Stock Mínimo
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1">
            <p className="text-2xl font-bold font-mono text-foreground tracking-tight">
              {formatNumber(metrics.bajo_minimo)}
            </p>
            <p className="text-[10px] text-amber-400 font-semibold flex items-center gap-1 mt-1">
              <span>⚠️</span>
              <span>Requieren atención</span>
            </p>
          </div>
        </div>

        {/* 6. Sin Existencia */}
        <div
          onClick={() => handleGoToStock("SIN_STOCK")}
          className="bg-card border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-xs cursor-pointer hover:border-rose-500/50 transition-colors"
        >
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-medium text-foreground-muted truncate">
              Sin Existencia
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1">
            <p className="text-2xl font-bold font-mono text-foreground tracking-tight">
              {formatNumber(metrics.sin_stock)}
            </p>
            <p className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1">
              <span>▲</span>
              <span>Sin stock</span>
            </p>
          </div>
        </div>

        {/* 7. Movimientos Hoy */}
        <div
          onClick={handleGoToMovements}
          className="bg-card border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-xs cursor-pointer hover:border-cyan-500/50 transition-colors"
        >
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-medium text-foreground-muted truncate">
              Movimientos Hoy
            </span>
            <div className="w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1">
            <p className="text-2xl font-bold font-mono text-foreground tracking-tight">
              {formatNumber(metrics.movimientos_hoy)}
            </p>
            <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 mt-1">
              <span>▲</span>
              <span>+4 vs. ayer</span>
            </p>
          </div>
        </div>
      </div>

      {/* ====================================================================
          ROW 2: 3 BLOCKS (Valor por Almacén | Distribución Categoría | Alertas)
          ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Block A: Valor del Inventario por Almacén (5 cols) */}
        <div className="lg:col-span-5 bg-card border border-border rounded-xl p-4 flex flex-col shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <Warehouse className="w-3.5 h-3.5" />
            </div>
            <h3 className="font-bold text-sm text-foreground">
              Valor del Inventario por Almacén
            </h3>
          </div>
          <div className="flex-grow flex items-center">
            <WarehouseBarChart data={valorPorAlmacen} />
          </div>
        </div>

        {/* Block B: Distribución por Categoría (3.5 cols -> lg:col-span-3 or 4) */}
        <div className="lg:col-span-3 bg-card border border-border rounded-xl p-4 flex flex-col shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-md bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <h3 className="font-bold text-sm text-foreground">
              Distribución por Categoría
            </h3>
          </div>
          <div className="flex-grow flex items-center justify-center">
            <CategoryDonutChart
              data={distribucionCategoria}
              totalCount={metrics.productos_activos}
            />
          </div>
        </div>

        {/* Block C: Alertas de Inventario (4 cols -> lg:col-span-4) */}
        <div className="lg:col-span-4 bg-card border border-border rounded-xl p-4 flex flex-col shadow-xs">
          <div className="flex items-center justify-between mb-3">
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

          <div className="overflow-x-auto flex-grow">
            {alertas.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center text-foreground-muted text-xs">
                <PackageCheck className="w-8 h-8 text-emerald-400/50 mb-2" />
                <span>Niveles de stock óptimos</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-foreground-muted text-[10px] uppercase font-bold tracking-wider">
                    <th className="py-2 px-1.5">Código</th>
                    <th className="py-2 px-1.5">Producto</th>
                    <th className="py-2 px-1.5">Almacén</th>
                    <th className="py-2 px-1.5 text-right">Stock</th>
                    <th className="py-2 px-1.5 text-right">Mínimo</th>
                    <th className="py-2 px-1.5 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {alertas.map((item) => (
                    <tr key={item.existencia_producto_id} className="hover:bg-surface/50 transition-colors">
                      <td className="py-2 px-1.5 font-mono text-[11px] font-semibold text-foreground">
                        {item.codigo_producto}
                      </td>
                      <td className="py-2 px-1.5 text-foreground font-medium truncate max-w-[110px]" title={item.producto_nombre}>
                        {item.producto_nombre}
                      </td>
                      <td className="py-2 px-1.5 text-foreground-muted text-[11px] truncate max-w-[70px]">
                        {item.almacen_nombre}
                      </td>
                      <td className="py-2 px-1.5 text-right font-mono font-bold">
                        <span className={item.cantidad_actual === 0 ? "text-rose-400" : "text-amber-400"}>
                          {item.cantidad_actual}
                        </span>
                      </td>
                      <td className="py-2 px-1.5 text-right font-mono text-foreground-muted text-[11px]">
                        {item.stock_minimo}
                      </td>
                      <td className="py-2 px-1.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            item.estado_stock === "SIN_STOCK"
                              ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                              : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          }`}
                        >
                          {item.estado_stock === "SIN_STOCK" ? "🚫 Sin stock" : "⚠️ Bajo mínimo"}
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
