import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY_LOGO_BASE64 } from "@/lib/assets/logoBase64";

interface AutoTableDoc extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

export interface BillingInvoicePrintData {
  factura: {
    factura_id: number;
    codigo_factura: string;
    numero_factura?: string;
    tipo_factura_id: number;
    tipo_factura_codigo: string;
    tipo_factura_nombre: string;
    cliente_id: number | null;
    orden_trabajo_id: number | null;
    fecha_factura: string;
    subtotal: number;
    descuento: number;
    impuesto: number;
    total: number;
    monto_pagado: number;
    balance_pendiente: number;
    estado: string;
    observacion?: string | null;
    fecha_creacion: string;
    usuario_creacion_nombre?: string;
  };
  cliente?: {
    cliente_id?: number;
    nombre_completo?: string;
    identificacion?: string;
    telefono_principal?: string;
    correo?: string;
    direccion?: string;
  } | null;
  orden_trabajo?: {
    orden_trabajo_id?: number;
    codigo_orden?: string;
    estado_codigo?: string;
    estado_nombre?: string;
    color_estado?: string;
    fecha_registro?: string;
    fecha_finalizacion?: string;
    bicicleta?: {
      bicicleta_id?: number;
      marca?: string;
      modelo?: string;
      ano?: string | number;
      color?: string;
      numero_serie_cuadro?: string;
      codigo_qr?: string;
    } | null;
  } | null;
  detalle: Array<{
    detalle_factura_id?: number;
    almacen_nombre?: string;
    tipo_linea: "PRODUCTO" | "SERVICIO" | "REPUESTO" | string;
    codigo: string;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    descuento: number;
    subtotal: number;
    costo_unitario?: number | null;
  }>;
  pagos: Array<{
    pago_id?: number;
    tipo_pago_codigo?: string;
    tipo_pago_nombre?: string;
    monto: number;
    referencia?: string | null;
    observacion?: string | null;
    fecha_pago: string;
    usuario_nombre?: string;
  }>;
  empresa: {
    empresa_id?: number;
    nombre_comercial?: string;
    rnc?: string;
    telefono?: string;
    correo?: string;
    direccion?: string;
    logotipo_url?: string | null;
  };
}

const formatMoney = (val: number | string) => {
  const num = typeof val === "number" ? val : parseFloat(val || "0");
  return `RD$ ${num.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDateShort = (dateStr?: string | null) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
};

const formatDateTime = (dateStr?: string | null) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
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
    return dateStr;
  }
};

/**
 * ============================================================================
 * MODELO 1: FACTURA ESTÁNDAR A4
 * Reutiliza la arquitectura y componentes del modelo A4 de Despacho OT,
 * adaptándose dinámicamente a Venta Directa o Factura de OT.
 * ============================================================================
 */
export function generateInvoiceModel1Pdf(data: BillingInvoicePrintData): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm

  // Palette consistente con Ride Lab
  const primaryGreen = [4, 120, 87]; // #047857
  const brandGreen = [5, 150, 105]; // #059669
  const textDark = [30, 41, 59]; // #1e293b
  const textGray = [100, 116, 139]; // #64748b
  const borderColor = [226, 232, 240]; // #e2e8f0

  let currentY = 14;

  // 1. HEADER SECTION
  try {
    doc.addImage(COMPANY_LOGO_BASE64, "PNG", marginX, currentY - 2, 32, 12.9);
  } catch {
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(data.empresa?.nombre_comercial || "RIDE LAB", marginX, currentY + 4);
  }

  // Datos reales de la empresa (Sección 20)
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let compY = currentY + 19;

  const companyLines = [
    data.empresa?.direccion ? `Dirección: ${data.empresa.direccion}` : null,
    data.empresa?.telefono ? `Teléfono: ${data.empresa.telefono}` : null,
    data.empresa?.correo ? `Correo: ${data.empresa.correo}` : null,
    data.empresa?.rnc ? `RNC: ${data.empresa.rnc}` : null
  ].filter(Boolean) as string[];

  companyLines.forEach((line) => {
    doc.text(line, marginX, compY);
    compY += 4.0;
  });

  // Header derecho: Título FACTURA y Metadata
  doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("FACTURA", pageWidth - marginX, currentY + 6, { align: "right" });

  doc.setFontSize(8.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  let metaY = currentY + 14;

  const rightMeta = [
    { label: "Factura:", val: data.factura.codigo_factura || data.factura.numero_factura || "—" },
    ...(data.factura.orden_trabajo_id && data.orden_trabajo?.codigo_orden
      ? [{ label: "Orden de Trabajo:", val: data.orden_trabajo.codigo_orden }]
      : []),
    { label: "Fecha:", val: formatDateShort(data.factura.fecha_factura) },
    {
      label: "Origen:",
      val: data.factura.orden_trabajo_id ? "ORDEN DE TRABAJO" : "VENTA DIRECTA"
    }
  ];

  rightMeta.forEach((item) => {
    doc.setFont("helvetica", "bold");
    doc.text(item.label, pageWidth - marginX - 52, metaY);
    doc.setFont("helvetica", "normal");
    doc.text(item.val, pageWidth - marginX, metaY, { align: "right" });
    metaY += 4.5;
  });

  // Estado Badge
  const estadoFactura = (data.factura.estado || "PENDIENTE").toUpperCase();
  const badgeWidth = 32;
  const badgeHeight = 6.2;
  const badgeX = pageWidth - marginX - badgeWidth;
  const badgeY = metaY + 1;

  let badgeBg = [236, 253, 245];
  let badgeBorder = brandGreen;
  let badgeText = primaryGreen;

  if (estadoFactura === "ANULADA") {
    badgeBg = [254, 242, 242];
    badgeBorder = [239, 68, 68];
    badgeText = [185, 28, 28];
  } else if (estadoFactura === "PARCIAL" || estadoFactura === "PENDIENTE") {
    badgeBg = [255, 251, 235];
    badgeBorder = [245, 158, 11];
    badgeText = [180, 83, 9];
  }

  doc.setDrawColor(badgeBorder[0], badgeBorder[1], badgeBorder[2]);
  doc.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1.2, 1.2, "FD");

  doc.setTextColor(badgeText[0], badgeText[1], badgeText[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(estadoFactura, badgeX + badgeWidth / 2, badgeY + 4.3, { align: "center" });

  currentY = Math.max(compY, badgeY + badgeHeight) + 5;

  // Banner destacado si la factura está ANULADA
  if (estadoFactura === "ANULADA") {
    doc.setDrawColor(239, 68, 68);
    doc.setFillColor(254, 242, 242);
    doc.setLineWidth(0.5);
    doc.roundedRect(marginX, currentY, contentWidth, 8, 1.5, 1.5, "FD");
    doc.setTextColor(185, 28, 28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("*** FACTURA ANULADA — DOCUMENTO SIN VALOR FISCAL NI COMERCIAL ***", pageWidth / 2, currentY + 5.2, { align: "center" });
    currentY += 12;
  }

  // 2. CLIENT & WORK ORDER / BICYCLE BOXES
  const drawCardBox = (x: number, y: number, width: number, height: number, title: string) => {
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.3);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, width, height, 1.5, 1.5, "FD");

    doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(title, x + 4, y + 5.5);

    doc.setDrawColor(brandGreen[0], brandGreen[1], brandGreen[2]);
    doc.setLineWidth(0.6);
    doc.line(x + 4, y + 7.5, x + width - 4, y + 7.5);
  };

  const hasOT = Boolean(data.factura.orden_trabajo_id && data.orden_trabajo);
  const bike = data.orden_trabajo?.bicicleta;

  if (hasOT && bike) {
    // Si tiene OT y datos de bicicleta: Dos tarjetas paralelas (88mm cada una)
    const colWidth = (contentWidth - 6) / 2;
    const cardHeight = 35;

    // Card 1: FACTURADO A
    drawCardBox(marginX, currentY, colWidth, cardHeight, "FACTURADO A");
    let leftY = currentY + 12;
    const clientFields = [
      { label: "Nombre:", val: data.cliente?.nombre_completo || "Cliente General" },
      { label: "Identificación:", val: data.cliente?.identificacion || "No registrada" },
      { label: "Teléfono:", val: data.cliente?.telefono_principal || "No registrado" },
      { label: "Correo:", val: data.cliente?.correo || "No registrado" },
      { label: "Dirección:", val: data.cliente?.direccion || "No registrada" }
    ];

    clientFields.forEach((f) => {
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(String(f.label), marginX + 4, leftY);

      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.setFont("helvetica", "normal");
      doc.text(String(f.val), marginX + 28, leftY, { maxWidth: colWidth - 32 });
      leftY += 4.5;
    });

    // Card 2: DATOS DE LA ORDEN Y BICICLETA
    const rightX = marginX + colWidth + 6;
    drawCardBox(rightX, currentY, colWidth, cardHeight, "ORDEN DE TRABAJO & BICICLETA");
    let rightCardY = currentY + 12;
    const bikeFields = [
      { label: "Código OT:", val: data.orden_trabajo?.codigo_orden || "—" },
      { label: "Bicicleta:", val: [bike.marca, bike.modelo].filter(Boolean).join(" ") || "Bicicleta" },
      { label: "Año / Color:", val: [bike.ano, bike.color].filter(Boolean).join(" / ") || "—" },
      { label: "N° Serie:", val: bike.numero_serie_cuadro || "No registrado" },
      { label: "Código QR:", val: bike.codigo_qr || "—" }
    ];

    bikeFields.forEach((f) => {
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(String(f.label), rightX + 4, rightCardY);

      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.setFont("helvetica", "normal");
      doc.text(String(f.val), rightX + 28, rightCardY, { maxWidth: colWidth - 32 });
      rightCardY += 4.5;
    });

    currentY += cardHeight + 5;
  } else {
    // VENTA DIRECTA (Sección 18: No mostrar secciones vacías de OT)
    const cardHeight = 28;
    drawCardBox(marginX, currentY, contentWidth, cardHeight, "FACTURADO A (CLIENTE)");

    // Organizar en dos columnas dentro de la misma tarjeta de ancho completo
    const halfWidth = contentWidth / 2;
    let col1Y = currentY + 12;
    let col2Y = currentY + 12;

    const col1 = [
      { label: "Nombre:", val: data.cliente?.nombre_completo || "Cliente General" },
      { label: "Identificación:", val: data.cliente?.identificacion || "No registrada" },
      { label: "Teléfono:", val: data.cliente?.telefono_principal || "No registrado" }
    ];

    const col2 = [
      { label: "Correo:", val: data.cliente?.correo || "No registrado" },
      { label: "Dirección:", val: data.cliente?.direccion || "No registrada" },
      { label: "Origen Factura:", val: "Venta Directa de Productos / Tienda" }
    ];

    col1.forEach((f) => {
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(f.label, marginX + 4, col1Y);

      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.setFont("helvetica", "normal");
      doc.text(f.val, marginX + 32, col1Y, { maxWidth: halfWidth - 36 });
      col1Y += 4.8;
    });

    col2.forEach((f) => {
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(f.label, marginX + halfWidth + 4, col2Y);

      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.setFont("helvetica", "normal");
      doc.text(f.val, marginX + halfWidth + 32, col2Y, { maxWidth: halfWidth - 36 });
      col2Y += 4.8;
    });

    currentY += cardHeight + 5;
  }

  // 3. TABLA DE LÍNEAS / CONCEPTOS (Snapshot histórico, Sección 10)
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(marginX, currentY, contentWidth, 7, 1.2, 1.2, "FD");

  doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("DETALLE DE LA FACTURA", marginX + 4, currentY + 5);

  currentY += 7.5;

  const tableBody = (data.detalle || []).map((item) => {
    const tipo = String(item.tipo_linea || "PRODUCTO").toUpperCase();
    const cantFormatted = Number(item.cantidad || 0).toFixed(2);
    const precioUnit = Number(item.precio_unitario || 0);
    const desc = Number(item.descuento || 0);
    const sub = Number(item.subtotal || 0);

    return [
      item.codigo || "—",
      tipo,
      item.descripcion || "Item",
      cantFormatted,
      formatMoney(precioUnit),
      desc > 0 ? `-${formatMoney(desc)}` : "RD$ 0.00",
      formatMoney(sub)
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX, top: 14, bottom: 18 },
    showHead: "everyPage",
    theme: "plain",
    head: [["CÓDIGO", "TIPO", "DESCRIPCIÓN", "CANT.", "PRECIO", "DESCUENTO", "IMPORTE"]],
    body: tableBody.length > 0 ? tableBody : [["—", "—", "Sin conceptos facturados", "0.00", "RD$ 0.00", "RD$ 0.00", "RD$ 0.00"]],
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: { top: 2.5, bottom: 2.5, left: 2.0, right: 2.0 },
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
      0: { cellWidth: 28, halign: "left", valign: "middle", fontSize: 6.5, overflow: "hidden" },
      1: { cellWidth: 20, halign: "center", valign: "middle", fontStyle: "normal" },
      2: { cellWidth: 55, halign: "left", valign: "middle", overflow: "linebreak" },
      3: { cellWidth: 12, halign: "center", valign: "middle" },
      4: { cellWidth: 22, halign: "right", valign: "middle" },
      5: { cellWidth: 21, halign: "right", valign: "middle" },
      6: { cellWidth: 24, halign: "right", valign: "middle", fontStyle: "bold" }
    }
  });

  const finalTableY = ((doc as unknown as AutoTableDoc).lastAutoTable?.finalY || currentY) + 5;
  currentY = finalTableY;

  // Verificación de salto de página para totales y pagos
  if (currentY > pageHeight - 75) {
    doc.addPage();
    currentY = 16;
  }

  // 4. TOTALES Y PAGOS SECTION
  const colWidth = (contentWidth - 6) / 2;
  const rightX = marginX + colWidth + 6;
  const summaryBoxHeight = 52;

  // Tarjeta Izquierda: HISTORIAL DE PAGOS / OBSERVACIONES
  drawCardBox(marginX, currentY, colWidth, summaryBoxHeight, "PAGOS & OBSERVACIONES");
  let payY = currentY + 11.5;

  if (data.pagos && data.pagos.length > 0) {
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("PAGOS REGISTRADOS:", marginX + 4, payY);
    payY += 3.5;

    data.pagos.slice(0, 4).forEach((p) => {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      const dateText = formatDateShort(p.fecha_pago);
      const metText = p.tipo_pago_nombre || p.tipo_pago_codigo || "Pago";
      const montoText = formatMoney(p.monto);

      doc.text(`• ${dateText} - ${metText}`, marginX + 4, payY, { maxWidth: colWidth - 30 });
      doc.setFont("helvetica", "bold");
      doc.text(montoText, marginX + colWidth - 4, payY, { align: "right" });
      payY += 3.8;
    });

    if (data.pagos.length > 4) {
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont("helvetica", "italic");
      doc.text(`+ ${data.pagos.length - 4} pago(s) adicional(es)`, marginX + 4, payY);
      payY += 3.8;
    }
  } else {
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.text("Sin pagos registrados.", marginX + 4, payY);
    payY += 4.5;
  }

  if (data.factura.observacion) {
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("OBSERVACIÓN:", marginX + 4, Math.max(payY + 2, currentY + 36));

    doc.setFont("helvetica", "normal");
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(data.factura.observacion, marginX + 4, Math.max(payY + 6, currentY + 40), {
      maxWidth: colWidth - 8
    });
  }

  // Tarjeta Derecha: RESUMEN FINANCIERO
  drawCardBox(rightX, currentY, colWidth, summaryBoxHeight, "RESUMEN FINANCIERO");
  let finY = currentY + 12;

  const finLines = [
    { label: "Subtotal", val: formatMoney(data.factura.subtotal) },
    {
      label: "Descuento",
      val: data.factura.descuento > 0 ? `-${formatMoney(data.factura.descuento)}` : "RD$ 0.00"
    }
  ];

  if (data.factura.impuesto > 0) {
    finLines.push({ label: "Impuesto (ITBIS)", val: formatMoney(data.factura.impuesto) });
  }

  finLines.forEach((item) => {
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(item.label, rightX + 4, finY);

    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFont("helvetica", "bold");
    doc.text(item.val, rightX + colWidth - 4, finY, { align: "right" });
    finY += 4.5;
  });

  // Línea divisoria
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.4);
  doc.line(rightX + 4, finY + 0.5, rightX + colWidth - 4, finY + 0.5);

  // TOTAL GENERAL
  finY += 5;
  doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("TOTAL FACTURADO", rightX + 4, finY);

  doc.setFontSize(10.5);
  doc.text(formatMoney(data.factura.total), rightX + colWidth - 4, finY, { align: "right" });

  // Pagado y Balance pendiente
  finY += 5;
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Monto Pagado", rightX + 4, finY);

  doc.setTextColor(brandGreen[0], brandGreen[1], brandGreen[2]);
  doc.setFont("helvetica", "bold");
  doc.text(formatMoney(data.factura.monto_pagado), rightX + colWidth - 4, finY, { align: "right" });

  finY += 4.5;
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFont("helvetica", "normal");
  doc.text("Balance Pendiente", rightX + 4, finY);

  const balancePending = Number(data.factura.balance_pendiente || 0);
  if (balancePending > 0) {
    doc.setTextColor(185, 28, 28);
  } else {
    doc.setTextColor(100, 116, 139);
  }
  doc.setFont("helvetica", "bold");
  doc.text(formatMoney(balancePending), rightX + colWidth - 4, finY, { align: "right" });

  currentY += summaryBoxHeight + 12;

  // 5. SIGNATURE LINES
  const sigLineW = 56;
  const sig1X = marginX + 16;
  const sig2X = pageWidth - marginX - sigLineW - 16;

  doc.setDrawColor(textDark[0], textDark[1], textDark[2]);
  doc.setLineWidth(0.3);
  doc.line(sig1X, currentY, sig1X + sigLineW, currentY);
  doc.line(sig2X, currentY, sig2X + sigLineW, currentY);

  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Facturado por", sig1X + sigLineW / 2, currentY + 4, { align: "center" });
  doc.text("Recibido conforme", sig2X + sigLineW / 2, currentY + 4, { align: "center" });

  // 6. FOOTER EN TODAS LAS PÁGINAS
  const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 12;

    doc.setDrawColor(brandGreen[0], brandGreen[1], brandGreen[2]);
    doc.setLineWidth(0.3);
    doc.line(marginX, footerY - 4, pageWidth - marginX, footerY - 4);

    doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(
      `Gracias por confiar en ${data.empresa.nombre_comercial || "Ride Lab"}`,
      pageWidth / 2,
      footerY,
      { align: "center" }
    );

    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Documento generado electrónicamente", pageWidth / 2, footerY + 3.5, { align: "center" });
    doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, footerY + 6.8, { align: "center" });

    // Marca de agua central ANULADA en todas las páginas
    if (estadoFactura === "ANULADA") {
      doc.setTextColor(254, 202, 202);
      doc.setFontSize(54);
      doc.setFont("helvetica", "bold");
      doc.text("ANULADA", pageWidth / 2, pageHeight / 2, { align: "center", angle: 45 });
    }
  }

  return doc;
}

/**
 * ============================================================================
 * MODELO 2: TICKET POS TÉRMICO (80 mm)
 * Reutiliza la estructura del Ticket POS de Despacho de Orden de Trabajo,
 * adaptándose a Factura Venta Directa o Factura de OT.
 * ============================================================================
 */
export function generateInvoiceModel2Pdf(data: BillingInvoicePrintData): jsPDF {
  // Calculamos la altura dinámica del rollo térmico según cantidad de líneas y pagos
  const lineCount = (data.detalle || []).length;
  const payCount = (data.pagos || []).length;
  const baseHeight = 150;
  const dynamicHeight = Math.max(170, baseHeight + lineCount * 9 + payCount * 6);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, dynamicHeight]
  });

  const pageWidth = 80;
  const marginX = 4;
  const contentWidth = pageWidth - marginX * 2; // 72mm

  let currentY = 6;

  // 1. HEADER - BRAND & EMPRESA
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  const companyName = (data.empresa?.nombre_comercial || "RIDE LAB").toUpperCase();
  doc.text(companyName, pageWidth / 2, currentY, { align: "center" });
  currentY += 4.2;

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("TIENDA Y TALLER DE BICICLETAS", pageWidth / 2, currentY, { align: "center" });
  currentY += 3.8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(60, 60, 60);

  if (data.empresa?.direccion) {
    const dirLines = doc.splitTextToSize(data.empresa.direccion, contentWidth);
    doc.text(dirLines, pageWidth / 2, currentY, { align: "center" });
    currentY += dirLines.length * 3.0;
  }

  const telRnc = [
    data.empresa?.telefono ? `Tel: ${data.empresa.telefono}` : null,
    data.empresa?.rnc ? `RNC: ${data.empresa.rnc}` : null
  ].filter(Boolean).join("  •  ");

  if (telRnc) {
    doc.text(telRnc, pageWidth / 2, currentY, { align: "center" });
    currentY += 3.2;
  }

  // Separador punteado
  const drawDashedLine = (y: number) => {
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(marginX, y, pageWidth - marginX, y);
    doc.setLineDashPattern([], 0); // reset
  };

  currentY += 1;
  drawDashedLine(currentY);
  currentY += 3.5;

  // Marca visible ANULADA en Modelo 2 (Ticket POS)
  if (data.factura.estado.toUpperCase() === "ANULADA") {
    doc.setDrawColor(220, 38, 38);
    doc.setFillColor(254, 242, 242);
    doc.setLineWidth(0.4);
    doc.rect(marginX, currentY, contentWidth, 7, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(220, 38, 38);
    doc.text("*** FACTURA ANULADA ***", pageWidth / 2, currentY + 4.8, { align: "center" });
    currentY += 9;
  }

  // 2. METADATA DE FACTURA & CLIENTE
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`FACTURA: ${data.factura.codigo_factura}`, marginX, currentY);
  currentY += 3.8;

  doc.setFontSize(6.8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);

  if (data.factura.orden_trabajo_id && data.orden_trabajo?.codigo_orden) {
    doc.setFont("helvetica", "bold");
    doc.text(`Orden de Trabajo: ${data.orden_trabajo.codigo_orden}`, marginX, currentY);
    doc.setFont("helvetica", "normal");
    currentY += 3.4;
  }

  doc.text(`Fecha: ${formatDateTime(data.factura.fecha_factura)}`, marginX, currentY);
  doc.text(`Estado: ${data.factura.estado.toUpperCase()}`, pageWidth - marginX, currentY, { align: "right" });
  currentY += 3.4;

  const clienteNombre = data.cliente?.nombre_completo || "Cliente General";
  doc.text(`Cliente: ${clienteNombre}`, marginX, currentY, { maxWidth: contentWidth });
  currentY += 3.4;

  if (data.cliente?.identificacion) {
    doc.text(`RNC / Cédula: ${data.cliente.identificacion}`, marginX, currentY);
    currentY += 3.4;
  }
  if (data.cliente?.telefono_principal) {
    doc.text(`Tel: ${data.cliente.telefono_principal}`, marginX, currentY);
    currentY += 3.4;
  }

  // Si tiene bicicleta asociada en la OT
  const bike = data.orden_trabajo?.bicicleta;
  if (bike && (bike.marca || bike.modelo)) {
    currentY += 1;
    drawDashedLine(currentY);
    currentY += 3.2;

    doc.setFont("helvetica", "bold");
    doc.text("BICICLETA:", marginX, currentY);
    doc.setFont("helvetica", "normal");
    const bikeStr = [bike.marca, bike.modelo, bike.color].filter(Boolean).join(" ");
    doc.text(bikeStr, marginX + 18, currentY, { maxWidth: contentWidth - 18 });
    currentY += 3.4;

    if (bike.numero_serie_cuadro) {
      doc.text(`Serie: ${bike.numero_serie_cuadro}`, marginX, currentY);
      currentY += 3.4;
    }
  }

  currentY += 1;
  drawDashedLine(currentY);
  currentY += 3.5;

  // 3. TABLA DE DETALLE (Ticket POS)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.text("DETALLE DE CONCEPTOS", marginX, currentY);
  currentY += 3;

  const ticketTableBody = (data.detalle || []).map((item) => {
    const cant = Number(item.cantidad || 0).toFixed(2);
    const sub = formatMoney(item.subtotal);
    const desc = item.descripcion || "Item";
    return [desc, cant, sub];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX, top: 2, bottom: 4 },
    theme: "plain",
    head: [["DESCRIPCIÓN", "CANT.", "TOTAL"]],
    body: ticketTableBody.length > 0 ? ticketTableBody : [["Sin conceptos", "0", "RD$ 0.00"]],
    styles: {
      font: "helvetica",
      fontSize: 6.5,
      textColor: [0, 0, 0],
      cellPadding: { top: 1.2, bottom: 1.2, left: 1, right: 1 },
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
      overflow: "linebreak"
    },
    headStyles: {
      fontStyle: "bold",
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontSize: 6.5
    },
    columnStyles: {
      0: { cellWidth: 44, halign: "left" },
      1: { cellWidth: 12, halign: "center" },
      2: { cellWidth: 16, halign: "right", fontStyle: "bold" }
    }
  });

  currentY = ((doc as unknown as AutoTableDoc).lastAutoTable?.finalY || currentY) + 3;

  drawDashedLine(currentY);
  currentY += 3.5;

  // 4. TOTALES
  doc.setFontSize(6.8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);

  const drawRow = (label: string, val: string, isBold = false) => {
    if (isBold) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
    }
    doc.text(label, marginX, currentY);
    doc.text(val, pageWidth - marginX, currentY, { align: "right" });
    currentY += 3.5;
  };

  drawRow("Subtotal:", formatMoney(data.factura.subtotal));
  if (data.factura.descuento > 0) {
    drawRow("Descuento:", `-${formatMoney(data.factura.descuento)}`);
  }
  if (data.factura.impuesto > 0) {
    drawRow("ITBIS (Impuesto):", formatMoney(data.factura.impuesto));
  }

  // TOTAL Box destacado
  currentY += 0.5;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 4.2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text("TOTAL:", marginX, currentY);
  doc.text(formatMoney(data.factura.total), pageWidth - marginX, currentY, { align: "right" });
  currentY += 2.2;

  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 4;

  // Pagado y Pendiente
  doc.setFontSize(7);
  drawRow("Monto Pagado:", formatMoney(data.factura.monto_pagado), true);
  if (Number(data.factura.balance_pendiente) > 0) {
    drawRow("Balance Pendiente:", formatMoney(data.factura.balance_pendiente), true);
  }

  // 5. HISTORIAL DE PAGOS
  if (data.pagos && data.pagos.length > 0) {
    currentY += 1;
    drawDashedLine(currentY);
    currentY += 3.2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(0, 0, 0);
    doc.text("PAGOS APLICADOS:", marginX, currentY);
    currentY += 3.2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    data.pagos.forEach((p) => {
      const met = p.tipo_pago_nombre || "Pago";
      const fecha = formatDateShort(p.fecha_pago);
      doc.text(`${fecha} - ${met}:`, marginX, currentY);
      doc.text(formatMoney(p.monto), pageWidth - marginX, currentY, { align: "right" });
      currentY += 3.0;
    });
  }

  // 6. CIERRE
  currentY += 2;
  drawDashedLine(currentY);
  currentY += 4.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.text(`¡GRACIAS POR SU PREFERENCIA!`, pageWidth / 2, currentY, { align: "center" });
  currentY += 3.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(80, 80, 80);
  doc.text("Documento no válido para crédito fiscal", pageWidth / 2, currentY, { align: "center" });

  return doc;
}

/**
 * Helper para descargar el PDF y abrirlo en una ventana de navegador.
 * Cumple con no modificar datos (Sección 22).
 */
export function downloadInvoicePdf(doc: jsPDF, fileName: string) {
  const cleanName = fileName.replace(/[/\\?%*:|"<>]/g, "-");
  const pdfBlob = doc.output("blob");
  const blobUrl = URL.createObjectURL(pdfBlob);

  // Descarga el PDF
  doc.save(cleanName);

  // Abre preview en pestaña nueva
  if (typeof window !== "undefined") {
    const printWindow = window.open(blobUrl, "_blank");
    if (printWindow) {
      printWindow.focus();
    }
  }
}
