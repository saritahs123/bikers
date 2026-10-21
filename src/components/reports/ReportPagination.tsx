"use client";

import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface ReportPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newPageSize: number) => void;
  isLoading?: boolean;
}

export function ReportPagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
}: ReportPaginationProps) {
  if (total === 0) return null;

  const startIdx = (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 pb-0.5 border-t border-border font-mono text-[11px] text-foreground-secondary">
      <div className="flex items-center gap-2">
        <span>
          Mostrando <span className="font-bold text-foreground">{startIdx}</span> a{" "}
          <span className="font-bold text-foreground">{endIdx}</span> de{" "}
          <span className="font-bold text-foreground">{total}</span> registros
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-3">
            <span className="hidden md:inline text-[10px]">Filas:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              disabled={isLoading}
              className="bg-surface-subtle border border-border text-foreground text-[11px] rounded-md px-1.5 py-0.5 focus:outline-none focus:border-primary/50 cursor-pointer"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={page <= 1 || isLoading}
          className="p-1 rounded-md border border-border bg-surface-subtle text-foreground hover:bg-hover hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          title="Primera página"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || isLoading}
          className="p-1 rounded-md border border-border bg-surface-subtle text-foreground hover:bg-hover hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          title="Página anterior"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <span className="px-2 py-0.5 text-[11px] font-bold text-foreground bg-surface border border-border rounded-md">
          Pág. {page} / {Math.max(1, totalPages)}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || isLoading}
          className="p-1 rounded-md border border-border bg-surface-subtle text-foreground hover:bg-hover hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          title="Página siguiente"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages || isLoading}
          className="p-1 rounded-md border border-border bg-surface-subtle text-foreground hover:bg-hover hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          title="Última página"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
