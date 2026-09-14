import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { COMPANY_LOGO_BASE64 } from "@/lib/assets/logoBase64";

export interface MovementProductLine {
  movimiento_inventario_id?: number | string;
  producto_id?: number | string;
  codigo_producto?: string;
  producto_nombre?: string;
  almacen_id?: number | string;
  almacen_codigo?: string;
  almacen_nombre?: string;
  origen_nombre?: string;
  destino_nombre?: string;
  cantidad?: number | string;
  costo_unitario?: number | string;
  costo_total?: number | string;
  stock_anterior?: number | string;
  stock_nuevo?: number | string;
  naturaleza?: "ENTRADA" | "SALIDA" | string;
}

export interface InventoryMovementPdfData {
  movimiento_inventario_id: number | string;
  codigo_movimiento?: string | null;
  fecha_movimiento: string;
  tipo_movimiento_id?: number | string;
  tipo_codigo: string;
  tipo_nombre: string;
  naturaleza: "ENTRADA" | "SALIDA" | string;
  referencia?: string | null;
  observacion?: string | null;
  usuario_nombre?: string | null;
  transferencia_uuid?: string | null;
  proveedor_id?: number | string | null;
  proveedor_nombre?: string | null;
  orden_trabajo_id?: number | string | null;
  codigo_orden?: string | null;
  movimiento_origen_id?: number | string | null;
  movimiento_origen_codigo?: string | null;

  empresa?: {
    nombre_comercial?: string;
    subtitulo?: string;
    direccion?: string | null;
    telefono?: string | null;
    email?: string | null;
    correo?: string | null;
    rnc?: string | null;
    logotipo_url?: string | null;
  } | null;

  productos?: MovementProductLine[];

  // Fallback single product fields
  codigo_producto?: string;
  producto_nombre?: string;
  almacen_id?: number | string;
  almacen_codigo?: string;
  almacen_nombre?: string;
  cantidad?: number | string;
  costo_unitario?: number | string;
  costo_total?: number | string;
  stock_anterior?: number | string;
  stock_nuevo?: number | string;
}

export const formatMoney = (val?: number | string | null): string => {
  const num = typeof val === "number" ? val : parseFloat(String(val || 0));
  const safeNum = isNaN(num) ? 0 : num;
  return `RD$ ${safeNum.toLocaleString("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

export const formatNumber = (val?: number | string | null): string => {
  const num = typeof val === "number" ? val : parseFloat(String(val || 0));
  const safeNum = isNaN(num) ? 0 : num;
  return safeNum.toLocaleString("es-DO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
};

export const formatDateTime = (dateStr?: string | null): string => {
  if (!dateStr) return "No registrada";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
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
    return String(dateStr);
  }
};

export function generateInventoryMovementPdfDocument(data: InventoryMovementPdfData): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm

  // Standard Ride Lab Color Palette
  const primaryGreen = [4, 120, 87]; // #047857
  const brandGreen = [5, 150, 105]; // #059669
  const textDark = [30, 41, 59]; // #1e293b
  const textGray = [100, 116, 139]; // #64748b
  const borderColor = [226, 232, 240]; // #e2e8f0
  const lightBg = [248, 250, 252]; // #f8fafc

  let currentY = 14;

  // ==========================================
  // 1. HEADER SECTION - REAL COMPANY INFO
  // ==========================================

  // Logo Ride Lab
  try {
    doc.addImage(COMPANY_LOGO_BASE64, "PNG", marginX, currentY - 2, 32, 12.9);
  } catch {
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(data.empresa?.nombre_comercial || "RIDE LAB", marginX, currentY + 4);
  }

  // Company Info Lines - Same pattern as Workshop Invoice
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFontSize(8);
  let compY = currentY + 16;

  const emailVal = data.empresa?.email || data.empresa?.correo;
  const companyLines = [
    data.empresa?.direccion ? `Dirección: ${data.empresa.direccion}` : null,
    data.empresa?.telefono ? `Teléfono: ${data.empresa.telefono}` : null,
    emailVal ? `Correo: ${emailVal}` : null,
    data.empresa?.rnc ? `RNC: ${data.empresa.rnc}` : null
  ].filter(Boolean) as string[];

  companyLines.forEach((line) => {
    doc.text(line, marginX, compY);
    compY += 4.0;
  });

  // Right Header: MOVIMIENTO DE INVENTARIO Title & Metadata
  doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("MOVIMIENTO DE INVENTARIO", pageWidth - marginX, currentY + 5, { align: "right" });

  const movCode = data.codigo_movimiento || `MOV-${data.movimiento_inventario_id}`;
  const movDate = formatDateTime(data.fecha_movimiento);

  let metaY = currentY + 13;
  const rightMeta = [
    { label: "Código:", val: movCode },
    { label: "Fecha:", val: movDate }
  ];

  rightMeta.forEach((item) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.text(item.label, pageWidth - marginX - 58, metaY);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(item.val, pageWidth - marginX, metaY, { align: "right" });
    metaY += 4.5;
  });

  // Naturaleza Badge (ENTRADA / SALIDA)
  const isEntrada = String(data.naturaleza || "").toUpperCase() === "ENTRADA";
  const badgeText = isEntrada ? "ENTRADA" : "SALIDA";
  const badgeWidth = 28;
  const badgeHeight = 6;
  const badgeX = pageWidth - marginX - badgeWidth;
  const badgeY = metaY + 1;

  if (isEntrada) {
    doc.setDrawColor(brandGreen[0], brandGreen[1], brandGreen[2]);
    doc.setFillColor(236, 253, 245); // #ecfdf5
    doc.setLineWidth(0.3);
    doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1.2, 1.2, "FD");
    doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  } else {
    doc.setDrawColor(217, 119, 6); // amber border
    doc.setFillColor(254, 243, 199); // #fef3c7 amber bg
    doc.setLineWidth(0.3);
    doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1.2, 1.2, "FD");
    doc.setTextColor(180, 83, 9); // amber text
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(badgeText, badgeX + badgeWidth / 2, badgeY + 4.2, { align: "center" });

  currentY = Math.max(compY, badgeY + badgeHeight) + 6;

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

  // ==========================================
  // 2. DETALLE DEL MOVIMIENTO
  // ==========================================
  const productLines: MovementProductLine[] =
    data.productos && data.productos.length > 0
      ? data.productos
      : [
          {
            movimiento_inventario_id: data.movimiento_inventario_id,
            codigo_producto: data.codigo_producto || "—",
            producto_nombre: data.producto_nombre || "—",
            almacen_id: data.almacen_id,
            almacen_codigo: data.almacen_codigo,
            almacen_nombre: data.almacen_nombre || "—",
            cantidad: data.cantidad ?? 0,
            costo_unitario: data.costo_unitario ?? 0,
            costo_total: data.costo_total ?? 0,
            stock_anterior: data.stock_anterior ?? 0,
            stock_nuevo: data.stock_nuevo ?? 0,
            naturaleza: data.naturaleza
          }
        ];

  const cardHeaderHeight = 24;
  drawCardBox(marginX, currentY, contentWidth, cardHeaderHeight, "DETALLE DEL MOVIMIENTO");

  const halfW = contentWidth / 2;
  const row1Y = currentY + 12;
  const row2Y = currentY + 17.5;

  // Left Column
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Código movimiento:", marginX + 4, row1Y);
  doc.text("Tipo movimiento:", marginX + 4, row2Y);

  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFont("helvetica", "normal");
  doc.text(movCode, marginX + 34, row1Y);
  doc.text(`${data.tipo_nombre || "Movimiento"} (${data.tipo_codigo || "—"})`, marginX + 34, row2Y);

  // Right Column
  const col2X = marginX + halfW + 4;
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFont("helvetica", "bold");
  doc.text("Fecha y hora:", col2X, row1Y);
  doc.text("Registrado por:", col2X, row2Y);

  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFont("helvetica", "normal");
  doc.text(movDate, col2X + 26, row1Y);
  doc.text(data.usuario_nombre || "Sistema", col2X + 26, row2Y);

  currentY += cardHeaderHeight + 5;

  // ==========================================
  // 3. DETALLE DE PRODUCTOS (TABLA MULTIPRODUCTO)
  // ==========================================

  // Table Title Frame
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(marginX, currentY, contentWidth, 7, 1.2, 1.2, "FD");

  doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  const prodTitle =
    productLines.length > 1
      ? `DETALLE DE PRODUCTOS (${productLines.length} LÍNEAS)`
      : "DETALLE DE PRODUCTOS";
  doc.text(prodTitle, marginX + 4, currentY + 5);

  currentY += 7.5;

  let totalValuadoCalculado = 0;

  const tableBody = productLines.map((line) => {
    const lineNaturaleza = String(line.naturaleza || data.naturaleza || "").toUpperCase();
    const isLineEntrada = lineNaturaleza === "ENTRADA";
    const sign = isLineEntrada ? "+" : "-";

    const cantRaw = Number(line.cantidad) || 0;
    const unitRaw = Number(line.costo_unitario) || 0;
    const lineTotal =
      line.costo_total !== undefined && line.costo_total !== null
        ? Number(line.costo_total)
        : cantRaw * unitRaw;

    totalValuadoCalculado += lineTotal;

    // Transfer origin/dest if available
    let almacenDisplay = line.almacen_nombre || "—";
    if (line.origen_nombre && line.destino_nombre) {
      almacenDisplay = `${line.origen_nombre} -> ${line.destino_nombre}`;
    }

    return [
      line.codigo_producto || "—",
      line.producto_nombre || "—",
      almacenDisplay,
      formatNumber(line.stock_anterior),
      `${sign}${formatNumber(cantRaw)}`,
      formatNumber(line.stock_nuevo),
      formatMoney(unitRaw),
      formatMoney(lineTotal)
    ];
  });

  // Total contentWidth: 182mm
  // Column distribution: 23mm + 43mm + 34mm + 15mm + 15mm + 16mm + 18mm + 18mm = 182mm
  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX, top: 14, bottom: 20 },
    showHead: "everyPage",
    theme: "plain",
    head: [["CÓDIGO", "PRODUCTO", "ALMACÉN", "STOCK ANT.", "CANT.", "STOCK FINAL", "COSTO UNIT.", "IMPORTE"]],
    body: tableBody,
    styles: {
      font: "helvetica",
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 },
      lineWidth: 0.15,
      lineColor: [226, 232, 240],
      valign: "middle",
      overflow: "linebreak"
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [51, 65, 85],
      fontStyle: "bold",
      fontSize: 7,
      lineWidth: 0.2,
      lineColor: [226, 232, 240],
      valign: "middle"
    },
    columnStyles: {
      0: { cellWidth: 23, halign: "left", valign: "middle", fontSize: 6.5 },
      1: { cellWidth: 43, halign: "left", valign: "middle", overflow: "linebreak" },
      2: { cellWidth: 34, halign: "left", valign: "middle", overflow: "linebreak" },
      3: { cellWidth: 15, halign: "center", valign: "middle" },
      4: { cellWidth: 15, halign: "center", valign: "middle", fontStyle: "bold" },
      5: { cellWidth: 16, halign: "center", valign: "middle" },
      6: { cellWidth: 18, halign: "right", valign: "middle" },
      7: { cellWidth: 18, halign: "right", valign: "middle", fontStyle: "bold" }
    }
  });

  const finalTableY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  currentY = finalTableY + 4;

  // ==========================================
  // 4. TOTAL VALUADO
  // ==========================================
  if (currentY > pageHeight - 35) {
    doc.addPage();
    currentY = 16;
  }

  const totalBoxWidth = 72;
  const totalBoxHeight = 8.5;
  const totalBoxX = pageWidth - marginX - totalBoxWidth;
  const totalBoxY = currentY;

  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(totalBoxX, totalBoxY, totalBoxWidth, totalBoxHeight, 1.2, 1.2, "FD");

  doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("TOTAL VALUADO:", totalBoxX + 4, totalBoxY + 5.5);

  doc.setFontSize(9.5);
  doc.text(formatMoney(totalValuadoCalculado), pageWidth - marginX - 4, totalBoxY + 5.5, { align: "right" });

  currentY += totalBoxHeight + 5;

  // ==========================================
  // 5. INFORMACIÓN ADICIONAL
  // ==========================================
  const infoFields: Array<{ label: string; val: string }> = [];

  if (data.referencia) {
    infoFields.push({ label: "Referencia:", val: data.referencia });
  }

  if (data.proveedor_nombre) {
    infoFields.push({ label: "Proveedor:", val: data.proveedor_nombre });
  }

  const ordenTrabajoVal =
    data.codigo_orden || (data.orden_trabajo_id ? `OT #${data.orden_trabajo_id}` : null);
  if (ordenTrabajoVal) {
    infoFields.push({ label: "Orden de trabajo:", val: ordenTrabajoVal });
  }

  const movOrigenVal =
    data.movimiento_origen_codigo ||
    (data.movimiento_origen_id ? `Mov #${data.movimiento_origen_id}` : null);
  if (movOrigenVal) {
    infoFields.push({ label: "Movimiento origen:", val: movOrigenVal });
  }

  if (data.transferencia_uuid) {
    infoFields.push({ label: "Transferencia vinculada:", val: data.transferencia_uuid });
  }

  const hasObservacion = Boolean(data.observacion && data.observacion.trim().length > 0);
  const rowsCount = Math.ceil(infoFields.length / 2);
  const baseCardHeight = 18 + rowsCount * 4.5 + (hasObservacion ? 13 : 0);
  const cardInfoHeight = Math.max(26, Math.min(baseCardHeight, 52));

  // Check page overflow for additional info card
  if (currentY + cardInfoHeight > pageHeight - 22) {
    doc.addPage();
    currentY = 16;
  }

  drawCardBox(marginX, currentY, contentWidth, cardInfoHeight, "INFORMACIÓN ADICIONAL");
  const infoY = currentY + 11.5;

  if (infoFields.length === 0 && !hasObservacion) {
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.text("Sin datos estructurados adicionales registrados para este movimiento.", marginX + 4, infoY);
  } else {
    // 2 columns
    for (let i = 0; i < infoFields.length; i++) {
      const field = infoFields[i];
      const isLeft = i % 2 === 0;
      const colX = isLeft ? marginX + 4 : marginX + halfW + 4;
      const rowY = infoY + Math.floor(i / 2) * 4.5;

      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(field.label, colX, rowY);

      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.setFont("helvetica", "normal");
      doc.text(field.val, colX + 32, rowY, { maxWidth: halfW - 36 });
    }

    if (hasObservacion) {
      const obsY = infoY + rowsCount * 4.5 + 1.0;
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("Observaciones:", marginX + 4, obsY);

      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.setFont("helvetica", "italic");
      doc.text(String(data.observacion), marginX + 4, obsY + 4.2, {
        maxWidth: contentWidth - 8
      });
    }
  }

  // ==========================================
  // 6. STRICTLY NO SIGNATURES
  // ==========================================

  // ==========================================
  // 7. FOOTER ACROSS ALL PAGES
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 12;

    doc.setDrawColor(brandGreen[0], brandGreen[1], brandGreen[2]);
    doc.setLineWidth(0.3);
    doc.line(marginX, footerY - 4, pageWidth - marginX, footerY - 4);

    doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Documento generado por Ride Lab", pageWidth / 2, footerY, {
      align: "center"
    });

    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Registro de Transacción de Inventario", pageWidth / 2, footerY + 3.5, { align: "center" });
    doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, footerY + 6.8, { align: "center" });
  }

  return doc;
}

export function downloadInventoryMovementPdf(data: InventoryMovementPdfData): string {
  const doc = generateInventoryMovementPdfDocument(data);
  const rawCode =
    data.codigo_movimiento ||
    (data.movimiento_inventario_id ? `MOV-${data.movimiento_inventario_id}` : "DETALLE");
  const sanitizedCode = rawCode.replace(/[/\\?%*:|"<>]/g, "_");
  const fileName = `Movimiento_${sanitizedCode}.pdf`;
  doc.save(fileName);
  return fileName;
}
