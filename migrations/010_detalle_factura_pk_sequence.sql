-- ============================================================================
-- MIGRATION: 010_detalle_factura_pk_sequence.sql
-- DESCRIPTION: Creation, association, default assignment and synchronization
--              of PostgreSQL sequence for admin.detalle_factura PK (detalle_factura_id).
-- IDEMPOTENT: Yes (CREATE SEQUENCE IF NOT EXISTS, ALTER SEQUENCE OWNED BY,
--                  ALTER TABLE ALTER COLUMN SET DEFAULT, setval sync)
-- ============================================================================

-- 1. Create sequence if it does not already exist
CREATE SEQUENCE IF NOT EXISTS admin.detalle_factura_detalle_factura_id_seq;

-- 2. Associate sequence ownership with the column
ALTER SEQUENCE admin.detalle_factura_detalle_factura_id_seq OWNED BY admin.detalle_factura.detalle_factura_id;

-- 3. Set column default to nextval of the sequence
ALTER TABLE admin.detalle_factura ALTER COLUMN detalle_factura_id SET DEFAULT nextval('admin.detalle_factura_detalle_factura_id_seq');

-- 4. Synchronize sequence current value with MAX(detalle_factura_id) safely
-- If table has records: setval(seq, MAX, true) -> next nextval() yields MAX + 1
-- If table is empty: setval(seq, 1, false) -> next nextval() yields 1
SELECT setval(
  'admin.detalle_factura_detalle_factura_id_seq',
  COALESCE((SELECT MAX(detalle_factura_id) FROM admin.detalle_factura), 1),
  (SELECT MAX(detalle_factura_id) FROM admin.detalle_factura) IS NOT NULL
);
