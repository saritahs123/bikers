"use client";

import React from "react";

interface ReportKpiCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ReactNode;
  variant?: "primary" | "emerald" | "amber" | "rose" | "blue" | "neutral";
  isLoading?: boolean;
}

export function ReportKpiCard({
  label,
  value,
  sublabel,
  icon,
  variant = "neutral",
  isLoading = false,
}: ReportKpiCardProps) {
  const variantStyles = {
    primary: "border-primary/30 bg-primary/5 text-primary",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-500",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-500",
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-500",
    blue: "border-blue-500/30 bg-blue-500/5 text-blue-500",
    neutral: "border-border bg-surface text-foreground",
  };

  const accentBars = {
    primary: "bg-primary",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    blue: "bg-blue-500",
    neutral: "bg-foreground-muted",
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border py-2.5 px-3 md:px-3.5 flex flex-col justify-between font-mono shadow-sm transition-all hover:shadow-md h-full min-h-[76px] ${variantStyles[variant]}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentBars[variant]}`} />

      <div className="flex items-center justify-between gap-1.5 mb-1 pl-1">
        <span className="text-[10px] font-bold text-foreground-muted tracking-wider uppercase truncate">
          {label}
        </span>
        {icon && (
          <div className="p-1 rounded-md bg-surface-subtle/80 border border-border/50 shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="pl-1">
        {isLoading ? (
          <div className="h-5 w-24 bg-surface-subtle animate-pulse rounded my-0.5" />
        ) : (
          <div className="text-base md:text-lg font-bold tracking-tight text-foreground truncate leading-tight">
            {value}
          </div>
        )}

        {sublabel && (
          <p
            className="text-[12.5px] font-medium text-foreground/85 mt-1.5 leading-snug line-clamp-2"
            title={typeof sublabel === "string" ? sublabel : undefined}
          >
            {sublabel}
          </p>
        )}
      </div>
    </div>
  );
}

export function ReportKpiGrid({
  children,
  cols = 4,
  className = "",
}: {
  children: React.ReactNode;
  cols?: 4 | 5;
  className?: string;
}) {
  const defaultCols =
    cols === 5
      ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
      : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  return (
    <div className={`grid ${defaultCols} gap-2.5 my-0 items-stretch ${className}`}>
      {children}
    </div>
  );
}
