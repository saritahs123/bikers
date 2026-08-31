-- ============================================================================
-- MIGRATION: 007_catalogs_pk_sequences.sql
-- DESCRIPTION: Creation, association, default assignment and synchronization
--              of PostgreSQL sequences for admin.tipo_servicio and admin.productos PKs.
-- IDEMPOTENT: Yes (CREATE SEQUENCE IF NOT EXISTS, ALTER COLUMN SET DEFAULT, setval sync)
-- ============================================================================

-- 1. admin.tipo_servicio (tipo_servicio_id)
CREATE SEQUENCE IF NOT EXISTS admin.tipo_servicio_tipo_servicio_id_seq;
ALTER SEQUENCE admin.tipo_servicio_tipo_servicio_id_seq OWNED BY admin.tipo_servicio.tipo_servicio_id;
ALTER TABLE admin.tipo_servicio ALTER COLUMN tipo_servicio_id SET DEFAULT nextval('admin.tipo_servicio_tipo_servicio_id_seq');
SELECT setval(
  'admin.tipo_servicio_tipo_servicio_id_seq',
  COALESCE((SELECT MAX(tipo_servicio_id) FROM admin.tipo_servicio), 1),
  (SELECT MAX(tipo_servicio_id) FROM admin.tipo_servicio) IS NOT NULL
);

-- 2. admin.productos (producto_id)
CREATE SEQUENCE IF NOT EXISTS admin.productos_producto_id_seq;
ALTER SEQUENCE admin.productos_producto_id_seq OWNED BY admin.productos.producto_id;
ALTER TABLE admin.productos ALTER COLUMN producto_id SET DEFAULT nextval('admin.productos_producto_id_seq');
SELECT setval(
  'admin.productos_producto_id_seq',
  COALESCE((SELECT MAX(producto_id) FROM admin.productos), 1),
  (SELECT MAX(producto_id) FROM admin.productos) IS NOT NULL
);
