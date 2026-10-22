"use client";

import React from "react";
import { FileSpreadsheet, FileText, RefreshCw, Calendar } from "lucide-react";

import { getFormattedTodaySantoDomingo } from "@/lib/reports/reportExportService";

interface ReportHeaderProps {
  title: string;
  subtitle: string;
  consultationDate?: string;
  canExport?: boolean;
  onRefresh?: () => void;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  isExportingExcel?: boolean;
  isExportingPdf?: boolean;
  isLoading?: boolean;
  totalRecords?: number;
}

export function ReportHeader({
  title,
  subtitle,
  consultationDate,
  canExport = false,
  onRefresh,
  onExportExcel,
  onExportPdf,
  isExportingExcel = false,
  isExportingPdf = false,
  isLoading = false,
  totalRecords,
}: ReportHeaderProps) {
  const currentDate = consultationDate || getFormattedTodaySantoDomingo();

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-3 border-b border-border font-mono">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20">
            MÓDULO REPORTES
          </span>
          <span className="text-foreground-muted text-[11px] flex items-center gap-1">
            <Calendar className="w-3 h-3 text-foreground-muted" />
            <span className="capitalize">{currentDate}</span>
          </span>
        </div>
        <h1 className="text-lg md:text-xl font-bold text-foreground tracking-tight uppercase">
          {title}
        </h1>
        <p className="text-xs text-foreground-secondary mt-0.5">
          {subtitle}
          {totalRecords !== undefined && (
            <span className="ml-2 font-semibold text-primary">
              ({totalRecords} {totalRecords === 1 ? "registro" : "registros"})
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-border bg-surface-subtle text-foreground hover:bg-hover hover:border-primary/40 transition-all cursor-pointer disabled:opacity-50"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
            <span className="hidden sm:inline">ACTUALIZAR</span>
          </button>
        )}

        {Boolean(canExport) === true && onExportExcel && (
          <button
            type="button"
            onClick={onExportExcel}
            disabled={isExportingExcel || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
            title="Exportar archivo Excel (.xlsx)"
          >
            {isExportingExcel ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5" />
            )}
            <span>EXPORTAR EXCEL</span>
          </button>
        )}

        {Boolean(canExport) === true && onExportPdf && (
          <button
            type="button"
            onClick={onExportPdf}
            disabled={isExportingPdf || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 hover:border-rose-500/50 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
            title="Exportar archivo PDF"
          >
            {isExportingPdf ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            <span>EXPORTAR PDF</span>
          </button>
        )}
      </div>
    </div>
  );
}
