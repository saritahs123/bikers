import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { COMPANY_LOGO_BASE64 } from "@/lib/assets/logoBase64";

export interface ReportKpi {
  label: string;
  value: string | number;
  sublabel?: string;
}

export interface ReportFilter {
  label: string;
  value: string;
}

export interface ReportTableColumn {
  header: string;
  key: string;
  width?: number;
  align?: "left" | "center" | "right";
  isCurrency?: boolean;
  isInteger?: boolean;
  isDate?: boolean;
}

export interface AdditionalSheet {
  sheetName: string;
  columns: ReportTableColumn[];
  rows: Record<string, unknown>[];
  totals?: Record<string, string | number>;
}

export interface ReportExportData {
  title: string;
  subtitle: string;
  companyName?: string;
  filename: string;
  filters: ReportFilter[];
  kpis: ReportKpi[];
  columns: ReportTableColumn[];
  rows: Record<string, unknown>[];
  totals?: Record<string, string | number>;
  additionalSheets?: AdditionalSheet[];
}

export const formatCurrency = (val?: number | string | null): string => {
  if (val === null || val === undefined || isNaN(Number(val))) return "RD$ 0.00";
  const num = Number(val);
  return `RD$ ${num.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Formats a date string (YYYY-MM-DD, ISO timestamp, or Date) strictly to dd/mm/yyyy.
 */
export function formatToDDMMYYYY(dateStr?: string | Date | null): string {
  if (!dateStr) return "—";
  try {
    if (typeof dateStr === "string") {
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        return `${match[3]}/${match[2]}/${match[1]}`;
      }
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateStr);
  }
}

/**
 * Returns today's date in YYYY-MM-DD format using the America/Santo_Domingo timezone.
 */
export function getTodaySantoDomingo(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/**
 * Returns a date N days ago in YYYY-MM-DD format using the America/Santo_Domingo timezone.
 */
export function getDaysAgoSantoDomingo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d);
}

/**
 * Returns a human-readable date string in es-DO format using the America/Santo_Domingo timezone.
 */
export function getFormattedTodaySantoDomingo(): string {
  return new Date().toLocaleDateString("es-DO", {
    timeZone: "America/Santo_Domingo",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Generates and triggers browser download of an official Ride Lab styled PDF report.
 */
export async function exportReportToPdf(data: ReportExportData): Promise<void> {
  const isLandscape = data.columns.length > 6;
  const doc = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = isLandscape ? 297 : 210;
  const pageHeight = isLandscape ? 210 : 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  let currentY = 12;

  // Header Colors & Styling
  const brandAccent = [217, 119, 6] as const; // amber accent
  const textMuted = [100, 116, 139] as const;
  const textDark = [15, 23, 42] as const;

  // 1. TOP HEADER / BRANDING
  try {
    if (COMPANY_LOGO_BASE64) {
      doc.addImage(COMPANY_LOGO_BASE64, "PNG", marginX, currentY, 32, 11);
    }
  } catch {
    // Fallback if logo fails
  }

  // Company and Report Title on the Right or Beside Logo
  const headerTextX = marginX + 36;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(data.title.toUpperCase(), headerTextX, currentY + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(data.subtitle, headerTextX, currentY + 9);

  // Metadata block in top right
  const rightMetaX = pageWidth - marginX;
  const genDate = new Date();
  const dateStr = genDate.toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = genDate.toLocaleTimeString("es-DO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(data.companyName || "RIDE LAB", rightMetaX, currentY + 2, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`Generado: ${dateStr} ${timeStr}`, rightMetaX, currentY + 6, { align: "right" });
  doc.text("Sistema de Gestión ERP", rightMetaX, currentY + 10, { align: "right" });

  currentY += 15;

  // Divider line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 4;

  // 2. ACTIVE FILTERS SUMMARY
  if (data.filters && data.filters.length > 0) {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(marginX, currentY, contentWidth, 7, 1.5, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(brandAccent[0], brandAccent[1], brandAccent[2]);
    doc.text("FILTROS APLICADOS:", marginX + 3, currentY + 4.5);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    const filterText = data.filters.map((f) => `${f.label}: ${f.value}`).join("  |  ");
    doc.text(filterText, marginX + 32, currentY + 4.5, {
      maxWidth: contentWidth - 35,
    });

    currentY += 10;
  }

  // 3. KPI CARDS
  if (data.kpis && data.kpis.length > 0) {
    const kpiCount = Math.min(data.kpis.length, 4);
    const cardGap = 3;
    const cardWidth = (contentWidth - (kpiCount - 1) * cardGap) / kpiCount;
    const cardHeight = 15;

    data.kpis.slice(0, 4).forEach((kpi, index) => {
      const cardX = marginX + index * (cardWidth + cardGap);

      // Card Background
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, "FD");

      // Card Accent Left Bar
      doc.setFillColor(brandAccent[0], brandAccent[1], brandAccent[2]);
      doc.rect(cardX, currentY, 1.5, cardHeight, "F");

      // Label
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(kpi.label.toUpperCase(), cardX + 3.5, currentY + 4.5);

      // Value
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      const valStr = typeof kpi.value === "number" ? kpi.value.toLocaleString("es-DO") : String(kpi.value);
      doc.text(valStr, cardX + 3.5, currentY + 9.5);

      // Sublabel
      if (kpi.sublabel) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.text(kpi.sublabel, cardX + 3.5, currentY + 13);
      }
    });

    currentY += cardHeight + 5;
  }

  // 4. DATA TABLE
  const tableHeaders = data.columns.map((c) => c.header.toUpperCase());
  const tableBody = data.rows.map((row) => {
    return data.columns.map((col) => {
      const rawVal = row[col.key];
      if (rawVal === null || rawVal === undefined) return "--";
      if (col.isCurrency) return formatCurrency(rawVal as number | string);
      if (col.isDate && rawVal) {
        const d = new Date(rawVal as string | number | Date);
        return isNaN(d.getTime()) ? String(rawVal) : d.toLocaleDateString("es-DO");
      }
      return String(rawVal);
    });
  });

  // If totals provided, push total row
  if (data.totals) {
    const totalRow = data.columns.map((col, idx) => {
      if (idx === 0) return "TOTAL";
      const totVal = data.totals![col.key];
      if (totVal !== undefined) {
        return col.isCurrency ? formatCurrency(totVal) : String(totVal);
      }
      return "";
    });
    tableBody.push(totalRow);
  }

  // Column styles mapping
  const colStyles: Record<number, { halign: "left" | "center" | "right"; valign: "middle"; cellWidth: number | "auto" }> = {};
  data.columns.forEach((col, idx) => {
    colStyles[idx] = {
      halign: col.align || (col.isCurrency ? "right" : "left"),
      valign: "middle",
      cellWidth: col.width || "auto",
    };
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX, bottom: 15 },
    head: [tableHeaders],
    body: tableBody,
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: isLandscape ? 7 : 7.5,
      cellPadding: 2,
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [24, 28, 36],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: isLandscape ? 7 : 7.5,
      halign: "left",
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: colStyles,
    didParseCell: (hookData) => {
      // Bold totals row
      if (data.totals && hookData.row.index === tableBody.length - 1) {
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.fillColor = [241, 245, 249];
        hookData.cell.styles.textColor = [15, 23, 42];
      }
    },
    didDrawPage: (hookData) => {
      // Footer on every page
      const pageNumber = hookData.pageNumber;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);

      const footerText = `Página ${pageNumber}  |  Ride Lab ERP - Documento Confidencial`;
      doc.text(footerText, marginX, pageHeight - 7);

      const genByText = `Reporte: ${data.title}`;
      doc.text(genByText, pageWidth - marginX, pageHeight - 7, { align: "right" });
    },
  });

  doc.save(`${data.filename}.pdf`);
}

/**
 * Generates and triggers browser download of an official Ride Lab styled Excel (.xlsx) file.
 */
export async function exportReportToExcel(data: ReportExportData): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Ride Lab ERP";
  workbook.lastModifiedBy = "Ride Lab ERP";
  workbook.created = new Date();
  workbook.modified = new Date();

  // Helper to build a standard formatted sheet
  const buildSheet = (
    sheetName: string,
    columns: ReportTableColumn[],
    rows: Record<string, unknown>[],
    totals?: Record<string, string | number>,
    isMainSheet = true
  ) => {
    const ws = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: true }],
    });

    let rowCursor = 1;

    // 1. BANNER TITLE
    ws.mergeCells(rowCursor, 1, rowCursor, columns.length);
    const titleCell = ws.getCell(rowCursor, 1);
    titleCell.value = `RIDE LAB  |  ${data.title.toUpperCase()}`;
    titleCell.font = { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0E1117" }, // Ride Lab dark
    };
    titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(rowCursor).height = 28;
    rowCursor++;

    // Subtitle / Empresa & Date
    ws.mergeCells(rowCursor, 1, rowCursor, columns.length);
    const subCell = ws.getCell(rowCursor, 1);
    const genDateStr = new Date().toLocaleString("es-DO");
    subCell.value = `${data.subtitle}  •  Generado: ${genDateStr}  •  Empresa: ${data.companyName || "Ride Lab"}`;
    subCell.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
    subCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    subCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(rowCursor).height = 18;
    rowCursor++;

    // 2. FILTERS (only on main sheet)
    if (isMainSheet && data.filters && data.filters.length > 0) {
      rowCursor++;
      ws.getCell(rowCursor, 1).value = "FILTROS APLICADOS:";
      ws.getCell(rowCursor, 1).font = { name: "Arial", size: 8.5, bold: true, color: { argb: "FFD97706" } };

      const filterSummary = data.filters.map((f) => `${f.label}: ${f.value}`).join("  |  ");
      ws.mergeCells(rowCursor, 2, rowCursor, Math.max(2, columns.length));
      const fValCell = ws.getCell(rowCursor, 2);
      fValCell.value = filterSummary;
      fValCell.font = { name: "Arial", size: 8.5, color: { argb: "FF334155" } };
      rowCursor++;
    }

    // 3. KPIS (only on main sheet)
    if (isMainSheet && data.kpis && data.kpis.length > 0) {
      rowCursor++;
      const kpiRowStart = rowCursor;
      ws.getRow(kpiRowStart).height = 16;
      ws.getRow(kpiRowStart + 1).height = 20;

      data.kpis.slice(0, Math.min(columns.length, 6)).forEach((kpi, idx) => {
        const colIdx = idx + 1;
        const lblCell = ws.getCell(kpiRowStart, colIdx);
        lblCell.value = kpi.label.toUpperCase();
        lblCell.font = { name: "Arial", size: 7.5, bold: true, color: { argb: "FF64748B" } };
        lblCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        lblCell.border = { top: { style: "thin", color: { argb: "FFE2E8F0" } } };

        const valCell = ws.getCell(kpiRowStart + 1, colIdx);
        valCell.value = typeof kpi.value === "string" ? kpi.value : Number(kpi.value);
        valCell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF0F172A" } };
        valCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        valCell.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
      });
      rowCursor += 2;
    }

    rowCursor++; // Spacing

    // 4. TABLE HEADERS
    const headerRowIndex = rowCursor;
    const headerRow = ws.getRow(headerRowIndex);
    headerRow.height = 24;

    columns.forEach((col, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = col.header.toUpperCase();
      cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E293B" }, // dark slate
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: col.align || (col.isCurrency ? "right" : "left"),
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF475569" } },
        bottom: { style: "medium", color: { argb: "FF0F172A" } },
      };
    });
    rowCursor++;

    // 5. DATA ROWS
    rows.forEach((row, rIdx) => {
      const dataRow = ws.getRow(rowCursor);
      dataRow.height = 18;
      const isEven = rIdx % 2 === 0;

      columns.forEach((col, cIdx) => {
        const cell = dataRow.getCell(cIdx + 1);
        const rawVal = row[col.key];

        if (rawVal === null || rawVal === undefined) {
          cell.value = "--";
        } else if (col.isCurrency) {
          cell.value = Number(rawVal) || 0;
          cell.numFmt = '"RD$"#,##0.00;("RD$"#,##0.00);"-"';
        } else if (col.isInteger) {
          cell.value = Number(rawVal) || 0;
          cell.numFmt = "#,##0";
        } else if (col.isDate && rawVal) {
          const d = new Date(rawVal as string | number | Date);
          cell.value = isNaN(d.getTime()) ? String(rawVal) : d;
          if (!isNaN(d.getTime())) {
            cell.numFmt = "YYYY-MM-DD";
          }
        } else {
          cell.value = String(rawVal);
        }

        cell.font = { name: "Arial", size: 8.5, color: { argb: "FF1E293B" } };
        cell.alignment = {
          vertical: "middle",
          horizontal: col.align || (col.isCurrency ? "right" : "left"),
        };

        if (isEven) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" },
          };
        }

        cell.border = {
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });

      rowCursor++;
    });

    // 6. TOTALS ROW (if provided)
    if (totals) {
      const totRow = ws.getRow(rowCursor);
      totRow.height = 20;

      columns.forEach((col, cIdx) => {
        const cell = totRow.getCell(cIdx + 1);
        if (cIdx === 0) {
          cell.value = "TOTAL GENERAL";
        } else if (totals[col.key] !== undefined) {
          const tVal = totals[col.key];
          if (col.isCurrency) {
            cell.value = Number(tVal) || 0;
            cell.numFmt = '"RD$"#,##0.00;("RD$"#,##0.00);"-"';
          } else if (col.isInteger) {
            cell.value = Number(tVal) || 0;
            cell.numFmt = "#,##0";
          } else {
            cell.value = String(tVal);
          }
        }

        cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF0F172A" } };
        cell.alignment = {
          vertical: "middle",
          horizontal: col.align || (col.isCurrency ? "right" : "left"),
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE2E8F0" },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FF94A3B8" } },
          bottom: { style: "double", color: { argb: "FF0F172A" } },
        };
      });

      rowCursor++;
    }

    // Set autoFilter on table headers
    ws.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: headerRowIndex, column: columns.length },
    };

    // Auto-fit column widths with padding
    columns.forEach((col, idx) => {
      let maxLen = col.header.length + 4;
      rows.forEach((r) => {
        const val = r[col.key];
        if (val) {
          const str = col.isCurrency ? formatCurrency(val as number | string) : String(val);
          if (str.length > maxLen) maxLen = str.length;
        }
      });
      ws.getColumn(idx + 1).width = Math.min(Math.max(maxLen + 2, col.width || 12), 40);
    });
  };

  // Build Primary Worksheet
  buildSheet("Detalle", data.columns, data.rows, data.totals, true);

  // Build Additional Sheets if provided (e.g. Resumen por Suplidor or Resumen por Método)
  if (data.additionalSheets && data.additionalSheets.length > 0) {
    data.additionalSheets.forEach((sheet) => {
      buildSheet(sheet.sheetName, sheet.columns, sheet.rows, sheet.totals, false);
    });
  }

  // Generate buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${data.filename}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
