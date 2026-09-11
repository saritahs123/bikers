-- ============================================================================
-- MIGRATION: 017_tipo_movimiento_sal_manual.sql
-- DESCRIPTION: Tipo canónico de salida manual de inventario (SAL_MANUAL)
--              Configura secuencia en tipo_movimiento_id e inserta SAL_MANUAL
--              manteniendo intacto SAL_ORDEN para Taller.
-- IDEMPOTENT: Yes
-- ============================================================================

BEGIN;

-- 1. Asegurar secuencia para tipo_movimiento_id si no existe
CREATE SEQUENCE IF NOT EXISTS admin.tipo_movimiento_inventario_tipo_movimiento_id_seq;
ALTER SEQUENCE admin.tipo_movimiento_inventario_tipo_movimiento_id_seq OWNED BY admin.tipo_movimiento_inventario.tipo_movimiento_id;
ALTER TABLE admin.tipo_movimiento_inventario
  ALTER COLUMN tipo_movimiento_id SET DEFAULT nextval('admin.tipo_movimiento_inventario_tipo_movimiento_id_seq');

SELECT setval(
  'admin.tipo_movimiento_inventario_tipo_movimiento_id_seq',
  COALESCE((SELECT MAX(tipo_movimiento_id) FROM admin.tipo_movimiento_inventario), 1),
  (SELECT MAX(tipo_movimiento_id) FROM admin.tipo_movimiento_inventario) IS NOT NULL
);

-- 2. Insertar SAL_MANUAL de forma idempotente
INSERT INTO admin.tipo_movimiento_inventario (
  codigo,
  nombre,
  naturaleza,
  descripcion,
  estado
)
SELECT
  'SAL_MANUAL',
  'Salida Manual de Inventario',
  'SALIDA',
  'Salida manual de productos por consumo, venta directa u otro motivo operativo.',
  'ACTIVO'
WHERE NOT EXISTS (
  SELECT 1 FROM admin.tipo_movimiento_inventario WHERE codigo = 'SAL_MANUAL'
);

COMMIT;
