-- ============================================================================
-- MIGRATION: 018_tipo_movimiento_inv_inicial.sql
-- DESCRIPTION: Tipo canónico de inventario inicial (INV_INICIAL)
--              Inserta INV_INICIAL de forma idempotente para saldos de apertura.
-- IDEMPOTENT: Yes
-- ============================================================================

BEGIN;

INSERT INTO admin.tipo_movimiento_inventario (
  codigo,
  nombre,
  naturaleza,
  descripcion,
  estado
)
SELECT
  'INV_INICIAL',
  'Inventario Inicial',
  'ENTRADA',
  'Registro de saldo de apertura físico por producto y almacén.',
  'ACTIVO'
WHERE NOT EXISTS (
  SELECT 1 FROM admin.tipo_movimiento_inventario WHERE codigo = 'INV_INICIAL'
);

COMMIT;
