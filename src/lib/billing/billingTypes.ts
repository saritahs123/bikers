/**
-- ============================================================================
-- MODULE: Facturación (FAC-1 — Modelo de Datos y Motor Base)
-- FILE: src/lib/billing/billingTypes.ts
-- ARCHITECTURE: Multitenant, Auditoría, Integración Taller & Inventario
-- ============================================================================
*/

export const CODIGO_SISTEMA_FACTURA = 14;

export type TipoFacturaCodigo = "VENTA_DIRECTA" | "ORDEN_TRABAJO";

export type TipoPagoCodigo = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA";

export type EstadoFactura = "BORRADOR" | "PENDIENTE" | "PARCIAL" | "PAGADA" | "ANULADA";

export type TipoLineaFactura = "PRODUCTO" | "SERVICIO" | "REPUESTO";

export interface LineaFacturaInput {
  tipo_linea: TipoLineaFactura;
  almacen_id?: number | null;
  producto_id?: number | null;
  tipo_servicio_id?: number | null;
  orden_servicio_id?: number | null;
  orden_producto_id?: number | null;
  codigo?: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  descuento?: number;
  costo_unitario?: number | null;
}

export interface PagoInicialInput {
  tipo_pago_id: number;
  monto: number;
  referencia?: string | null;
  observacion?: string | null;
  fecha_pago?: string | Date;
}

export interface CrearFacturaInput {
  empresa_id: number;
  tipo_factura_id: number;
  cliente_id?: number | null;
  orden_trabajo_id?: number | null;
  fecha_factura?: string | Date;
  observacion?: string | null;
  usuario_id: number;
  lineas: LineaFacturaInput[];
  pagos_iniciales?: PagoInicialInput[];
}

export interface RegistrarPagoInput {
  empresa_id: number;
  factura_id: number;
  tipo_pago_id: number;
  monto: number;
  referencia?: string | null;
  observacion?: string | null;
  fecha_pago?: string | Date;
  usuario_id: number;
}

export interface AnularFacturaInput {
  empresa_id: number;
  factura_id: number;
  motivo_anulacion: string;
  usuario_id: number;
}

export interface GetOrCreateInvoiceForWorkOrderInput {
  orden_trabajo_id: number;
  empresa_id: number;
  usuario_id: number;
  observacion?: string | null;
}

export interface FacturaRow {
  factura_id: number;
  empresa_id: number;
  codigo_factura: string;
  numero_factura?: string;
  tipo_factura_id: number;
  tipo_factura_codigo?: string;
  tipo_factura_nombre?: string;
  cliente_id: number | null;
  cliente_nombre?: string;
  orden_trabajo_id: number | null;
  codigo_orden?: string;
  fecha_factura: Date | string;
  subtotal: number;
  descuento: number;
  descuento_total?: number;
  impuesto: number;
  impuesto_total?: number;
  total: number;
  total_factura?: number;
  monto_pagado: number;
  balance_pendiente: number;
  estado: EstadoFactura;
  observacion: string | null;
  usuario_creacion_id: number;
  fecha_creacion: Date | string;
  usuario_modificacion_id: number | null;
  fecha_modificacion: Date | string | null;
}

export interface DetalleFacturaRow {
  detalle_factura_id: number;
  factura_id: number;
  almacen_id?: number | null;
  tipo_linea: TipoLineaFactura;
  producto_id: number | null;
  tipo_servicio_id: number | null;
  orden_servicio_id: number | null;
  orden_producto_id: number | null;
  codigo: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  subtotal: number;
  costo_unitario: number | null;
  usuario_creacion_id: number;
  fecha_creacion: Date | string;
}

export interface PagoRow {
  pago_id: number;
  empresa_id: number;
  factura_id: number;
  tipo_pago_id: number;
  tipo_pago_codigo?: string;
  tipo_pago_nombre?: string;
  monto: number;
  referencia: string | null;
  observacion: string | null;
  fecha_pago: Date | string;
  estado: string;
  usuario_id: number;
  fecha_creacion: Date | string;
}

export interface FacturaCompletaResult {
  factura: FacturaRow;
  detalles: DetalleFacturaRow[];
  pagos: PagoRow[];
}
