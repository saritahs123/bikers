"use client";
import React from "react";

/**
 * Converts a 3 or 6 digit hex color code to an rgba string safely.
 * Returns null if the hex code is invalid.
 */
export function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== "string") return null;
  const cleanHex = hex.replace("#", "").trim();
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } else if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return null;
}

/**
 * WorkOrderStatusBadge
 * 
 * Renders a work order status badge using dynamic name and color_estado from PostgreSQL catalog.
 * Does not contain any hardcoded status names or colors.
 * Uses inline styles with safe alpha transparency and Theme Engine neutral fallback.
 */
export default function WorkOrderStatusBadge({
  name,
  color,
  className = "",
  showDot = false,
  size = "normal" // 'small' | 'normal' | 'large'
}) {
  const label = (name && typeof name === "string" && name.trim()) ? name.trim() : "Estado no disponible";
  const isValidHex = color && typeof color === "string" && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color.trim());
  const cleanColor = isValidHex ? color.trim() : null;

  const sizeClasses =
    size === "small"
      ? "px-2 py-0.5 text-[10px]"
      : size === "large"
      ? "px-3 py-1 text-xs"
      : "px-2.5 py-1 text-[11px]";

  if (!cleanColor) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-lg font-mono font-bold uppercase tracking-wider border bg-surface-muted text-foreground-muted border-border select-none ${sizeClasses} ${className}`}
      >
        {showDot && <span className="w-1.5 h-1.5 rounded-full bg-foreground-muted shrink-0" />}
        <span>{label}</span>
      </span>
    );
  }

  const bgRgba = hexToRgba(cleanColor, 0.15) || "transparent";
  const borderRgba = hexToRgba(cleanColor, 0.35) || cleanColor;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg font-mono font-bold uppercase tracking-wider border select-none transition-colors ${sizeClasses} ${className}`}
      style={{
        backgroundColor: bgRgba,
        borderColor: borderRgba,
        color: cleanColor
      }}
    >
      {showDot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0 shadow-sm"
          style={{ backgroundColor: cleanColor }}
        />
      )}
      <span>{label}</span>
    </span>
  );
}
