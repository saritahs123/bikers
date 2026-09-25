import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY_LOGO_BASE64 } from "@/lib/assets/logoBase64";

export interface CustomerStatementPdfData {
  empresa: {
    nombre_comercial?: string;
    subtitulo?: string;
    direccion?: string;
    telefono?: string;
    email?: string;
    rnc?: string;
    logotipo_url?: string | null;
  };
  cliente: {
    cliente_id?: number | string;
    codigo_cliente?: string;
    nombre_completo: string;
    identificacion?: string | null;
    telefono?: string | null;
    correo?: string | null;
    direccion?: string | null;
  };
  fecha_generacion?: string | Date;
  resumen: {
    totalFacturado: number;
    totalPagado: number;
    saldoPendiente: number;
    facturasPendientes: number;
  };
  facturas: Array<{
    factura_id: number;
    codigo_factura: string;
    fecha_factura: string | Date;
    condicion_venta: string;
    total: number;
    monto_pagado: number;
    saldo: number;
    estado: string;
    orden_trabajo_id?: number | null;
    codigo_orden?: string | null;
  }>;
}

const formatMoney = (val: number | string | null | undefined): string => {
  const num = typeof val === "number" ? val : parseFloat(String(val || "0"));
  const safeNum = isNaN(num) ? 0 : num;
  return `RD$ ${safeNum.toLocaleString("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

const formatDateOnly = (dateVal?: string | Date | null): string => {
  if (!dateVal) return "—";
  try {
    const d = typeof dateVal === "string" ? new Date(dateVal) : dateVal;
    if (isNaN(d.getTime())) return String(dateVal).substring(0, 10);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateVal).substring(0, 10);
  }
};

const formatDateTime = (dateVal?: string | Date | null): string => {
  const d = dateVal ? (typeof dateVal === "string" ? new Date(dateVal) : dateVal) : new Date();
  try {
    if (isNaN(d.getTime())) return formatDateOnly(dateVal);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return formatDateOnly(dateVal);
  }
};

export function generateCustomerStatementPdfDocument(data: CustomerStatementPdfData): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm

  // Professional Ride Lab Theme Palette
  const primaryGreen = [4, 120, 87]; // #047857
  const brandGreen = [5, 150, 105]; // #059669
  const textDark = [30, 41, 59]; // #1e293b
  const textGray = [100, 116, 139]; // #64748b
  const borderColor = [226, 232, 240]; // #e2e8f0
  const lightBg = [248, 250, 252]; // #f8fafc
  const roseColor = [225, 29, 72]; // #e11d48

  let currentY = 14;

  // ==========================================
  // 1. HEADER SECTION
  // ==========================================

  // 1.1 Company Logo on Top-Left
  try {
    doc.addImage(COMPANY_LOGO_BASE64, "PNG", marginX, currentY - 2, 32, 12.9);
  } catch {
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(data.empresa?.nombre_comercial || "RIDE LAB", marginX, currentY + 4);
  }

  // 1.2 Company Contact Info Lines Below Logo
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  let compY = currentY + 18;

  const companyLines = [
    data.empresa?.direccion ? `Dirección: ${data.empresa.direccion}` : null,
    data.empresa?.telefono ? `Teléfono: ${data.empresa.telefono}` : null,
    data.empresa?.email ? `Correo: ${data.empresa.email}` : null,
    data.empresa?.rnc ? `RNC: ${data.empresa.rnc}` : null
  ].filter(Boolean) as string[];

  companyLines.forEach((line) => {
    doc.text(line, marginX, compY);
    compY += 3.8;
  });

  // 1.3 Right Header: Title, Subtitle, Emission Date & Status Badge
  doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("ESTADO DE CUENTA", pageWidth - marginX, currentY + 5, { align: "right" });

  doc.setFontSize(8);
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMEN FINANCIERO DE CLIENTE", pageWidth - marginX, currentY + 10, { align: "right" });

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(`Emisión: ${formatDateTime(data.fecha_generacion)}`, pageWidth - marginX, currentY + 14.5, { align: "right" });

  // Status Badge (AL DÍA vs SALDO PENDIENTE)
  const isAlDia = Number(data.resumen?.saldoPendiente || 0) <= 0.009;
  const badgeWidth = 36;
  const badgeHeight = 6.5;
  const badgeX = pageWidth - marginX - badgeWidth;
  const badgeY = currentY + 17;

  if (isAlDia) {
    doc.setDrawColor(brandGreen[0], brandGreen[1], brandGreen[2]);
    doc.setFillColor(236, 253, 245); // #ecfdf5
    doc.setLineWidth(0.3);
    doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1.2, 1.2, "FD");

    doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("✓ CLIENTE AL DÍA", badgeX + badgeWidth / 2, badgeY + 4.5, { align: "center" });
  } else {
    doc.setDrawColor(roseColor[0], roseColor[1], roseColor[2]);
    doc.setFillColor(255, 241, 242); // #fff1f2
    doc.setLineWidth(0.3);
    doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1.2, 1.2, "FD");

    doc.setTextColor(roseColor[0], roseColor[1], roseColor[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("SALDO PENDIENTE", badgeX + badgeWidth / 2, badgeY + 4.5, { align: "center" });
  }

  currentY = Math.max(compY, badgeY + badgeHeight) + 4;

  // ==========================================
  // 2. CLIENT INFORMATION BOX
  // ==========================================
  const clientCardH = 26;
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(marginX, currentY, contentWidth, clientCardH, 1.5, 1.5, "FD");

  // Title line inside card
  doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DATOS DEL CLIENTE", marginX + 4, currentY + 5);

  doc.setDrawColor(brandGreen[0], brandGreen[1], brandGreen[2]);
  doc.setLineWidth(0.5);
  doc.line(marginX + 4, currentY + 6.8, marginX + contentWidth - 4, currentY + 6.8);

  const col1X = marginX + 4;
  const col2X = marginX + contentWidth / 2 + 4;
  const clientRowY = currentY + 11.5;

  const codigoCliente = data.cliente?.codigo_cliente || `BF-CL-${data.cliente?.cliente_id || "—"}`;
  const nombreCliente = data.cliente?.nombre_completo || "Cliente no especificado";
  const identificacion = data.cliente?.identificacion && data.cliente.identificacion.trim() !== "" ? data.cliente.identificacion.trim() : "No registrada";
  const telefono = data.cliente?.telefono && data.cliente.telefono.trim() !== "" ? data.cliente.telefono.trim() : "No registrado";
  const correo = data.cliente?.correo && data.cliente.correo.trim() !== "" ? data.cliente.correo.trim() : "No registrado";
  const direccion = data.cliente?.direccion && data.cliente.direccion.trim() !== "" ? data.cliente.direccion.trim() : null;

  // Column 1
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.text("Cliente:", col1X, clientRowY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(nombreCliente, col1X + 22, clientRowY, { maxWidth: 64 });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.text("Código:", col1X, clientRowY + 4.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(codigoCliente, col1X + 22, clientRowY + 4.5);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.text("Identificación:", col1X, clientRowY + 9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(identificacion, col1X + 22, clientRowY + 9);

  // Column 2
  doc.setFont("helvetica", "bold");
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.text("Teléfono:", col2X, clientRowY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(telefono, col2X + 20, clientRowY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.text("Correo:", col2X, clientRowY + 4.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(correo, col2X + 20, clientRowY + 4.5, { maxWidth: 66 });

  if (direccion) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.text("Dirección:", col2X, clientRowY + 9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(direccion, col2X + 20, clientRowY + 9, { maxWidth: 66 });
  }

  currentY += clientCardH + 4;

  // ==========================================
  // 3. FINANCIAL SUMMARY (4 KPI BOXES)
  // ==========================================
  const kpiGap = 3;
  const kpiWidth = (contentWidth - kpiGap * 3) / 4; // ~43.25mm
  const kpiHeight = 16;

  const kpis = [
    {
      title: "SALDO PENDIENTE",
      value: formatMoney(data.resumen?.saldoPendiente),
      isRose: !isAlDia,
      isGreen: isAlDia
    },
    {
      title: "TOTAL FACTURADO",
      value: formatMoney(data.resumen?.totalFacturado),
      isRose: false,
      isGreen: false
    },
    {
      title: "TOTAL PAGADO",
      value: formatMoney(data.resumen?.totalPagado),
      isRose: false,
      isGreen: true
    },
    {
      title: "FACTURAS PENDIENTES",
      value: String(data.resumen?.facturasPendientes || 0),
      isRose: false,
      isGreen: false
    }
  ];

  kpis.forEach((kpi, idx) => {
    const kpiX = marginX + idx * (kpiWidth + kpiGap);

    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.3);
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.roundedRect(kpiX, currentY, kpiWidth, kpiHeight, 1.2, 1.2, "FD");

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.text(kpi.title, kpiX + 3.5, currentY + 5);

    // Value
    doc.setFontSize(9);
    if (kpi.isRose) {
      doc.setTextColor(roseColor[0], roseColor[1], roseColor[2]);
    } else if (kpi.isGreen) {
      doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
    } else {
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    }
    doc.text(kpi.value, kpiX + 3.5, currentY + 11.5);
  });

  currentY += kpiHeight + 5;

  // ==========================================
  // 4. DETALLE DE FACTURAS (TABLE)
  // ==========================================

  // Table Title Frame
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(marginX, currentY, contentWidth, 7, 1.2, 1.2, "FD");

  doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DETALLE DE FACTURAS", marginX + 4, currentY + 4.8);

  currentY += 7.5;

  const tableRows = (data.facturas || []).map((f) => {
    const isAnulada = String(f.estado || "").toUpperCase() === "ANULADA";
    const otText = f.codigo_orden ? ` (${f.codigo_orden})` : "";
    const facturaText = `${f.codigo_factura || `FAC-${f.factura_id}`}${otText}`;
    const fechaText = formatDateOnly(f.fecha_factura);
    const condicionText = String(f.condicion_venta || "CONTADO").toUpperCase();
    const totalText = formatMoney(f.total);
    const pagadoText = formatMoney(f.monto_pagado);
    const saldoText = isAnulada ? "RD$ 0.00" : formatMoney(f.saldo);
    const estadoText = String(f.estado || "PENDIENTE").toUpperCase();

    return [
      facturaText,
      fechaText,
      condicionText,
      totalText,
      pagadoText,
      saldoText,
      estadoText
    ];
  });

  // 182mm available:
  // FACTURA: 36mm
  // FECHA: 24mm
  // CONDICIÓN: 22mm
  // TOTAL: 25mm
  // PAGADO: 25mm
  // SALDO: 26mm
  // ESTADO: 24mm
  // Total = 36 + 24 + 22 + 25 + 25 + 26 + 24 = 182mm
  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX, top: 14, bottom: 18 },
    showHead: "everyPage",
    theme: "plain",
    head: [["FACTURA", "FECHA", "CONDICIÓN", "TOTAL", "PAGADO", "SALDO", "ESTADO"]],
    body: tableRows,
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: { top: 2.4, bottom: 2.4, left: 2.0, right: 2.0 },
      lineWidth: 0.15,
      lineColor: [226, 232, 240],
      valign: "middle",
      overflow: "linebreak"
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [51, 65, 85],
      fontStyle: "bold",
      fontSize: 7.5,
      lineWidth: 0.2,
      lineColor: [226, 232, 240],
      valign: "middle"
    },
    columnStyles: {
      0: { cellWidth: 36, halign: "left", fontStyle: "bold", overflow: "hidden" },
      1: { cellWidth: 24, halign: "center" },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 25, halign: "right" },
      4: { cellWidth: 25, halign: "right" },
      5: { cellWidth: 26, halign: "right", fontStyle: "bold" },
      6: { cellWidth: 24, halign: "center", fontStyle: "bold" }
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 6) {
        const estadoVal = String(hookData.cell.raw || "").toUpperCase();
        if (estadoVal === "PAGADA") {
          hookData.cell.styles.textColor = [4, 120, 87]; // Green
        } else if (estadoVal === "PENDIENTE") {
          hookData.cell.styles.textColor = [217, 119, 6]; // Amber
        } else if (estadoVal === "PARCIAL") {
          hookData.cell.styles.textColor = [2, 132, 199]; // Blue
        } else if (estadoVal === "ANULADA") {
          hookData.cell.styles.textColor = [156, 163, 175]; // Muted gray
        }
      }
    }
  });

  const finalTableY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  currentY = finalTableY;

  // Check if page overflow requires new page for total summary
  if (currentY > pageHeight - 35) {
    doc.addPage();
    currentY = 16;
  }

  // ==========================================
  // 5. TOTAL FINAL & AL DÍA HIGHLIGHT
  // ==========================================
  if (isAlDia) {
    // Al Día banner
    doc.setDrawColor(brandGreen[0], brandGreen[1], brandGreen[2]);
    doc.setFillColor(236, 253, 245);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, currentY, contentWidth, 14, 1.5, 1.5, "FD");

    doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("✓ CLIENTE AL DÍA", marginX + 6, currentY + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.text("Este cliente no posee facturas pendientes de pago en el taller.", marginX + 6, currentY + 10.5);

    // Right side: Saldo 0.00
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
    doc.text("SALDO PENDIENTE: RD$ 0.00", pageWidth - marginX - 6, currentY + 8.5, { align: "right" });
  } else {
    // Outstanding balance highlight card
    const totalBoxW = 76;
    const totalBoxX = pageWidth - marginX - totalBoxW;
    const totalBoxH = 16;

    doc.setDrawColor(roseColor[0], roseColor[1], roseColor[2]);
    doc.setFillColor(255, 241, 242);
    doc.setLineWidth(0.4);
    doc.roundedRect(totalBoxX, currentY, totalBoxW, totalBoxH, 1.5, 1.5, "FD");

    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("SALDO TOTAL PENDIENTE", totalBoxX + 4, currentY + 5.5);

    doc.setTextColor(roseColor[0], roseColor[1], roseColor[2]);
    doc.setFontSize(11);
    doc.text(formatMoney(data.resumen?.saldoPendiente), totalBoxX + totalBoxW - 4, currentY + 11.5, { align: "right" });
  }

  // ==========================================
  // 6. FOOTER ACROSS ALL PAGES
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 10;

    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.3);
    doc.line(marginX, footerY - 3, pageWidth - marginX, footerY - 3);

    doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(data.empresa?.nombre_comercial || "Ride Lab", marginX, footerY + 1);

    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Estado de Cuenta de Cliente", marginX + 32, footerY + 1);

    doc.text(`Página ${i} de ${totalPages}`, pageWidth - marginX, footerY + 1, { align: "right" });
  }

  return doc;
}
