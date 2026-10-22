"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar,
  Search,
  Receipt,
  CheckCircle2,
  Clock,
  DollarSign,
  Layers,
  CalendarRange,
  Tag,
  X,
  AlertCircle
} from "lucide-react";
import { ReportHeader } from "./ReportHeader";
import { ReportKpiCard, ReportKpiGrid } from "./ReportKpiCard";
import { ReportPagination } from "./ReportPagination";
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

interface DailyInvoicesReportViewProps {
  initialCompany?: string;
  canExport?: boolean;
}

export interface InvoiceDailyDetailRow {
  factura_id: number;
  fecha_dia: string;
  fecha_emision: string;
  numero_factura: string;
  cliente_id: number;
  cliente_nombre: string;
  cliente_identificacion: string | null;
  orden_trabajo_id: number | null;
  codigo_orden: string | null;
  condicion_pago: string;
  estado_factura: string;
  subtotal: number;
  descuento: number;
  impuestos: number;
  total_facturado: number;
  monto_pagado: number;
  saldo_pendiente: number;
  [key: string]: unknown;
}

export interface InvoiceDailyGroupSummary {
  fecha_dia: string;
  cantidad_facturas: number;
  cantidad_activas: number;
  cantidad_anuladas: number;
  subtotal: number;
  descuento: number;
  impuestos: number;
  total_facturado: number;
  monto_pagado: number;
  saldo_pendiente: number;
  facturas?: InvoiceDailyDetailRow[];
}

export function DailyInvoicesReportView({ initialCompany = "Ride Lab", canExport }: DailyInvoicesReportViewProps) {
  const defaultFrom = useMemo(() => getDaysAgoSantoDomingo(6), []);
  const defaultTo = useMemo(() => getTodaySantoDomingo(), []);

  // Filter Form State
  const [fechaDesde, setFechaDesde] = useState(defaultFrom);
  const [fechaHasta, setFechaHasta] = useState(defaultTo);
  const [estado, setEstado] = useState("TODOS");
  const [condicion, setCondicion] = useState("TODOS");
  const [search, setSearch] = useState("");

  // Presentation State
  const [activeTab, setActiveTab] = useState<"detail" | "summary">("detail");

  // Data State
  const [rows, setRows] = useState<InvoiceDailyDetailRow[]>([]);
  const [daySummaries, setDaySummaries] = useState<InvoiceDailyGroupSummary[]>([]);
  const [kpis, setKpis] = useState({
    totalFacturas: 0,
    totalActivas: 0,
    totalAnuladas: 0,
    montoAnulado: 0,
    facturasCobradas: 0,
    facturasPendientes: 0,
    totalSubtotal: 0,
    totalDescuento: 0,
    totalImpuestos: 0,
    totalFacturado: 0,
    totalCobrado: 0,
    totalSaldoPendiente: 0,
  });
  const [meta, setMeta] = useState({ totalRecords: 0, page: 1, limit: 10, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Export State
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Fetch Report Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (fechaDesde) params.set("fechaDesde", fechaDesde);
      if (fechaHasta) params.set("fechaHasta", fechaHasta);
      if (estado !== "TODOS") params.set("estado", estado);
      if (condicion !== "TODOS") params.set("condicion", condicion);
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", String(pageSize));

      const res = await fetch(`/api/reports/invoices-daily?${params.toString()}`);
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
  }, [fechaDesde, fechaHasta, estado, condicion, search, page, pageSize]);

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
    setEstado("TODOS");
    setCondicion("TODOS");
    setSearch("");
    setPage(1);
  };

  // Group paginated detail rows by day for current view
  const groupedRows = useMemo(() => {
    const map = new Map<string, InvoiceDailyDetailRow[]>();
    rows.forEach((r) => {
      const list = map.get(r.fecha_dia) || [];
      list.push(r);
      map.set(r.fecha_dia, list);
    });
    return Array.from(map.entries()).map(([day, items]) => {
      const summary = daySummaries.find((s) => s.fecha_dia === day) || {
        fecha_dia: day,
        cantidad_facturas: items.length,
        cantidad_activas: items.filter((i) => i.estado_factura !== "ANULADA").length,
        cantidad_anuladas: items.filter((i) => i.estado_factura === "ANULADA").length,
        subtotal: items.filter((i) => i.estado_factura !== "ANULADA").reduce((a, b) => a + Number(b.subtotal), 0),
        descuento: items.filter((i) => i.estado_factura !== "ANULADA").reduce((a, b) => a + Number(b.descuento), 0),
        impuestos: items.filter((i) => i.estado_factura !== "ANULADA").reduce((a, b) => a + Number(b.impuestos), 0),
        total_facturado: items.filter((i) => i.estado_factura !== "ANULADA").reduce((a, b) => a + Number(b.total_facturado), 0),
        monto_pagado: items.filter((i) => i.estado_factura !== "ANULADA").reduce((a, b) => a + Number(b.monto_pagado), 0),
        saldo_pendiente: items.filter((i) => i.estado_factura !== "ANULADA").reduce((a, b) => a + Number(b.saldo_pendiente), 0),
      };
      return { day, items, summary };
    });
  }, [rows, daySummaries]);

  // Fetch full dataset for export
  const fetchAllForExport = async () => {
    const params = new URLSearchParams();
    if (fechaDesde) params.set("fechaDesde", fechaDesde);
    if (fechaHasta) params.set("fechaHasta", fechaHasta);
    if (estado !== "TODOS") params.set("estado", estado);
    if (condicion !== "TODOS") params.set("condicion", condicion);
    if (search) params.set("search", search);
    params.set("export", "true");

    const res = await fetch(`/api/reports/invoices-daily?${params.toString()}`);
    if (!res.ok) throw new Error("Error al obtener los datos completos para exportar.");
    const json = await res.json();
    return {
      allRows: (json.data || []) as InvoiceDailyDetailRow[],
      daySummaries: (json.daySummaries || []) as InvoiceDailyGroupSummary[],
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
        // Sheet: Detalle de Facturas
        const wsDetail = workbook.addWorksheet("Detalle de Facturas", { views: [{ showGridLines: true }] });
        wsDetail.mergeCells(1, 1, 1, 13);
        const t1 = wsDetail.getCell(1, 1);
        t1.value = `RIDE LAB  |  REPORTE DETALLADO DE FACTURAS POR DÍA`;
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
        wsDetail.getCell(4, 2).value = `Fecha: ${formatToDDMMYYYY(fechaDesde)} a ${formatToDDMMYYYY(fechaHasta)} | Estado: ${estado} | Condición: ${condicion} | Búsqueda: ${search || "Ninguna"}`;
        wsDetail.getCell(4, 2).font = { name: "Arial", size: 8, color: { argb: "FF334155" } };

        // Detail Table Header
        const headerRowIdx = 6;
        const headers = [
          "FECHA",
          "HORA",
          "NO. FACTURA",
          "CLIENTE",
          "ORDEN TRABAJO",
          "CONDICIÓN",
          "ESTADO",
          "SUBTOTAL",
          "DESCUENTO",
          "IMPUESTOS",
          "TOTAL FACTURADO",
          "MONTO PAGADO",
          "SALDO PENDIENTE",
        ];
        const hRow = wsDetail.getRow(headerRowIdx);
        hRow.height = 22;
        headers.forEach((h, i) => {
          const c = hRow.getCell(i + 1);
          c.value = h;
          c.font = { name: "Arial", size: 8.5, bold: true, color: { argb: "FFFFFFFF" } };
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
          c.alignment = { vertical: "middle", horizontal: i >= 7 ? "right" : i === 0 || i === 1 || i === 5 || i === 6 ? "center" : "left" };
        });

        let rIdx = 7;
        allRows.forEach((row, i) => {
          const r = wsDetail.getRow(rIdx);
          r.height = 18;
          const isAnulada = row.estado_factura === "ANULADA";
          const isEven = i % 2 === 0;

          r.getCell(1).value = formatToDDMMYYYY(row.fecha_dia);
          r.getCell(1).alignment = { horizontal: "center" };
          r.getCell(2).value = new Date(row.fecha_emision).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", hour12: true });
          r.getCell(2).alignment = { horizontal: "center" };
          r.getCell(3).value = row.numero_factura;
          r.getCell(4).value = row.cliente_nombre;
          r.getCell(5).value = row.codigo_orden || "—";
          r.getCell(6).value = row.condicion_pago;
          r.getCell(7).value = row.estado_factura;
          r.getCell(8).value = Number(row.subtotal) || 0;
          r.getCell(9).value = Number(row.descuento) || 0;
          r.getCell(10).value = Number(row.impuestos) || 0;
          r.getCell(11).value = Number(row.total_facturado) || 0;
          r.getCell(12).value = Number(row.monto_pagado) || 0;
          r.getCell(13).value = Number(row.saldo_pendiente) || 0;

          for (let col = 8; col <= 13; col++) {
            r.getCell(col).numFmt = '"RD$"#,##0.00;("RD$"#,##0.00);"-"';
            r.getCell(col).alignment = { horizontal: "right" };
          }

          for (let col = 1; col <= 13; col++) {
            r.getCell(col).font = {
              name: "Arial",
              size: 8,
              color: { argb: isAnulada ? "FF94A3B8" : "FF1E293B" },
              strike: isAnulada,
            };
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
        totRow.getCell(1).value = `TOTAL GENERAL (${fullKpis.totalFacturas} FACTURAS)`;
        totRow.getCell(8).value = fullKpis.totalSubtotal;
        totRow.getCell(9).value = fullKpis.totalDescuento;
        totRow.getCell(10).value = fullKpis.totalImpuestos;
        totRow.getCell(11).value = fullKpis.totalFacturado;
        totRow.getCell(12).value = fullKpis.totalCobrado;
        totRow.getCell(13).value = fullKpis.totalSaldoPendiente;

        for (let col = 8; col <= 13; col++) {
          totRow.getCell(col).numFmt = '"RD$"#,##0.00;("RD$"#,##0.00);"-"';
          totRow.getCell(col).alignment = { horizontal: "right" };
        }
        for (let col = 1; col <= 13; col++) {
          totRow.getCell(col).font = { name: "Arial", size: 8.5, bold: true, color: { argb: "FF0F172A" } };
          totRow.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
          totRow.getCell(col).border = { top: { style: "thin", color: { argb: "FF94A3B8" } }, bottom: { style: "double", color: { argb: "FF0F172A" } } };
        }

        // Auto width
        for (let c = 1; c <= 13; c++) {
          wsDetail.getColumn(c).width = c === 4 ? 24 : c === 1 ? 14 : c === 2 ? 12 : 15;
        }
      } else {
        // Sheet: Resumen Diario
        const wsSummary = workbook.addWorksheet("Resumen Diario", { views: [{ showGridLines: true }] });
        wsSummary.mergeCells(1, 1, 1, 10);
        const t2 = wsSummary.getCell(1, 1);
        t2.value = `RIDE LAB  |  RESUMEN DIARIO DE FACTURAS`;
        t2.font = { name: "Arial", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
        t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E1117" } };
        t2.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        wsSummary.getRow(1).height = 26;

        wsSummary.mergeCells(2, 1, 2, 10);
        const sub2 = wsSummary.getCell(2, 1);
        sub2.value = `Período: ${formatToDDMMYYYY(fechaDesde)} al ${formatToDDMMYYYY(fechaHasta)}  •  Generado: ${new Date().toLocaleString("es-DO")}  •  Empresa: ${initialCompany}`;
        sub2.font = { name: "Arial", size: 8.5, italic: true, color: { argb: "FF64748B" } };
        sub2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        wsSummary.getRow(2).height = 18;

        const sHeaders = [
          "FECHA (DÍA)",
          "FACTURAS TOTAL",
          "ACTIVAS",
          "ANULADAS",
          "SUBTOTAL",
          "DESCUENTOS",
          "TOTAL FACTURADO",
          "TOTAL COBRADO",
          "SALDO PENDIENTE",
          "% COBRO",
        ];
        const shRow = wsSummary.getRow(4);
        shRow.height = 22;
        sHeaders.forEach((h, i) => {
          const c = shRow.getCell(i + 1);
          c.value = h;
          c.font = { name: "Arial", size: 8.5, bold: true, color: { argb: "FFFFFFFF" } };
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
          c.alignment = { vertical: "middle", horizontal: i >= 4 && i <= 8 ? "right" : "center" };
        });

        let srIdx = 5;
        fullSummaries.forEach((s) => {
          const r = wsSummary.getRow(srIdx);
          r.height = 18;
          const pct = s.total_facturado > 0 ? (s.monto_pagado / s.total_facturado) : 1;
          r.getCell(1).value = formatToDDMMYYYY(s.fecha_dia);
          r.getCell(1).alignment = { horizontal: "center" };
          r.getCell(2).value = s.cantidad_facturas;
          r.getCell(3).value = s.cantidad_activas;
          r.getCell(4).value = s.cantidad_anuladas;
          r.getCell(5).value = Number(s.subtotal);
          r.getCell(6).value = Number(s.descuento);
          r.getCell(7).value = Number(s.total_facturado);
          r.getCell(8).value = Number(s.monto_pagado);
          r.getCell(9).value = Number(s.saldo_pendiente);
          r.getCell(10).value = pct;

          for (let col = 5; col <= 9; col++) {
            r.getCell(col).numFmt = '"RD$"#,##0.00;("RD$"#,##0.00);"-"';
            r.getCell(col).alignment = { horizontal: "right" };
          }
          for (let col = 2; col <= 4; col++) {
            r.getCell(col).numFmt = "#,##0";
            r.getCell(col).alignment = { horizontal: "center" };
          }
          r.getCell(10).numFmt = "0.0%";
          r.getCell(10).alignment = { horizontal: "center" };

          for (let col = 1; col <= 10; col++) {
            r.getCell(col).font = { name: "Arial", size: 8 };
            r.getCell(col).border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
          }
          srIdx++;
        });

        // Totals on Summary
        const stRow = wsSummary.getRow(srIdx);
        stRow.height = 20;
        const totalPct = fullKpis.totalFacturado > 0 ? (fullKpis.totalCobrado / fullKpis.totalFacturado) : 1;
        stRow.getCell(1).value = `TOTALES (${fullKpis.totalFacturas} FACTURAS)`;
        stRow.getCell(2).value = fullKpis.totalFacturas;
        stRow.getCell(3).value = fullKpis.totalActivas;
        stRow.getCell(4).value = fullKpis.totalAnuladas;
        stRow.getCell(5).value = fullKpis.totalSubtotal;
        stRow.getCell(6).value = fullKpis.totalDescuento;
        stRow.getCell(7).value = fullKpis.totalFacturado;
        stRow.getCell(8).value = fullKpis.totalCobrado;
        stRow.getCell(9).value = fullKpis.totalSaldoPendiente;
        stRow.getCell(10).value = totalPct;

        for (let col = 5; col <= 9; col++) {
          stRow.getCell(col).numFmt = '"RD$"#,##0.00;("RD$"#,##0.00);"-"';
          stRow.getCell(col).alignment = { horizontal: "right" };
        }
        for (let col = 2; col <= 4; col++) {
          stRow.getCell(col).numFmt = "#,##0";
          stRow.getCell(col).alignment = { horizontal: "center" };
        }
        stRow.getCell(10).numFmt = "0.0%";
        stRow.getCell(10).alignment = { horizontal: "center" };

        for (let col = 1; col <= 10; col++) {
          stRow.getCell(col).font = { name: "Arial", size: 8.5, bold: true, color: { argb: "FF0F172A" } };
          stRow.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
          stRow.getCell(col).border = { top: { style: "thin", color: { argb: "FF94A3B8" } }, bottom: { style: "double", color: { argb: "FF0F172A" } } };
        }

        for (let c = 1; c <= 10; c++) {
          wsSummary.getColumn(c).width = 16;
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte_facturas_${activeTab === "detail" ? "detalle" : "resumen"}_${fechaDesde}_${fechaHasta}.xlsx`;
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
      const marginX = 12;
      let currentY = 12;

      // Header Branding
      try {
        if (COMPANY_LOGO_BASE64) {
          doc.addImage(COMPANY_LOGO_BASE64, "PNG", marginX, currentY, 28, 9.5);
        }
      } catch {
        // fallback
      }

      const reportTitle = activeTab === "detail" ? "REPORTE DETALLADO DE FACTURAS POR DÍA" : "RESUMEN DIARIO DE FACTURAS";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(reportTitle, marginX + 32, currentY + 4);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Período consultado: ${formatToDDMMYYYY(fechaDesde)} al ${formatToDDMMYYYY(fechaHasta)}  |  Empresa: ${initialCompany}`, marginX + 32, currentY + 8.5);

      // Top right meta
      doc.setFontSize(7);
      doc.text(`Generado: ${new Date().toLocaleString("es-DO")}`, pageWidth - marginX, currentY + 4, { align: "right" });
      doc.text(`Total Facturas: ${fullKpis.totalFacturas} (${fullKpis.totalActivas} activas, ${fullKpis.totalAnuladas} anuladas)`, pageWidth - marginX, currentY + 8.5, { align: "right" });

      currentY += 13;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(marginX, currentY, pageWidth - marginX, currentY);
      currentY += 4;

      // KPI Mini Summary Box
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(marginX, currentY, pageWidth - marginX * 2, 9, 1.5, 1.5, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      const kpiLine = `TOTAL FACTURADO: ${formatCurrency(fullKpis.totalFacturado)}    |    TOTAL COBRADO: ${formatCurrency(fullKpis.totalCobrado)}    |    SALDO PENDIENTE: ${formatCurrency(fullKpis.totalSaldoPendiente)}    |    SUBTOTAL: ${formatCurrency(fullKpis.totalSubtotal)}`;
      doc.text(kpiLine, marginX + 4, currentY + 5.5);

      currentY += 12;

      if (activeTab === "detail") {
        // Prepare Table Body with Grouped Day Headers and Subtotals matching the screen exactly
        const tableHeaders = [
          "HORA",
          "NO. FACTURA",
          "CLIENTE",
          "OT",
          "COND.",
          "ESTADO",
          "SUBTOTAL",
          "DESCUENTO",
          "IMPUESTOS",
          "TOTAL",
          "PAGADO",
          "SALDO",
        ];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tableBody: any[] = [];
        const dayGroupsMap = new Map<string, InvoiceDailyDetailRow[]>();
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
              content: `>> ${dayTitle}  (${s.cantidad_facturas} ${s.cantidad_facturas === 1 ? "factura" : "facturas"}${s.cantidad_anuladas > 0 ? ` · ${s.cantidad_anuladas} anuladas` : ""})`,
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

          // Invoices for this day
          dayRows.forEach((inv) => {
            const hora = new Date(inv.fecha_emision).toLocaleTimeString("es-DO", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });
            tableBody.push([
              hora,
              inv.numero_factura,
              inv.cliente_nombre.substring(0, 24),
              inv.codigo_orden || "—",
              inv.condicion_pago === "CONTADO" ? "CONT" : "CRED",
              inv.estado_factura,
              formatCurrency(inv.subtotal),
              Number(inv.descuento) > 0 ? `-${formatCurrency(inv.descuento)}` : "—",
              formatCurrency(inv.impuestos),
              formatCurrency(inv.total_facturado),
              formatCurrency(inv.monto_pagado),
              formatCurrency(inv.saldo_pendiente),
            ]);
          });

          // Day Subtotal Row with colSpan 6
          tableBody.push([
            {
              content: `SUBTOTAL (${s.cantidad_facturas} ${s.cantidad_facturas === 1 ? "FACTURA" : "FACTURAS"})`,
              colSpan: 6,
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
            formatCurrency(s.total_facturado),
            formatCurrency(s.monto_pagado),
            formatCurrency(s.saldo_pendiente),
          ]);
        });

        // Grand Total Row with colSpan 6
        tableBody.push([
          {
            content: `TOTAL GENERAL (${fullKpis.totalFacturas} FACTURAS)`,
            colSpan: 6,
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
          formatCurrency(fullKpis.totalFacturado),
          formatCurrency(fullKpis.totalCobrado),
          formatCurrency(fullKpis.totalSaldoPendiente),
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
            0: { cellWidth: 18, halign: "center" },
            1: { cellWidth: 26, halign: "left" },
            2: { cellWidth: 44, halign: "left" },
            3: { cellWidth: 16, halign: "center" },
            4: { cellWidth: 15, halign: "center" },
            5: { cellWidth: 18, halign: "center" },
            6: { cellWidth: 23, halign: "right" },
            7: { cellWidth: 20, halign: "right" },
            8: { cellWidth: 20, halign: "right" },
            9: { cellWidth: 25, halign: "right" },
            10: { cellWidth: 24, halign: "right" },
            11: { cellWidth: 24, halign: "right" },
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
            } else if (Array.isArray(rowRaw) && rowRaw[5] === "ANULADA" && !dataCell.cell.colSpan) {
              dataCell.cell.styles.textColor = [148, 163, 184];
            }
          },
          didDrawPage: (hookData) => {
            doc.setFontSize(6.5);
            doc.setTextColor(148, 163, 184);
            doc.text(`Página ${hookData.pageNumber}  |  Ride Lab ERP - Documento Oficial de Reportes`, marginX, 204);
            doc.text("Reporte: Facturas por Día (Detalle)", pageWidth - marginX, 204, { align: "right" });
          },
        });
      } else {
        // Summary Table
        const sHeaders = [
          "FECHA (DÍA)",
          "FACTURAS",
          "ACTIVAS",
          "ANULADAS",
          "SUBTOTAL",
          "DESCUENTOS",
          "TOTAL FACTURADO",
          "TOTAL COBRADO",
          "SALDO PENDIENTE",
          "% COBRO",
        ];

        const sBody: string[][] = [];
        fullSummaries.forEach((s) => {
          const pct = s.total_facturado > 0 ? Math.round((s.monto_pagado / s.total_facturado) * 100) : 100;
          sBody.push([
            formatToDDMMYYYY(s.fecha_dia),
            String(s.cantidad_facturas),
            String(s.cantidad_activas),
            String(s.cantidad_anuladas),
            formatCurrency(s.subtotal),
            formatCurrency(s.descuento),
            formatCurrency(s.total_facturado),
            formatCurrency(s.monto_pagado),
            formatCurrency(s.saldo_pendiente),
            `${pct}%`,
          ]);
        });

        const totalPct = fullKpis.totalFacturado > 0 ? Math.round((fullKpis.totalCobrado / fullKpis.totalFacturado) * 100) : 100;
        sBody.push([
          "TOTAL GENERAL",
          String(fullKpis.totalFacturas),
          String(fullKpis.totalActivas),
          String(fullKpis.totalAnuladas),
          formatCurrency(fullKpis.totalSubtotal),
          formatCurrency(fullKpis.totalDescuento),
          formatCurrency(fullKpis.totalFacturado),
          formatCurrency(fullKpis.totalCobrado),
          formatCurrency(fullKpis.totalSaldoPendiente),
          `${totalPct}%`,
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
            0: { cellWidth: 32, halign: "center" },
            1: { cellWidth: 22, halign: "center" },
            2: { cellWidth: 20, halign: "center" },
            3: { cellWidth: 20, halign: "center" },
            4: { cellWidth: 28, halign: "right" },
            5: { cellWidth: 26, halign: "right" },
            6: { cellWidth: 32, halign: "right" },
            7: { cellWidth: 32, halign: "right" },
            8: { cellWidth: 32, halign: "right" },
            9: { cellWidth: 24, halign: "center" },
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
            doc.text("Reporte: Facturas por Día (Resumen Diario)", pageWidth - marginX, 204, { align: "right" });
          },
        });
      }

      doc.save(`reporte_facturas_${activeTab === "detail" ? "detalle" : "resumen"}_${fechaDesde}_${fechaHasta}.pdf`);
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
    (estado && estado !== "TODOS") ||
    (condicion && condicion !== "TODOS") ||
    search
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <ReportHeader
        title="REPORTE DE FACTURAS POR DÍA"
        subtitle="Consolidado diario de emisión de facturas, recaudación efectiva y saldos pendientes."
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
      <ReportKpiGrid cols={4}>
        <ReportKpiCard
          label="TOTAL FACTURADO"
          value={formatCurrency(kpis.totalFacturado)}
          sublabel={`${kpis.totalFacturas} ${kpis.totalFacturas === 1 ? "factura" : "facturas"} · Subtotal: ${formatCurrency(kpis.totalSubtotal)} · Desc: ${formatCurrency(kpis.totalDescuento)}`}
          variant="primary"
          icon={<DollarSign className="w-4 h-4 text-primary" />}
          isLoading={loading}
        />
        <ReportKpiCard
          label="TOTAL COBRADO"
          value={formatCurrency(kpis.totalCobrado)}
          sublabel={`${kpis.facturasCobradas} ${kpis.facturasCobradas === 1 ? "factura cobrada" : "facturas cobradas"}`}
          variant="emerald"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          isLoading={loading}
        />
        <ReportKpiCard
          label="SALDO PENDIENTE"
          value={formatCurrency(kpis.totalSaldoPendiente)}
          sublabel={`${kpis.facturasPendientes} ${kpis.facturasPendientes === 1 ? "factura pendiente" : "facturas pendientes"}`}
          variant="amber"
          icon={<Clock className="w-4 h-4 text-amber-500" />}
          isLoading={loading}
        />
        <ReportKpiCard
          label="FACTURAS ANULADAS"
          value={formatCurrency(kpis.montoAnulado)}
          sublabel={`${kpis.totalAnuladas} ${kpis.totalAnuladas === 1 ? "factura anulada" : "facturas anuladas"}`}
          variant="rose"
          icon={<AlertCircle className="w-4 h-4 text-rose-500" />}
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
              placeholder="Buscar no. factura, cliente, orden..."
              className="w-full bg-input border border-border rounded-xl py-1.5 pl-9 pr-3 text-xs text-foreground placeholder:text-foreground-muted focus:border-primary outline-none transition-all"
            />
          </div>

          {/* Quick Date Presets & Date Pickers */}
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

            {/* Estado Factura */}
            <select
              value={estado}
              onChange={(e) => {
                setEstado(e.target.value);
                setPage(1);
              }}
              className="bg-input border border-border rounded-xl py-1.5 px-2.5 text-xs text-foreground focus:border-primary outline-none cursor-pointer"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="PAGADA">Pagada</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="ANULADA">Anulada</option>
            </select>

            {/* Condición de Pago */}
            <select
              value={condicion}
              onChange={(e) => {
                setCondicion(e.target.value);
                setPage(1);
              }}
              className="bg-input border border-border rounded-xl py-1.5 px-2.5 text-xs text-foreground focus:border-primary outline-none cursor-pointer"
            >
              <option value="TODOS">Todas las Condiciones</option>
              <option value="CONTADO">Al Contado</option>
              <option value="CREDITO">A Crédito</option>
            </select>

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

        {/* Active Filters Summary Bar */}
        {hasActiveFilters && (
          <div className="pt-2 border-t border-border flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-primary font-bold flex items-center gap-1 mr-1">
              <Tag size={12} /> Filtros:
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/15 border border-primary/30 text-primary font-bold">
              Fecha: {formatToDDMMYYYY(fechaDesde)} a {formatToDDMMYYYY(fechaHasta)}
            </span>
            {estado !== "TODOS" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 font-bold">
                Estado: {estado}
                <button onClick={() => setEstado("TODOS")} className="hover:text-foreground ml-0.5">
                  <X size={10} />
                </button>
              </span>
            )}
            {condicion !== "TODOS" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 font-bold">
                Condición: {condicion}
                <button onClick={() => setCondicion("TODOS")} className="hover:text-foreground ml-0.5">
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

      {/* View Switcher Tabs */}
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
          Mostrando {rows.length} de {meta.totalRecords} facturas en {daySummaries.length} días
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
          <div>Cargando reporte de facturas por día...</div>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center font-mono text-xs text-foreground-muted bg-card border border-border rounded-xl p-8">
          <Receipt className="w-10 h-10 text-foreground-muted/50 mx-auto mb-2" />
          <div className="font-bold text-foreground text-sm">No se encontraron facturas</div>
          <div className="mt-1 max-w-sm mx-auto">
            No existen facturas emitidas en el rango de fechas seleccionado o con los filtros aplicados.
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
                    <th className="py-2.5 px-3">No. Factura</th>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">OT</th>
                    <th className="py-2.5 px-3">Condición</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                    <th className="py-2.5 px-3 text-right">Descuento</th>
                    <th className="py-2.5 px-3 text-right">Impuestos</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-right">Pagado</th>
                    <th className="py-2.5 px-3 text-right">Saldo</th>
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
                              {summary.cantidad_facturas} {summary.cantidad_facturas === 1 ? "factura" : "facturas"}
                              {summary.cantidad_anuladas > 0 && ` (${summary.cantidad_anuladas} anuladas)`}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Detail Invoice Rows */}
                      {items.map((inv) => {
                        const isAnulada = inv.estado_factura === "ANULADA";
                        const isPagada = inv.estado_factura === "PAGADA";
                        return (
                          <tr
                            key={inv.factura_id}
                            className={`transition-colors ${
                              isAnulada
                                ? "bg-rose-500/[0.03] text-foreground-muted hover:bg-rose-500/[0.06]"
                                : "hover:bg-hover text-foreground"
                            }`}
                          >
                            <td className="py-2 px-3 text-[11px] text-foreground-muted whitespace-nowrap">
                              {new Date(inv.fecha_emision).toLocaleTimeString("es-DO", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              })}
                            </td>
                            <td className="py-2 px-3 font-bold text-primary whitespace-nowrap">
                              {inv.numero_factura}
                            </td>
                            <td className="py-2 px-3 font-sans font-medium text-xs max-w-[180px] truncate" title={inv.cliente_nombre}>
                              {inv.cliente_nombre}
                            </td>
                            <td className="py-2 px-3 text-foreground-muted whitespace-nowrap">
                              {inv.codigo_orden ? (
                                <span className="text-sky-400 font-semibold">{inv.codigo_orden}</span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  inv.condicion_pago === "CONTADO"
                                    ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                                    : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                }`}
                              >
                                {inv.condicion_pago}
                              </span>
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  isAnulada
                                    ? "bg-rose-500/15 border border-rose-500/30 text-rose-500"
                                    : isPagada
                                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-500"
                                    : "bg-amber-500/15 border border-amber-500/30 text-amber-500"
                                }`}
                              >
                                {inv.estado_factura}
                              </span>
                            </td>
                            <td className={`py-2 px-3 text-right ${isAnulada ? "line-through opacity-60" : ""}`}>
                              {formatCurrency(inv.subtotal)}
                            </td>
                            <td className={`py-2 px-3 text-right text-foreground-muted ${isAnulada ? "line-through opacity-60" : ""}`}>
                              {Number(inv.descuento) > 0 ? `-${formatCurrency(inv.descuento)}` : "—"}
                            </td>
                            <td className={`py-2 px-3 text-right text-foreground-muted ${isAnulada ? "line-through opacity-60" : ""}`}>
                              {formatCurrency(inv.impuestos)}
                            </td>
                            <td className={`py-2 px-3 text-right font-bold ${isAnulada ? "line-through text-rose-400/80" : "text-foreground"}`}>
                              {formatCurrency(inv.total_facturado)}
                            </td>
                            <td className={`py-2 px-3 text-right font-medium ${isAnulada ? "line-through opacity-60" : "text-emerald-500"}`}>
                              {formatCurrency(inv.monto_pagado)}
                            </td>
                            <td className={`py-2 px-3 text-right font-bold ${isAnulada ? "line-through opacity-60" : Number(inv.saldo_pendiente) > 0 ? "text-amber-500" : "text-foreground-muted"}`}>
                              {formatCurrency(inv.saldo_pendiente)}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Day Subtotal Row - NO DATE, SHOWS QUANTITY */}
                      <tr className="bg-surface/70 font-bold border-b-2 border-border/80 text-foreground text-[11px]">
                        <td colSpan={6} className="py-2.5 px-3 uppercase tracking-wider text-primary">
                          Subtotal ({summary.cantidad_facturas} {summary.cantidad_facturas === 1 ? "factura" : "facturas"})
                        </td>
                        <td className="py-2.5 px-3 text-right">{formatCurrency(summary.subtotal)}</td>
                        <td className="py-2.5 px-3 text-right text-foreground-muted">
                          {summary.descuento > 0 ? `-${formatCurrency(summary.descuento)}` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right text-foreground-muted">{formatCurrency(summary.impuestos)}</td>
                        <td className="py-2.5 px-3 text-right text-foreground">{formatCurrency(summary.total_facturado)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-500">{formatCurrency(summary.monto_pagado)}</td>
                        <td className="py-2.5 px-3 text-right text-amber-500">{formatCurrency(summary.saldo_pendiente)}</td>
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
        /* TAB 2: RESUMEN DIARIO (SUMMARY TABLE) */
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm font-mono text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-subtle border-b border-border text-[10px] text-foreground-muted uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Fecha (Día)</th>
                  <th className="py-2.5 px-3 text-center">Facturas</th>
                  <th className="py-2.5 px-3 text-center">Activas</th>
                  <th className="py-2.5 px-3 text-center">Anuladas</th>
                  <th className="py-2.5 px-3 text-right">Subtotal</th>
                  <th className="py-2.5 px-3 text-right">Descuentos</th>
                  <th className="py-2.5 px-3 text-right">Total Facturado</th>
                  <th className="py-2.5 px-3 text-right">Total Cobrado</th>
                  <th className="py-2.5 px-3 text-right">Saldo Pendiente</th>
                  <th className="py-2.5 px-3 text-center">% Cobro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {daySummaries.map((s, idx) => {
                  const pctCobrado = s.total_facturado > 0 ? Math.min(100, Math.round((s.monto_pagado / s.total_facturado) * 100)) : 100;
                  return (
                    <tr key={s.fecha_dia} className={idx % 2 === 0 ? "hover:bg-hover" : "bg-surface/30 hover:bg-hover"}>
                      <td className="py-2.5 px-3 font-bold text-foreground">
                        {new Date(`${s.fecha_dia}T12:00:00`).toLocaleDateString("es-DO", {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">{s.cantidad_facturas}</td>
                      <td className="py-2.5 px-3 text-center text-emerald-500 font-semibold">{s.cantidad_activas}</td>
                      <td className="py-2.5 px-3 text-center text-rose-500 font-semibold">
                        {s.cantidad_anuladas > 0 ? s.cantidad_anuladas : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right">{formatCurrency(s.subtotal)}</td>
                      <td className="py-2.5 px-3 text-right text-foreground-muted">
                        {s.descuento > 0 ? `-${formatCurrency(s.descuento)}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-foreground">{formatCurrency(s.total_facturado)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-500">{formatCurrency(s.monto_pagado)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-500">{formatCurrency(s.saldo_pendiente)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-12 bg-border rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full ${pctCobrado >= 100 ? "bg-emerald-500" : pctCobrado > 50 ? "bg-primary" : "bg-amber-500"}`}
                              style={{ width: `${pctCobrado}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold">{pctCobrado}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-surface-subtle font-extrabold border-t-2 border-primary/50 text-foreground text-xs">
                  <td className="py-3 px-3 uppercase text-primary">TOTAL GENERAL</td>
                  <td className="py-3 px-3 text-center">{kpis.totalFacturas}</td>
                  <td className="py-3 px-3 text-center text-emerald-500">{kpis.totalActivas}</td>
                  <td className="py-3 px-3 text-center text-rose-500">{kpis.totalAnuladas}</td>
                  <td className="py-3 px-3 text-right">{formatCurrency(kpis.totalSubtotal)}</td>
                  <td className="py-3 px-3 text-right text-foreground-muted">-{formatCurrency(kpis.totalDescuento)}</td>
                  <td className="py-3 px-3 text-right text-foreground">{formatCurrency(kpis.totalFacturado)}</td>
                  <td className="py-3 px-3 text-right text-emerald-500">{formatCurrency(kpis.totalCobrado)}</td>
                  <td className="py-3 px-3 text-right text-amber-500">{formatCurrency(kpis.totalSaldoPendiente)}</td>
                  <td className="py-3 px-3 text-center font-bold">
                    {kpis.totalFacturado > 0 ? `${Math.round((kpis.totalCobrado / kpis.totalFacturado) * 100)}%` : "100%"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
