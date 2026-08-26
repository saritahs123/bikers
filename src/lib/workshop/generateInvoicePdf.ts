import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface InvoicePdfData {
  empresa: {
    nombre_comercial: string;
    subtitulo?: string;
    direccion?: string;
    telefono?: string;
    email?: string;
    rnc?: string;
    logotipo_url?: string | null;
  };
  factura: {
    numero_factura: string;
    codigo_orden: string;
    codigo_recepcion: string;
    fecha_factura: string;
    estado: string;
  };
  cliente: {
    nombre_completo: string;
    identificacion?: string;
    telefono?: string;
    correo?: string;
    direccion?: string;
  };
  bicicleta: {
    marca_modelo: string;
    ano_color: string;
    numero_serie: string;
    codigo_qr: string;
  };
  servicio_info: {
    mecanico_responsable: string;
    mecanico_cargo?: string | null;
    fecha_inicio?: string | null;
    fecha_finalizacion?: string | null;
    tiempo_trabajo_segundos?: number;
  };
  pago_entrega: {
    estado_pago: string;
    fecha_entrega?: string | null;
    entregado_por: string;
  };
  observaciones?: string;
  conceptos: Array<{
    item_id: number | string;
    tipo_concepto: "SERVICIO" | "REPUESTO";
    codigo: string;
    descripcion: string;
    notas?: string;
    cantidad: string | number;
    precio_unitario: number;
    descuento: number;
    subtotal: number;
  }>;
  resumen_financiero: {
    subtotal_servicios: number;
    subtotal_repuestos: number;
    descuento_total: number;
    impuesto: number;
    total_general: number;
    monto_pagado: number;
    balance_pendiente: number;
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
  if (!dateStr) return "No registrada";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("es-DO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return dateStr;
  }
};

const formatDuration = (totalSeconds?: number) => {
  const secs = Number(totalSeconds || 0);
  if (secs <= 0) return "0 min";
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const remainingSeconds = secs % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  }
  if (minutes > 0) {
    return remainingSeconds > 0 ? `${minutes} min ${remainingSeconds} s` : `${minutes} min`;
  }
  return `${remainingSeconds} s`;
};

export function generateInvoicePdfDocument(data: InvoicePdfData): jsPDF {
  // Setup A4 portrait document
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm

  // Colors
  const primaryGreen = [4, 120, 87]; // #047857
  const brandGreen = [5, 150, 105]; // #059669
  const textDark = [30, 41, 59]; // #1e293b
  const textGray = [100, 116, 139]; // #64748b
  const borderColor = [226, 232, 240]; // #e2e8f0
  const lightBg = [248, 250, 252]; // #f8fafc

  let currentY = 14;

  // ==========================================
  // 1. HEADER SECTION
  // ==========================================

  // Draw Logo Vector (Bicycle Shape)
  doc.setDrawColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  doc.setLineWidth(0.8);
  doc.circle(marginX + 4, currentY + 7, 3.5); // Rear wheel
  doc.circle(marginX + 16, currentY + 7, 3.5); // Front wheel
  doc.line(marginX + 4, currentY + 7, marginX + 10, currentY + 7); // Chainstay
  doc.line(marginX + 4, currentY + 7, marginX + 8, currentY + 3); // Seatstay
  doc.line(marginX + 10, currentY + 7, marginX + 8, currentY + 3); // Seat tube
  doc.line(marginX + 10, currentY + 7, marginX + 14, currentY + 3.5); // Down tube
  doc.line(marginX + 8, currentY + 3, marginX + 14, currentY + 3.5); // Top tube
  doc.line(marginX + 16, currentY + 7, marginX + 14, currentY + 3.5); // Fork
  doc.line(marginX + 14, currentY + 3.5, marginX + 14.5, currentY + 1.5); // Handlebar stem
  doc.line(marginX + 13.5, currentY + 1.5, marginX + 15.5, currentY + 1.5); // Handlebar

  // Company Brand Titles
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(data.empresa.nombre_comercial || "BIKERS' FORT CORE", marginX + 22, currentY + 4);

  doc.setTextColor(brandGreen[0], brandGreen[1], brandGreen[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(data.empresa.subtitulo || "Tienda y Taller de Bicicletas", marginX + 22, currentY + 8.5);

  // Company Info Lines - Clean labels without emojis/Unicode icons
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFontSize(8);
  let compY = currentY + 14;

  const companyLines = [
    data.empresa?.direccion ? `Dirección: ${data.empresa.direccion}` : null,
    data.empresa?.telefono ? `Teléfono: ${data.empresa.telefono}` : null,
    (data.empresa?.email || (data.empresa as any)?.correo) ? `Correo: ${data.empresa.email || (data.empresa as any)?.correo}` : null,
    data.empresa?.rnc ? `RNC: ${data.empresa.rnc}` : null
  ].filter(Boolean) as string[];

  companyLines.forEach((line) => {
    doc.text(line, marginX, compY);
    compY += 4.2;
  });

  // Right Header: FACTURA title & Metadata (Without artificial invoice number)
  doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("FACTURA", pageWidth - marginX, currentY + 6, { align: "right" });

  doc.setFontSize(8.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  let metaY = currentY + 14;

  const rightMeta = [
    { label: "Orden:", val: data.factura.codigo_orden },
    { label: "Recepción:", val: data.factura.codigo_recepcion },
    { label: "Fecha:", val: formatDateShort(data.factura.fecha_factura) }
  ];

  rightMeta.forEach((item) => {
    doc.setFont("helvetica", "bold");
    doc.text(item.label, pageWidth - marginX - 42, metaY);
    doc.setFont("helvetica", "normal");
    doc.text(item.val, pageWidth - marginX, metaY, { align: "right" });
    metaY += 4.5;
  });

  // PAGADA Badge
  const badgeWidth = 28;
  const badgeHeight = 6;
  const badgeX = pageWidth - marginX - badgeWidth;
  const badgeY = metaY + 1;

  doc.setDrawColor(brandGreen[0], brandGreen[1], brandGreen[2]);
  doc.setFillColor(236, 253, 245); // #ecfdf5
  doc.setLineWidth(0.3);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1.2, 1.2, "FD");

  doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("PAGADA", badgeX + badgeWidth / 2, badgeY + 4.2, { align: "center" });

  currentY = Math.max(compY, badgeY + badgeHeight) + 5;

  // ==========================================
  // 2. CLIENT & BICYCLE BOXES (Side-by-side)
  // ==========================================
  const colWidth = (contentWidth - 6) / 2; // 88mm
  const cardHeight = 35;

  // Helper to draw a framed card with a top green title line
  const drawCardBox = (x: number, y: number, width: number, height: number, title: string) => {
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.3);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, width, height, 1.5, 1.5, "FD");

    // Green title text & bottom accent bar
    doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(title, x + 4, y + 5.5);

    doc.setDrawColor(brandGreen[0], brandGreen[1], brandGreen[2]);
    doc.setLineWidth(0.6);
    doc.line(x + 4, y + 7.5, x + width - 4, y + 7.5);
  };

  // Card 1: FACTURADO A
  drawCardBox(marginX, currentY, colWidth, cardHeight, "FACTURADO A");
  let leftY = currentY + 12;
  const clientFields = [
    { label: "Nombre:", val: data.cliente.nombre_completo },
    { label: "Identificación / RNC:", val: data.cliente.identificacion || "No registrada" },
    { label: "Teléfono:", val: data.cliente.telefono || "No registrado" },
    { label: "Correo:", val: data.cliente.correo || "No registrado" },
    { label: "Dirección:", val: data.cliente.direccion || "No registrada" }
  ];

  clientFields.forEach((f) => {
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(f.label, marginX + 4, leftY);

    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFont("helvetica", "normal");
    doc.text(f.val, marginX + 32, leftY, { maxWidth: colWidth - 36 });
    leftY += 4.5;
  });

  // Card 2: DATOS DE LA BICICLETA
  const rightX = marginX + colWidth + 6;
  drawCardBox(rightX, currentY, colWidth, cardHeight, "DATOS DE LA BICICLETA");
  let rightCardY = currentY + 12;
  const bikeFields = [
    { label: "Marca y modelo:", val: data.bicicleta.marca_modelo },
    { label: "Año / Color:", val: data.bicicleta.ano_color },
    { label: "Número de serie:", val: data.bicicleta.numero_serie },
    { label: "Código QR:", val: data.bicicleta.codigo_qr }
  ];

  bikeFields.forEach((f) => {
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(f.label, rightX + 4, rightCardY);

    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFont("helvetica", "normal");
    doc.text(f.val, rightX + 34, rightCardY, { maxWidth: colWidth - 38 });
    rightCardY += 4.5;
  });

  currentY += cardHeight + 5;

  // ==========================================
  // 3. TABLE OF INVOICE CONCEPTS
  // ==========================================

  // Table Title Frame
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(marginX, currentY, contentWidth, 7, 1.2, 1.2, "FD");

  doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("DETALLE DE LA FACTURA", marginX + 4, currentY + 5);

  currentY += 7.5;

  const tableBody = data.conceptos.map((item) => {
    const isService = String(item.tipo_concepto || "").toUpperCase() === "SERVICIO";
    const tipoText = isService ? "SERVICIO" : "REPUESTO";
    const descContent =
      item.notas && item.notas.trim().length > 0
        ? `${item.descripcion}\n${item.notas.trim()}`
        : item.descripcion;

    const cantFormatted =
      typeof item.cantidad === "number"
        ? item.cantidad.toFixed(2)
        : parseFloat(String(item.cantidad) || "1").toFixed(2);

    return [
      item.codigo || "—",
      tipoText,
      descContent,
      cantFormatted,
      formatMoney(item.precio_unitario),
      item.descuento > 0 ? `-${formatMoney(item.descuento)}` : "RD$ 0.00",
      formatMoney(item.subtotal)
    ];
  });

  // Column distribution: 29mm (Código), 19mm (Tipo), 54mm (Descripción), 12mm (Cantidad), 22mm (Precio), 22mm (Descuento), 24mm (Importe) -> Total = 182mm
  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX, top: 14, bottom: 18 },
    showHead: "everyPage",
    theme: "plain",
    head: [["CÓDIGO", "TIPO", "DESCRIPCIÓN", "CANT.", "PRECIO", "DESCUENTO", "IMPORTE"]],
    body: tableBody,
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
      0: { cellWidth: 29, halign: "left", valign: "middle", fontSize: 6.5, overflow: "hidden" },
      1: { cellWidth: 19, halign: "center", valign: "middle", fontStyle: "normal" },
      2: { cellWidth: 54, halign: "left", valign: "middle", overflow: "linebreak" },
      3: { cellWidth: 12, halign: "center", valign: "middle" },
      4: { cellWidth: 22, halign: "right", valign: "middle" },
      5: { cellWidth: 22, halign: "right", valign: "middle" },
      6: { cellWidth: 24, halign: "right", valign: "middle", fontStyle: "bold" }
    }
  });

  const finalTableY = (doc as any).lastAutoTable.finalY + 5;
  currentY = finalTableY;

  // Check if page overflow requires new page for summaries
  if (currentY > pageHeight - 65) {
    doc.addPage();
    currentY = 16;
  }

  // ==========================================
  // 4. SUMMARY & PAYMENT / OBSERVATIONS SECTION
  // ==========================================
  const summaryBoxHeight = 45;

  // Left Sub-Block 1: PAGO Y ENTREGA
  drawCardBox(marginX, currentY, colWidth, 23, "PAGO Y ENTREGA");
  let payY = currentY + 11.5;
  const payFields = [
    { label: "Estado:", val: data.pago_entrega.estado_pago, isGreen: true },
    { label: "Fecha de entrega:", val: formatDateTime(data.pago_entrega.fecha_entrega) },
    { label: "Entregada por:", val: data.pago_entrega.entregado_por }
  ];

  payFields.forEach((f) => {
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(f.label, marginX + 4, payY);

    if (f.isGreen) {
      doc.setTextColor(brandGreen[0], brandGreen[1], brandGreen[2]);
      doc.setFont("helvetica", "bold");
    } else {
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.setFont("helvetica", "normal");
    }
    doc.text(f.val, marginX + 32, payY, { maxWidth: colWidth - 36 });
    payY += 4.2;
  });

  // Left Sub-Block 2: OBSERVACIONES
  drawCardBox(marginX, currentY + 26, colWidth, 19, "OBSERVACIONES");
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(data.observaciones || "Sin observaciones adicionales", marginX + 4, currentY + 36, {
    maxWidth: colWidth - 8
  });

  // Right Block: RESUMEN FINANCIERO
  drawCardBox(rightX, currentY, colWidth, summaryBoxHeight, "RESUMEN");
  let finY = currentY + 11.5;

  const finLines = [
    { label: "Subtotal servicios", val: formatMoney(data.resumen_financiero.subtotal_servicios) },
    { label: "Subtotal repuestos", val: formatMoney(data.resumen_financiero.subtotal_repuestos) },
    { label: "Descuento", val: data.resumen_financiero.descuento_total > 0 ? `-${formatMoney(data.resumen_financiero.descuento_total)}` : "RD$ 0.00" }
  ];

  if (data.resumen_financiero.impuesto > 0) {
    finLines.push({ label: "Impuestos (ITBIS)", val: formatMoney(data.resumen_financiero.impuesto) });
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

  // Dotted divider
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.4);
  doc.line(rightX + 4, finY + 0.5, rightX + colWidth - 4, finY + 0.5);

  // TOTAL GENERAL (Single instance rule)
  finY += 5;
  doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("TOTAL GENERAL", rightX + 4, finY);

  doc.setFontSize(10.5);
  doc.text(formatMoney(data.resumen_financiero.total_general), rightX + colWidth - 4, finY, { align: "right" });

  // Balance pendiente
  finY += 4.5;
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Balance pendiente", rightX + 4, finY);

  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(formatMoney(data.resumen_financiero.balance_pendiente), rightX + colWidth - 4, finY, { align: "right" });

  currentY += summaryBoxHeight + 10;

  // ==========================================
  // 5. SIGNATURE LINES
  // ==========================================
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
  doc.text("Entregado por", sig1X + sigLineW / 2, currentY + 4, { align: "center" });
  doc.text("Recibido conforme por", sig2X + sigLineW / 2, currentY + 4, { align: "center" });

  // ==========================================
  // 7. FOOTER ACROSS ALL PAGES
  // ==========================================
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 12;

    doc.setDrawColor(brandGreen[0], brandGreen[1], brandGreen[2]);
    doc.setLineWidth(0.3);
    doc.line(marginX, footerY - 4, pageWidth - marginX, footerY - 4);

    doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`Gracias por confiar en ${data.empresa.nombre_comercial || "Bikers' Fort Core"}`, pageWidth / 2, footerY, {
      align: "center"
    });

    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Documento generado electrónicamente", pageWidth / 2, footerY + 3.5, { align: "center" });
    doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, footerY + 6.8, { align: "center" });
  }

  return doc;
}
