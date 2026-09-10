-- =============================================================================
-- Migración: migrations/015_unique_active_primary_supplier.sql
-- Módulo: Inventario / Configuración (CFG-INV-1)
-- Propósito: Garantizar integridad física de unicidad para proveedor principal
--            activo por producto (a lo sumo 1 proveedor principal activo por producto).
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS producto_proveedor_principal_uk
ON admin.producto_proveedor (producto_id)
WHERE (proveedor_principal = true AND estado = 'ACTIVO');
