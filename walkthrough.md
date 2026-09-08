# Walkthrough — Sincronización Transaccional de Factura al Editar/Eliminar Servicios

Se implementó la **sincronización atómica y transaccional** de `admin.facturas` y `admin.detalle_factura` al modificar o eliminar servicios de una Orden de Trabajo (OT) que ya posee factura emitida, manteniendo intactos los pagos históricos en `admin.pagos` (sin mutaciones silenciosas, sin notas de crédito ficticias ni auto-reembolsos).

---

## 1. Cambios Principales

### 1.1 Servicio de Sincronización Atómica de Facturas
- **[syncWorkOrderInvoice.ts](file:///c:/ProyectoE/bikers/src/lib/workshop/syncWorkOrderInvoice.ts)**:
  - Detecta si la OT posee factura en `admin.facturas`.
  - Si **no existe factura**, no crea factura y retorna `synchronized: false`.
  - Si **existe factura**, realiza dentro de la misma transacción:
    1. Bloqueo `FOR UPDATE` sobre la factura.
    2. Consulta de conceptos activos facturables: servicios (`admin.orden_servicios`), mano de obra (`admin.orden_servicio_mano_obra`) y repuestos (`admin.orden_productos`).
    3. Sincronización de `admin.detalle_factura`: borrado de líneas obsoletas e inserción de las líneas activas con secuencia `detalle_factura_id`.
    4. Recálculo canónico de totales de la factura (`subtotal`, `descuento_total`, `impuesto_total`, `total_factura`).
    5. Lectura factual de pagos aplicados en `admin.pagos` (`monto_pagado` permanece como la suma real de cobros aplicados).
    6. Cálculo matemático de `balance_pendiente = GREATEST(0, total_factura - monto_pagado)` y detección de `sobrepago` si `monto_pagado > total_factura`.
    7. Actualización de `admin.facturas` con los nuevos totales y estado coherente (`'PAGADA'`, `'EMITIDA'`, `'PENDIENTE'`).

### 1.2 Integración en Rutas PUT y DELETE de Servicios
- **[route.ts (servicios/[servicioId])](file:///c:/ProyectoE/bikers/src/app/api/taller/ordenes/[id]/servicios/[servicioId]/route.ts)**:
  - En `PUT` y `DELETE`, se invoca `syncWorkOrderInvoice` dentro del bloque transaccional (`BEGIN` ... `COMMIT`).
  - Si ocurre cualquier error en la sincronización, se ejecuta `ROLLBACK` completo (la edición/eliminación del servicio y los cambios en la factura se revierten en su totalidad).
  - Auditoría enriquecida: registra `factura_id`, `total_anterior`, `total_nuevo`, `monto_pagado`, `balance_pendiente` y `sobrepago`.

### 1.3 Factura Imprimible / POS
- **[route.ts (imprimir)](file:///c:/ProyectoE/bikers/src/app/api/taller/facturacion/ordenes/[id]/imprimir/route.ts)**:
  - Cuando existe factura persistida en `admin.facturas`, la impresión lee exclusivamente de `admin.facturas` y `admin.detalle_factura` (fuente única de verdad persistida).
  - Si no existe factura, mantiene la previsualización operativa como fallback.

---

## 2. Resultados de las Pruebas Automatizadas (Scenarios A - G)

| Prueba | Escenario | Resultado |
| :--- | :--- | :---: |
| **A** | **OT sin Factura**: Edición/eliminación de servicio recalcula OT sin crear factura | **PASS** |
| **B** | **Factura sin Pagos**: Edición de servicio sincroniza total y balance a RD$ 2,800 | **PASS** |
| **C** | **Factura Pagada + Aumento**: Factura sube a RD$ 2,800, pago factual se preserva en RD$ 2,300, balance pendiente exacto en RD$ 500 | **PASS** |
| **D** | **Factura Pagada + Eliminación (Sobrepago)**: Factura baja a RD$ 800, línea de detalle desaparece, pago factual se preserva en RD$ 2,300, sobrepago detectado en RD$ 1,500 | **PASS** |
| **E** | **Factura con Pago Parcial**: Factura sube a RD$ 2,800, pago parcial en RD$ 1,000 se mantiene, balance pendiente en RD$ 1,800 | **PASS** |
| **F** | **Impresión / POS**: Lee directamente líneas persistidas de `admin.detalle_factura` y totales de `admin.facturas` | **PASS** |
| **G** | **Atomicidad & Rollback**: Ante fallo simulado en factura, se revierte tanto el servicio como la OT | **PASS** |
