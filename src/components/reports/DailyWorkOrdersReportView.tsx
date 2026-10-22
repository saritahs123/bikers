"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar,
  Search,
  Wrench,
  CheckCircle2,
  Clock,
  Layers,
  CalendarRange,
  Tag,
  X,
  AlertCircle,
  Inbox
} from "lucide-react";
import { ReportHeader } from "./ReportHeader";
import { ReportKpiCard, ReportKpiGrid } from "./ReportKpiCard";
import { ReportPagination } from "./ReportPagination";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  formatCurrency,
  formatToDDMMYYYY,
  getTodaySantoDomingo,
  getDaysAgoSantoDomingo,
} from "@/lib/reports/reportExportService";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { COMPANY_LOGO_BASE64 } from "@/lib/assets/logoBase64";

interface DailyWorkOrdersReportViewProps {
  initialCompany?: string;
  canExport?: boolean;
}

export interface WorkOrderDailyDetailRow {
  orden_trabajo_id: number;
  codigo_orden: string;
  fecha_dia: string;
  fecha_registro: string;
  fecha_entrega_real: string | null;
  cliente_id: number;
  cliente_nombre: string;
  cliente_telefono: string | null;
  bicicleta: string;
  bicicleta_serie: string | null;
  servicios_contratados: string | null;
  estado_orden_id: number;
  estado_nombre: string;
  estado_codigo: string;
  estado_color: string;
  mecanico_nombre: string;
  subtotal: number;
  descuento: number;
  impuestos: number;
  total_orden: number;
  [key: string]: unknown;
}

export interface WorkOrderDailyGroupSummary {
  fecha_dia: string;
  cantidad_ordenes: number;
  subtotal: number;
  descuento: number;
  impuestos: number;
  total_orden: number;
  ordenes?: WorkOrderDailyDetailRow[];
}

export function DailyWorkOrdersReportView({ initialCompany = "Ride Lab", canExport }: DailyWorkOrdersReportViewProps) {
  const defaultFrom = useMemo(() => getDaysAgoSantoDomingo(6), []);
  const defaultTo = useMemo(() => getTodaySantoDomingo(), []);

  // Filter State
  const [fechaDesde, setFechaDesde] = useState(defaultFrom);
  const [fechaHasta, setFechaHasta] = useState(defaultTo);
  const [estadoId, setEstadoId] = useState("TODOS");
  const [tipoServicioId, setTipoServicioId] = useState("TODOS");
  const [search, setSearch] = useState("");

  // Catalog Options
  const [filterOptions, setFilterOptions] = useState<{
    orderStatuses: { estado_orden_id: number; codigo: string; nombre: string; color_estado: string }[];
    serviceTypes: { tipo_servicio_id: number; codigo: string; nombre: string }[];
  }>({ orderStatuses: [], serviceTypes: [] });

  // Presentation State
  const [activeTab, setActiveTab] = useState<"detail" | "summary">("detail");

  // Data State
  const [rows, setRows] = useState<WorkOrderDailyDetailRow[]>([]);
  const [daySummaries, setDaySummaries] = useState<WorkOrderDailyGroupSummary[]>([]);
  const [kpis, setKpis] = useState({
    totalOrdenes: 0,
    montoTotalTaller: 0,
    ordenesCompletadas: 0,
    ordenesActivas: 0,
    totalSubtotal: 0,
    totalDescuento: 0,
    totalImpuestos: 0,
  });
  const [meta, setMeta] = useState({ totalRecords: 0, page: 1, limit: 10, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Export State
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Load Catalogs
  useEffect(() => {
    async function loadCatalogs() {
      try {
        const res = await fetch("/api/reports/filter-options");
        if (res.ok) {
          const json = await res.json();
          setFilterOptions({
            orderStatuses: json.orderStatuses || [],
            serviceTypes: json.serviceTypes || [],
          });
        }
      } catch (err) {
        console.error("Error loading filter options:", err);
      }
    }
    loadCatalogs();
  }, []);

  // Fetch Report Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (fechaDesde) params.set("fechaDesde", fechaDesde);
      if (fechaHasta) params.set("fechaHasta", fechaHasta);
      if (estadoId !== "TODOS") params.set("estado_id", estadoId);
      if (tipoServicioId !== "TODOS") params.set("tipo_servicio_id", tipoServicioId);
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", String(pageSize));

      const res = await fetch(`/api/reports/work-orders-daily?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || `Error del servidor (${res.status})`);
      }

      const json = await res.json();
      setRows(json.data || []);
      setDaySummaries(json.daySummaries || []);
      if (json.kpis) setKpis(json.kpis);
      if (json.meta) setMeta(json.meta);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al cargar el reporte.";
      console.error("fetchData Error:", err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [fechaDesde, fechaHasta, estadoId, tipoServicioId, search, page, pageSize]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  // Preset Date Handlers
  const handleDatePreset = (preset: "7D" | "TODAY" | "YESTERDAY" | "THIS_MONTH") => {
    const today = getTodaySantoDomingo();
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");

    if (preset === "7D") {
      setFechaDesde(getDaysAgoSantoDomingo(6));
      setFechaHasta(today);
      setPage(1);
    } else if (preset === "TODAY") {
      setFechaDesde(today);
      setFechaHasta(today);
      setPage(1);
    } else if (preset === "YESTERDAY") {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
      setFechaDesde(yStr);
      setFechaHasta(yStr);
      setPage(1);
    } else if (preset === "THIS_MONTH") {
      const firstDay = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
      setFechaDesde(firstDay);
      setFechaHasta(today);
      setPage(1);
    }
  };

  const handleClearFilters = () => {
    setFechaDesde(defaultFrom);
    setFechaHasta(defaultTo);
    setEstadoId("TODOS");
    setTipoServicioId("TODOS");
    setSearch("");
    setPage(1);
  };

  // Group paginated detail rows by day
  const groupedRows = useMemo(() => {
    const map = new Map<string, WorkOrderDailyDetailRow[]>();
    rows.forEach((r) => {
      const list = map.get(r.fecha_dia) || [];
      list.push(r);
      map.set(r.fecha_dia, list);
    });
    return Array.from(map.entries()).map(([day, items]) => {
      const summary = daySummaries.find((s) => s.fecha_dia === day) || {
        fecha_dia: day,
        cantidad_ordenes: items.length,
        subtotal: items.reduce((a, b) => a + Number(b.subtotal), 0),
        descuento: items.reduce((a, b) => a + Number(b.descuento), 0),
        impuestos: items.reduce((a, b) => a + Number(b.impuestos), 0),
        total_orden: items.reduce((a, b) => a + Number(b.total_orden), 0),
      };
      return { day, items, summary };
    });
  }, [rows, daySummaries]);

  // Fetch full dataset for export
  const fetchAllForExport = async () => {
    const params = new URLSearchParams();
    if (fechaDesde) params.set("fechaDesde", fechaDesde);
    if (fechaHasta) params.set("fechaHasta", fechaHasta);
    if (estadoId !== "TODOS") params.set("estado_id", estadoId);
    if (tipoServicioId !== "TODOS") params.set("tipo_servicio_id", tipoServicioId);
    if (search) params.set("search", search);
    params.set("export", "true");

    const res = await fetch(`/api/reports/work-orders-daily?${params.toString()}`);
    if (!res.ok) throw new Error("Error al obtener los datos para exportar.");
    const json = await res.json();
    return {
      allRows: (json.data || []) as WorkOrderDailyDetailRow[],
      daySummaries: (json.daySummaries || []) as WorkOrderDailyGroupSummary[],
      kpis: json.kpis,
    };
  };

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const { allRows, daySummaries: fullSummaries, kpis: fullKpis } = await fetchAllForExport();

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Ride Lab ERP";
      workbook.created = new Date();

      if (activeTab === "detail") {
        // Sheet: Detalle de Órdenes
        const wsDetail = workbook.addWorksheet("Detalle de Órdenes", { views: [{ showGridLines: true }] });
        wsDetail.mergeCells(1, 1, 1, 13);
        const t1 = wsDetail.getCell(1, 1);
        t1.value = `RIDE LAB  |  REPORTE DETALLADO DE ÓRDENES DE TRABAJO POR DÍA`;
        t1.font = { name: "Arial", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
        t1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E1117" } };
        t1.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        wsDetail.getRow(1).height = 26;

        wsDetail.mergeCells(2, 1, 2, 13);
        const sub1 = wsDetail.getCell(2, 1);
        sub1.value = `Período: ${formatToDDMMYYYY(fechaDesde)} al ${formatToDDMMYYYY(fechaHasta)}  •  Generado: ${new Date().toLocaleString("es-DO")}  •  Empresa: ${initialCompany}`;
        sub1.font = { name: "Arial", size: 8.5, italic: true, color: { argb: "FF64748B" } };
        sub1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        wsDetail.getRow(2).height = 18;

        // Filter summary
        wsDetail.getCell(4, 1).value = "FILTROS:";
        wsDetail.getCell(4, 1).font = { name: "Arial", size: 8, bold: true, color: { argb: "FFD97706" } };
        wsDetail.mergeCells(4, 2, 4, 13);
        wsDetail.getCell(4, 2).value = `Fecha: ${formatToDDMMYYYY(fechaDesde)} a ${formatToDDMMYYYY(fechaHasta)} | Estado: ${estadoId} | Servicio: ${tipoServicioId} | Búsqueda: ${search || "Ninguna"}`;
        wsDetail.getCell(4, 2).font = { name: "Arial", size: 8, color: { argb: "FF334155" } };

        const headers = [
          "FECHA",
          "HORA",
          "CÓDIGO ORDEN",
          "CLIENTE",
          "BICICLETA",
          "SERVICIOS CONTRATADOS",
          "ESTADO",
          "MECÁNICO",
          "SUBTOTAL",
          "DESCUENTO",
          "IMPUESTOS",
          "TOTAL ORDEN",
          "FECHA ENTREGA",
        ];
        const hRow = wsDetail.getRow(6);
        hRow.height = 22;
        headers.forEach((h, i) => {
          const c = hRow.getCell(i + 1);
          c.value = h;
          c.font = { name: "Arial", size: 8.5, bold: true, color: { argb: "FFFFFFFF" } };
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
          c.alignment = { vertical: "middle", horizontal: i >= 8 && i <= 11 ? "right" : i === 0 || i === 1 || i === 6 || i === 12 ? "center" : "left" };
        });

        let rIdx = 7;
        allRows.forEach((row, i) => {
          const r = wsDetail.getRow(rIdx);
          r.height = 18;
          const isEven = i % 2 === 0;

          r.getCell(1).value = formatToDDMMYYYY(row.fecha_dia);
          r.getCell(1).alignment = { horizontal: "center" };
          r.getCell(2).value = new Date(row.fecha_registro).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", hour12: true });
          r.getCell(2).alignment = { horizontal: "center" };
          r.getCell(3).value = row.codigo_orden;
          r.getCell(4).value = row.cliente_nombre;
          r.getCell(5).value = row.bicicleta;
          r.getCell(6).value = row.servicios_contratados || "Sin servicios detallados";
          r.getCell(7).value = row.estado_nombre;
          r.getCell(8).value = row.mecanico_nombre;
          r.getCell(9).value = Number(row.subtotal) || 0;
          r.getCell(10).value = Number(row.descuento) || 0;
          r.getCell(11).value = Number(row.impuestos) || 0;
          r.getCell(12).value = Number(row.total_orden) || 0;
          r.getCell(13).value = row.fecha_entrega_real ? formatToDDMMYYYY(row.fecha_entrega_real) : "Pendiente";
          r.getCell(13).alignment = { horizontal: "center" };

          for (let col = 9; col <= 12; col++) {
            r.getCell(col).numFmt = '"RD$"#,##0.00;("RD$"#,##0.00);"-"';
            r.getCell(col).alignment = { horizontal: "right" };
          }

          for (let col = 1; col <= 13; col++) {
            r.getCell(col).font = { name: "Arial", size: 8, color: { argb: "FF1E293B" } };
            if (isEven) {
              r.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
            }
            r.getCell(col).border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
          }

          rIdx++;
        });

        // Total Row
        const totRow = wsDetail.getRow(rIdx);
        totRow.height = 20;
        totRow.getCell(1).value = `TOTAL GENERAL (${fullKpis.totalOrdenes} ÓRDENES)`;
        totRow.getCell(9).value = fullKpis.totalSubtotal;
        totRow.getCell(10).value = fullKpis.totalDescuento;
        totRow.getCell(11).value = fullKpis.totalImpuestos;
        totRow.getCell(12).value = fullKpis.montoTotalTaller;

        for (let col = 9; col <= 12; col++) {
          totRow.getCell(col).numFmt = '"RD$"#,##0.00;("RD$"#,##0.00);"-"';
          totRow.getCell(col).alignment = { horizontal: "right" };
        }
        for (let col = 1; col <= 13; col++) {
          totRow.getCell(col).font = { name: "Arial", size: 8.5, bold: true, color: { argb: "FF0F172A" } };
          totRow.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
          totRow.getCell(col).border = { top: { style: "thin", color: { argb: "FF94A3B8" } }, bottom: { style: "double", color: { argb: "FF0F172A" } } };
        }

        // Column widths
        for (let c = 1; c <= 13; c++) {
          wsDetail.getColumn(c).width = c === 4 ? 24 : c === 1 ? 14 : c === 2 ? 12 : c === 5 ? 20 : c === 6 ? 28 : 15;
        }
      } else {
        // Sheet: Resumen Diario
        const wsSummary = workbook.addWorksheet("Resumen Diario", { views: [{ showGridLines: true }] });
        wsSummary.mergeCells(1, 1, 1, 6);
        const t2 = wsSummary.getCell(1, 1);
        t2.value = `RIDE LAB  |  RESUMEN DIARIO DE ÓRDENES DE TRABAJO`;
        t2.font = { name: "Arial", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
        t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E1117" } };
        wsSummary.getRow(1).height = 26;

        wsSummary.mergeCells(2, 1, 2, 6);
        const sub2 = wsSummary.getCell(2, 1);
        sub2.value = `Período: ${formatToDDMMYYYY(fechaDesde)} al ${formatToDDMMYYYY(fechaHasta)}  •  Generado: ${new Date().toLocaleString("es-DO")}  •  Empresa: ${initialCompany}`;
        sub2.font = { name: "Arial", size: 8.5, italic: true, color: { argb: "FF64748B" } };
        sub2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        wsSummary.getRow(2).height = 18;

        const sHeaders = ["FECHA (DÍA)", "CANTIDAD ÓRDENES", "SUBTOTAL", "DESCUENTOS", "IMPUESTOS", "TOTAL DÍA"];
        const shRow = wsSummary.getRow(4);
        shRow.height = 22;
        sHeaders.forEach((h, i) => {
          const c = shRow.getCell(i + 1);
          c.value = h;
          c.font = { name: "Arial", size: 8.5, bold: true, color: { argb: "FFFFFFFF" } };
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
          c.alignment = { vertical: "middle", horizontal: i >= 2 ? "right" : "center" };
        });

        let srIdx = 5;
        fullSummaries.forEach((s) => {
          const r = wsSummary.getRow(srIdx);
          r.height = 18;
          r.getCell(1).value = formatToDDMMYYYY(s.fecha_dia);
          r.getCell(1).alignment = { horizontal: "center" };
          r.getCell(2).value = s.cantidad_ordenes;
          r.getCell(3).value = Number(s.subtotal);
          r.getCell(4).value = Number(s.descuento);
          r.getCell(5).value = Number(s.impuestos);
          r.getCell(6).value = Number(s.total_orden);

          for (let col = 3; col <= 6; col++) {
            r.getCell(col).numFmt = '"RD$"#,##0.00;("RD$"#,##0.00);"-"';
            r.getCell(col).alignment = { horizontal: "right" };
          }
          r.getCell(2).numFmt = "#,##0";
          r.getCell(2).alignment = { horizontal: "center" };

          for (let col = 1; col <= 6; col++) {
            r.getCell(col).font = { name: "Arial", size: 8 };
            r.getCell(col).border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
          }
          srIdx++;
        });

        // Totals Row
        const stRow = wsSummary.getRow(srIdx);
        stRow.height = 20;
        stRow.getCell(1).value = `TOTALES (${fullKpis.totalOrdenes} ÓRDENES)`;
        stRow.getCell(2).value = fullKpis.totalOrdenes;
        stRow.getCell(3).value = fullKpis.totalSubtotal;
        stRow.getCell(4).value = fullKpis.totalDescuento;
        stRow.getCell(5).value = fullKpis.totalImpuestos;
        stRow.getCell(6).value = fullKpis.montoTotalTaller;

        for (let col = 3; col <= 6; col++) {
          stRow.getCell(col).numFmt = '"RD$"#,##0.00;("RD$"#,##0.00);"-"';
          stRow.getCell(col).alignment = { horizontal: "right" };
        }
        stRow.getCell(2).numFmt = "#,##0";
        stRow.getCell(2).alignment = { horizontal: "center" };

        for (let col = 1; col <= 6; col++) {
          stRow.getCell(col).font = { name: "Arial", size: 8.5, bold: true, color: { argb: "FF0F172A" } };
          stRow.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
          stRow.getCell(col).border = { top: { style: "thin", color: { argb: "FF94A3B8" } }, bottom: { style: "double", color: { argb: "FF0F172A" } } };
        }

        for (let c = 1; c <= 6; c++) {
          wsSummary.getColumn(c).width = 18;
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte_ordenes_${activeTab === "detail" ? "detalle" : "resumen"}_${fechaDesde}_${fechaHasta}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export Excel error:", err);
      alert("Error al exportar a Excel.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Export to PDF
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      const { allRows, daySummaries: fullSummaries, kpis: fullKpis } = await fetchAllForExport();

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = 297;
      const marginX = 8;
      let currentY = 12;

      // Header Branding
      try {
        if (COMPANY_LOGO_BASE64) {
          doc.addImage(COMPANY_LOGO_BASE64, "PNG", marginX, currentY, 28, 9.5);
        }
      } catch {
        // fallback
      }

      const reportTitle = activeTab === "detail" ? "REPORTE DETALLADO DE ÓRDENES DE TRABAJO POR DÍA" : "RESUMEN DIARIO DE ÓRDENES DE TRABAJO";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(reportTitle, marginX + 32, currentY + 4);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Período consultado: ${formatToDDMMYYYY(fechaDesde)} al ${formatToDDMMYYYY(fechaHasta)}  |  Empresa: ${initialCompany}`, marginX + 32, currentY + 8.5);

      doc.setFontSize(7);
      doc.text(`Generado: ${new Date().toLocaleString("es-DO")}`, pageWidth - marginX, currentY + 4, { align: "right" });
      doc.text(`Total Órdenes: ${fullKpis.totalOrdenes} (${fullKpis.ordenesCompletadas} completadas/entregadas)`, pageWidth - marginX, currentY + 8.5, { align: "right" });

      currentY += 13;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(marginX, currentY, pageWidth - marginX, currentY);
      currentY += 4;

      // KPI Summary Box
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(marginX, currentY, pageWidth - marginX * 2, 9, 1.5, 1.5, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      const kpiLine = `TOTAL ÓRDENES: ${fullKpis.totalOrdenes}    |    MONTO TALLER: ${formatCurrency(fullKpis.montoTotalTaller)}    |    COMPLETADAS/ENTREGADAS: ${fullKpis.ordenesCompletadas}    |    ACTIVAS: ${fullKpis.ordenesActivas}`;
      doc.text(kpiLine, marginX + 4, currentY + 5.5);

      currentY += 12;

      if (activeTab === "detail") {
        const tableHeaders = [
          "HORA",
          "CÓDIGO OT",
          "CLIENTE",
          "VEHÍCULO / BICI",
          "SERVICIOS CONTRATADOS",
          "ESTADO",
          "MECÁNICO",
          "SUBTOTAL",
          "DESCUENTO",
          "IMPUESTOS",
          "TOTAL",
          "F. ENTREGA",
        ];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tableBody: any[] = [];
        const dayGroupsMap = new Map<string, WorkOrderDailyDetailRow[]>();
        allRows.forEach((r) => {
          const list = dayGroupsMap.get(r.fecha_dia) || [];
          list.push(r);
          dayGroupsMap.set(r.fecha_dia, list);
        });

        fullSummaries.forEach((s) => {
          const dayRows = dayGroupsMap.get(s.fecha_dia) || [];
          const dayDate = new Date(`${s.fecha_dia}T12:00:00`);
          const dayTitle = dayDate.toLocaleDateString("es-DO", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }).toUpperCase();

          // Day Banner Row with colSpan 12
          tableBody.push([
            {
              content: `>> ${dayTitle}  (${s.cantidad_ordenes} ${s.cantidad_ordenes === 1 ? "orden registrada" : "órdenes registradas"})`,
              colSpan: 12,
              styles: {
                fontStyle: "bold",
                fillColor: [30, 41, 59],
                textColor: [255, 255, 255],
                fontSize: 7.2,
                cellPadding: 2,
              },
            },
          ]);

          dayRows.forEach((ot) => {
            const hora = new Date(ot.fecha_registro).toLocaleTimeString("es-DO", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });
            tableBody.push([
              hora,
              ot.codigo_orden,
              ot.cliente_nombre.substring(0, 24),
              ot.bicicleta.substring(0, 20),
              (ot.servicios_contratados || "—").substring(0, 32),
              ot.estado_nombre,
              ot.mecanico_nombre.substring(0, 18),
              formatCurrency(ot.subtotal),
              Number(ot.descuento) > 0 ? `-${formatCurrency(ot.descuento)}` : "—",
              formatCurrency(ot.impuestos),
              formatCurrency(ot.total_orden),
              ot.fecha_entrega_real ? formatToDDMMYYYY(ot.fecha_entrega_real) : "Pend.",
            ]);
          });

          // Day Subtotal Row with colSpan 7
          tableBody.push([
            {
              content: `SUBTOTAL (${s.cantidad_ordenes} ${s.cantidad_ordenes === 1 ? "ORDEN" : "ÓRDENES"})`,
              colSpan: 7,
              styles: {
                fontStyle: "bold",
                fillColor: [241, 245, 249],
                textColor: [15, 23, 42],
                fontSize: 7,
                cellPadding: 2,
              },
            },
            formatCurrency(s.subtotal),
            Number(s.descuento) > 0 ? `-${formatCurrency(s.descuento)}` : "—",
            formatCurrency(s.impuestos),
            formatCurrency(s.total_orden),
            "—",
          ]);
        });

        // Grand Total Row with colSpan 7
        tableBody.push([
          {
            content: `TOTAL GENERAL (${fullKpis.totalOrdenes} ÓRDENES)`,
            colSpan: 7,
            styles: {
              fontStyle: "bold",
              fillColor: [226, 232, 240],
              textColor: [15, 23, 42],
              fontSize: 7.5,
              cellPadding: 2.2,
            },
          },
          formatCurrency(fullKpis.totalSubtotal),
          Number(fullKpis.totalDescuento) > 0 ? `-${formatCurrency(fullKpis.totalDescuento)}` : "—",
          formatCurrency(fullKpis.totalImpuestos),
          formatCurrency(fullKpis.montoTotalTaller),
          "—",
        ]);

        autoTable(doc, {
          startY: currentY,
          margin: { left: marginX, right: marginX, bottom: 12 },
          head: [tableHeaders],
          body: tableBody,
          theme: "plain",
          styles: {
            font: "helvetica",
            fontSize: 6.8,
            cellPadding: 1.6,
            lineColor: [226, 232, 240],
            lineWidth: 0.1,
            textColor: [30, 41, 59],
          },
          headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 6.8,
            halign: "left",
          },
          columnStyles: {
            0: { cellWidth: 16, halign: "center" },
            1: { cellWidth: 22, halign: "left" },
            2: { cellWidth: 36, halign: "left" },
            3: { cellWidth: 26, halign: "left" },
            4: { cellWidth: 42, halign: "left" },
            5: { cellWidth: 18, halign: "center" },
            6: { cellWidth: 24, halign: "left" },
            7: { cellWidth: 21, halign: "right" },
            8: { cellWidth: 18, halign: "right" },
            9: { cellWidth: 18, halign: "right" },
            10: { cellWidth: 23, halign: "right" },
            11: { cellWidth: 15, halign: "center" },
          },
          didParseCell: (dataCell) => {
            const rowRaw = dataCell.row.raw as unknown as Array<string | number | { content?: string }>;
            const firstCell = Array.isArray(rowRaw) ? rowRaw[0] : null;
            const firstContent =
              typeof firstCell === "object" && firstCell !== null && "content" in firstCell
                ? String(firstCell.content || "")
                : String(firstCell || "");

            if (firstContent.startsWith("SUBTOTAL")) {
              dataCell.cell.styles.fontStyle = "bold";
              dataCell.cell.styles.fillColor = [241, 245, 249];
              dataCell.cell.styles.textColor = [15, 23, 42];
            } else if (firstContent.startsWith("TOTAL GENERAL")) {
              dataCell.cell.styles.fontStyle = "bold";
              dataCell.cell.styles.fillColor = [226, 232, 240];
              dataCell.cell.styles.textColor = [15, 23, 42];
              dataCell.cell.styles.fontSize = 7.5;
            }
          },
          didDrawPage: (hookData) => {
            doc.setFontSize(6.5);
            doc.setTextColor(148, 163, 184);
            doc.text(`Página ${hookData.pageNumber}  |  Ride Lab ERP - Documento Oficial de Reportes`, marginX, 204);
            doc.text("Reporte: Órdenes de Trabajo por Día (Detalle)", pageWidth - marginX, 204, { align: "right" });
          },
        });
      } else {
        // Summary Table
        const sHeaders = [
          "FECHA (DÍA)",
          "CANTIDAD ÓRDENES",
          "SUBTOTAL",
          "DESCUENTOS",
          "IMPUESTOS",
          "TOTAL TALLER DEL DÍA",
        ];

        const sBody: string[][] = [];
        fullSummaries.forEach((s) => {
          sBody.push([
            formatToDDMMYYYY(s.fecha_dia),
            String(s.cantidad_ordenes),
            formatCurrency(s.subtotal),
            formatCurrency(s.descuento),
            formatCurrency(s.impuestos),
            formatCurrency(s.total_orden),
          ]);
        });

        sBody.push([
          "TOTAL GENERAL",
          String(fullKpis.totalOrdenes),
          formatCurrency(fullKpis.totalSubtotal),
          formatCurrency(fullKpis.totalDescuento),
          formatCurrency(fullKpis.totalImpuestos),
          formatCurrency(fullKpis.montoTotalTaller),
        ]);

        autoTable(doc, {
          startY: currentY,
          margin: { left: marginX, right: marginX, bottom: 12 },
          head: [sHeaders],
          body: sBody,
          theme: "plain",
          styles: {
            font: "helvetica",
            fontSize: 7.5,
            cellPadding: 2.2,
            lineColor: [226, 232, 240],
            lineWidth: 0.1,
            textColor: [30, 41, 59],
          },
          headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 7.5,
            halign: "center",
          },
          columnStyles: {
            0: { cellWidth: 40, halign: "center" },
            1: { cellWidth: 35, halign: "center" },
            2: { cellWidth: 45, halign: "right" },
            3: { cellWidth: 45, halign: "right" },
            4: { cellWidth: 45, halign: "right" },
            5: { cellWidth: 50, halign: "right" },
          },
          didParseCell: (dataCell) => {
            const rowRaw = dataCell.row.raw as unknown as string[] | undefined;
            const rowText = String(rowRaw?.[0] || "");
            if (rowText === "TOTAL GENERAL") {
              dataCell.cell.styles.fontStyle = "bold";
              dataCell.cell.styles.fillColor = [226, 232, 240];
              dataCell.cell.styles.textColor = [15, 23, 42];
              dataCell.cell.styles.fontSize = 8;
            }
          },
          didDrawPage: (hookData) => {
            doc.setFontSize(6.5);
            doc.setTextColor(148, 163, 184);
            doc.text(`Página ${hookData.pageNumber}  |  Ride Lab ERP - Documento Oficial de Reportes`, marginX, 204);
            doc.text("Reporte: Órdenes de Trabajo por Día (Resumen Diario)", pageWidth - marginX, 204, { align: "right" });
          },
        });
      }

      doc.save(`reporte_ordenes_${activeTab === "detail" ? "detalle" : "resumen"}_${fechaDesde}_${fechaHasta}.pdf`);
    } catch (err) {
      console.error("Export PDF error:", err);
      alert("Error al exportar a PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const isDefaultRange = fechaDesde === defaultFrom && fechaHasta === defaultTo;
  const hasActiveFilters = Boolean(
    !isDefaultRange ||
    (estadoId && estadoId !== "TODOS") ||
    (tipoServicioId && tipoServicioId !== "TODOS") ||
    search
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <ReportHeader
        title="REPORTE DE ÓRDENES DE TRABAJO POR DÍA"
        subtitle="Consolidado diario de órdenes de taller, servicios contratados, avance técnico y facturación estimada."
        totalRecords={meta.totalRecords}
        canExport={canExport}
        isLoading={loading}
        onRefresh={fetchData}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        isExportingExcel={isExportingExcel}
        isExportingPdf={isExportingPdf}
      />

      {/* KPI Bento Cards */}
      <ReportKpiGrid>
        <ReportKpiCard
          label="TOTAL ÓRDENES"
          value={kpis.totalOrdenes}
          sublabel={`${kpis.ordenesCompletadas} completadas · ${kpis.ordenesActivas} activas`}
          variant="primary"
          icon={<Inbox className="w-4 h-4 text-primary" />}
          isLoading={loading}
        />
        <ReportKpiCard
          label="MONTO TOTAL TALLER"
          value={formatCurrency(kpis.montoTotalTaller)}
          sublabel={`Subtotal: ${formatCurrency(kpis.totalSubtotal)} · Desc: ${formatCurrency(kpis.totalDescuento)}`}
          variant="emerald"
          icon={<Wrench className="w-4 h-4 text-emerald-500" />}
          isLoading={loading}
        />
        <ReportKpiCard
          label="FINALIZADAS / ENTREGADAS"
          value={kpis.ordenesCompletadas}
          sublabel="Listas para entrega o entregadas"
          variant="blue"
          icon={<CheckCircle2 className="w-4 h-4 text-blue-500" />}
          isLoading={loading}
        />
        <ReportKpiCard
          label="ACTIVAS EN TALLER"
          value={kpis.ordenesActivas}
          sublabel="En recepción o trabajo técnico"
          variant="amber"
          icon={<Clock className="w-4 h-4 text-amber-500" />}
          isLoading={loading}
        />
      </ReportKpiGrid>

      {/* Filter Bar */}
      <div className="bg-card border border-border p-3 rounded-xl shadow-sm space-y-2.5 font-mono text-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-foreground-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar código orden, cliente, bicicleta, serie..."
              className="w-full bg-input border border-border rounded-xl py-1.5 pl-9 pr-3 text-xs text-foreground placeholder:text-foreground-muted focus:border-primary outline-none transition-all"
            />
          </div>

          {/* Quick Date Presets & Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center bg-input border border-border rounded-xl p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => handleDatePreset("7D")}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  fechaDesde === defaultFrom && fechaHasta === defaultTo
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground-muted hover:text-foreground"
                }`}
                title="Últimos 7 días"
              >
                7 Días
              </button>
              <button
                type="button"
                onClick={() => handleDatePreset("TODAY")}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  fechaDesde === defaultTo && fechaHasta === defaultTo
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground-muted hover:text-foreground"
                }`}
                title="Hoy"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => handleDatePreset("YESTERDAY")}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold text-foreground-muted hover:text-foreground transition-colors cursor-pointer"
                title="Ayer"
              >
                Ayer
              </button>
              <button
                type="button"
                onClick={() => handleDatePreset("THIS_MONTH")}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold text-foreground-muted hover:text-foreground transition-colors cursor-pointer"
                title="Este Mes"
              >
                Mes
              </button>
            </div>

            {/* Fecha Desde */}
            <div className="flex items-center gap-1.5 bg-input border border-border rounded-xl px-2.5 py-1 text-xs focus-within:border-primary">
              <Calendar className="w-3.5 h-3.5 text-foreground-muted pointer-events-none shrink-0" />
              <span className="text-[10px] font-semibold text-foreground-muted uppercase">Desde:</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(e.target.value);
                  setPage(1);
                }}
                style={{ colorScheme: "dark" }}
                className="bg-transparent text-foreground text-xs focus:outline-none cursor-pointer"
              />
            </div>

            {/* Fecha Hasta */}
            <div className="flex items-center gap-1.5 bg-input border border-border rounded-xl px-2.5 py-1 text-xs focus-within:border-primary">
              <Calendar className="w-3.5 h-3.5 text-foreground-muted pointer-events-none shrink-0" />
              <span className="text-[10px] font-semibold text-foreground-muted uppercase">Hasta:</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(e.target.value);
                  setPage(1);
                }}
                style={{ colorScheme: "dark" }}
                className="bg-transparent text-foreground text-xs focus:outline-none cursor-pointer"
              />
            </div>

            {/* Estado de la Orden */}
            <select
              value={estadoId}
              onChange={(e) => {
                setEstadoId(e.target.value);
                setPage(1);
              }}
              className="bg-input border border-border rounded-xl py-1.5 px-2.5 text-xs text-foreground focus:border-primary outline-none cursor-pointer"
            >
              <option value="TODOS">Todos los Estados</option>
              {filterOptions.orderStatuses.map((st) => (
                <option key={st.estado_orden_id} value={st.estado_orden_id}>
                  {st.nombre}
                </option>
              ))}
            </select>

            {/* Tipo de Servicio SearchableSelect */}
            <div className="min-w-[190px]">
              <SearchableSelect
                options={[
                  { value: "TODOS", label: "Todos los Servicios" },
                  ...filterOptions.serviceTypes.map((svc) => ({
                    value: String(svc.tipo_servicio_id),
                    label: svc.nombre,
                  })),
                ]}
                value={tipoServicioId}
                onChange={(val) => {
                  setTipoServicioId(val);
                  setPage(1);
                }}
                placeholder="Filtrar por Servicio..."
              />
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="p-1.5 text-foreground-muted hover:text-foreground border border-border rounded-xl transition-colors cursor-pointer shrink-0"
                title="Restablecer filtros"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Active Filters Badges */}
        {hasActiveFilters && (
          <div className="pt-2 border-t border-border flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-primary font-bold flex items-center gap-1 mr-1">
              <Tag size={12} /> Filtros:
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/15 border border-primary/30 text-primary font-bold">
              Fecha: {formatToDDMMYYYY(fechaDesde)} a {formatToDDMMYYYY(fechaHasta)}
            </span>
            {estadoId !== "TODOS" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 font-bold">
                Estado: {filterOptions.orderStatuses.find((s) => String(s.estado_orden_id) === estadoId)?.nombre || estadoId}
                <button onClick={() => setEstadoId("TODOS")} className="hover:text-foreground ml-0.5">
                  <X size={10} />
                </button>
              </span>
            )}
            {tipoServicioId !== "TODOS" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 font-bold">
                Servicio: {filterOptions.serviceTypes.find((s) => String(s.tipo_servicio_id) === tipoServicioId)?.nombre || tipoServicioId}
                <button onClick={() => setTipoServicioId("TODOS")} className="hover:text-foreground ml-0.5">
                  <X size={10} />
                </button>
              </span>
            )}
            {search && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface border border-border text-foreground font-bold">
                Búsqueda: &ldquo;{search}&rdquo;
                <button onClick={() => setSearch("")} className="hover:text-foreground ml-0.5">
                  <X size={10} />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={handleClearFilters}
              className="ml-auto text-primary hover:underline font-bold text-[10px] cursor-pointer"
            >
              Limpiar todos
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between gap-3 border-b border-border pb-1 font-mono text-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("detail")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === "detail"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground-secondary hover:text-foreground hover:bg-surface-subtle"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>DETALLE POR DÍA</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("summary")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === "summary"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground-secondary hover:text-foreground hover:bg-surface-subtle"
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5" />
            <span>RESUMEN DIARIO</span>
          </button>
        </div>

        <div className="text-[11px] text-foreground-muted hidden sm:block">
          Mostrando {rows.length} de {meta.totalRecords} órdenes en {daySummaries.length} días
        </div>
      </div>

      {/* Main Content Area */}
      {error ? (
        <div className="p-6 rounded-xl border border-rose-500/30 bg-rose-500/5 text-rose-500 flex items-center gap-3 font-mono text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <div className="font-bold">Error al cargar datos</div>
            <div>{error}</div>
          </div>
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="py-16 text-center font-mono text-xs text-foreground-muted">
          <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <div>Cargando reporte de órdenes de trabajo por día...</div>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center font-mono text-xs text-foreground-muted bg-card border border-border rounded-xl p-8">
          <Wrench className="w-10 h-10 text-foreground-muted/50 mx-auto mb-2" />
          <div className="font-bold text-foreground text-sm">No se encontraron órdenes de trabajo</div>
          <div className="mt-1 max-w-sm mx-auto">
            No existen órdenes registradas en el período seleccionado o con los filtros aplicados.
          </div>
          <button
            type="button"
            onClick={handleClearFilters}
            className="mt-4 px-3 py-1.5 bg-primary/10 border border-primary/30 text-primary rounded-lg font-bold hover:bg-primary/20 transition-all cursor-pointer"
          >
            Restablecer a últimos 7 días
          </button>
        </div>
      ) : activeTab === "detail" ? (
        /* TAB 1: DETALLE POR DÍA (SINGLE BOX RECUADRO) */
        <div className="space-y-4 font-mono text-xs max-w-full">
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[980px]">
                <thead>
                  <tr className="bg-surface/80 border-b border-border text-[10px] text-foreground-muted uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Hora</th>
                    <th className="py-2.5 px-3">Código OT</th>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">Vehículo / Bicicleta</th>
                    <th className="py-2.5 px-3">Servicios Contratados</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3">Mecánico</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                    <th className="py-2.5 px-3 text-right">Descuento</th>
                    <th className="py-2.5 px-3 text-right">Impuestos</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-center">Entrega Real</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {groupedRows.map(({ day, items, summary }) => (
                    <React.Fragment key={day}>
                      {/* Day Divider Row */}
                      <tr className="bg-surface-subtle/90 border-y border-border select-none">
                        <td colSpan={12} className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded-md bg-primary/10 text-primary border border-primary/20">
                              <Calendar className="w-3.5 h-3.5" />
                            </span>
                            <span className="font-bold text-foreground text-xs uppercase tracking-wide">
                              {new Date(`${day}T12:00:00`).toLocaleDateString("es-DO", {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-border/50 text-foreground-muted">
                              {summary.cantidad_ordenes} {summary.cantidad_ordenes === 1 ? "orden" : "órdenes"}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Detail Order Rows */}
                      {items.map((ot) => (
                        <tr key={ot.orden_trabajo_id} className="hover:bg-hover text-foreground transition-colors">
                          <td className="py-2 px-3 text-[11px] text-foreground-muted whitespace-nowrap">
                            {new Date(ot.fecha_registro).toLocaleTimeString("es-DO", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </td>
                          <td className="py-2 px-3 font-bold text-primary whitespace-nowrap">
                            {ot.codigo_orden}
                          </td>
                          <td className="py-2 px-3 font-sans max-w-[170px] truncate" title={ot.cliente_nombre}>
                            <div className="font-semibold text-foreground truncate">{ot.cliente_nombre}</div>
                            {ot.cliente_telefono && (
                              <div className="text-[10px] text-foreground-muted font-mono">{ot.cliente_telefono}</div>
                            )}
                          </td>
                          <td className="py-2 px-3 font-sans max-w-[150px] truncate text-foreground-secondary" title={ot.bicicleta}>
                            <div className="truncate font-medium">{ot.bicicleta}</div>
                            {ot.bicicleta_serie && (
                              <div className="text-[10px] text-foreground-muted font-mono">SN: {ot.bicicleta_serie}</div>
                            )}
                          </td>
                          <td className="py-2 px-3 max-w-[220px] font-sans text-xs text-foreground-muted truncate" title={ot.servicios_contratados || "Sin servicios especificados"}>
                            {ot.servicios_contratados ? (
                              <span className="text-foreground-secondary">{ot.servicios_contratados}</span>
                            ) : (
                              <span className="italic text-foreground-muted">Sin servicios</span>
                            )}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold border"
                              style={{
                                borderColor: ot.estado_color ? `${ot.estado_color}40` : "var(--color-border)",
                                backgroundColor: ot.estado_color ? `${ot.estado_color}18` : "var(--color-surface)",
                                color: ot.estado_color || "var(--text-foreground)",
                              }}
                            >
                              {ot.estado_nombre}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-sans text-xs text-foreground-secondary whitespace-nowrap">
                            {ot.mecanico_nombre}
                          </td>
                          <td className="py-2 px-3 text-right text-foreground-muted">
                            {formatCurrency(ot.subtotal)}
                          </td>
                          <td className="py-2 px-3 text-right text-foreground-muted">
                            {Number(ot.descuento) > 0 ? `-${formatCurrency(ot.descuento)}` : "—"}
                          </td>
                          <td className="py-2 px-3 text-right text-foreground-muted">
                            {formatCurrency(ot.impuestos)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-foreground">
                            {formatCurrency(ot.total_orden)}
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap text-[11px]">
                            {ot.fecha_entrega_real ? (
                              <span className="text-emerald-500 font-semibold">
                                {formatToDDMMYYYY(ot.fecha_entrega_real)}
                              </span>
                            ) : (
                              <span className="text-foreground-muted">Pendiente</span>
                            )}
                          </td>
                        </tr>
                      ))}

                      {/* Day Subtotal Row - NO DATE, SHOWS QUANTITY */}
                      <tr className="bg-surface/70 font-bold border-b-2 border-border/80 text-foreground text-[11px]">
                        <td colSpan={7} className="py-2.5 px-3 uppercase tracking-wider text-primary">
                          Subtotal ({summary.cantidad_ordenes} {summary.cantidad_ordenes === 1 ? "orden" : "órdenes"})
                        </td>
                        <td className="py-2.5 px-3 text-right">{formatCurrency(summary.subtotal)}</td>
                        <td className="py-2.5 px-3 text-right text-foreground-muted">
                          {summary.descuento > 0 ? `-${formatCurrency(summary.descuento)}` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right text-foreground-muted">{formatCurrency(summary.impuestos)}</td>
                        <td className="py-2.5 px-3 text-right text-primary font-extrabold">{formatCurrency(summary.total_orden)}</td>
                        <td className="py-2.5 px-3 text-center text-foreground-muted">—</td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <ReportPagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.totalRecords}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
          />
        </div>
      ) : (
        /* TAB 2: RESUMEN DIARIO */
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm font-mono text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-subtle border-b border-border text-[10px] text-foreground-muted uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Fecha (Día)</th>
                  <th className="py-2.5 px-3 text-center">Cantidad Órdenes</th>
                  <th className="py-2.5 px-3 text-right">Subtotal</th>
                  <th className="py-2.5 px-3 text-right">Descuentos</th>
                  <th className="py-2.5 px-3 text-right">Impuestos</th>
                  <th className="py-2.5 px-3 text-right">Total Taller del Día</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {daySummaries.map((s, idx) => (
                  <tr key={s.fecha_dia} className={idx % 2 === 0 ? "hover:bg-hover" : "bg-surface/30 hover:bg-hover"}>
                    <td className="py-2.5 px-3 font-bold text-foreground">
                      {new Date(`${s.fecha_dia}T12:00:00`).toLocaleDateString("es-DO", {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-primary">{s.cantidad_ordenes}</td>
                    <td className="py-2.5 px-3 text-right">{formatCurrency(s.subtotal)}</td>
                    <td className="py-2.5 px-3 text-right text-foreground-muted">
                      {s.descuento > 0 ? `-${formatCurrency(s.descuento)}` : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right text-foreground-muted">{formatCurrency(s.impuestos)}</td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-foreground">{formatCurrency(s.total_orden)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-subtle font-extrabold border-t-2 border-primary/50 text-foreground text-xs">
                  <td className="py-3 px-3 uppercase text-primary">TOTAL GENERAL</td>
                  <td className="py-3 px-3 text-center text-primary text-sm">{kpis.totalOrdenes}</td>
                  <td className="py-3 px-3 text-right">{formatCurrency(kpis.totalSubtotal)}</td>
                  <td className="py-3 px-3 text-right text-foreground-muted">-{formatCurrency(kpis.totalDescuento)}</td>
                  <td className="py-3 px-3 text-right text-foreground-muted">{formatCurrency(kpis.totalImpuestos)}</td>
                  <td className="py-3 px-3 text-right text-primary text-sm font-extrabold">{formatCurrency(kpis.montoTotalTaller)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
