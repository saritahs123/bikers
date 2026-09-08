-- ============================================================================
-- MIGRATION: 013_estado_orden_trabajo_pk_sequence.sql
-- DESCRIPTION: Creation, association, default assignment and synchronization
--              of PostgreSQL sequence for admin.estado_orden_trabajo PK (estado_orden_id).
-- IDEMPOTENT: Yes (CREATE SEQUENCE IF NOT EXISTS, ALTER SEQUENCE OWNED BY,
--                  ALTER TABLE ALTER COLUMN SET DEFAULT, setval sync)
-- ============================================================================

-- 1. Create sequence if it does not already exist
CREATE SEQUENCE IF NOT EXISTS admin.estado_orden_trabajo_estado_orden_id_seq;

-- 2. Associate sequence ownership with the column
ALTER SEQUENCE admin.estado_orden_trabajo_estado_orden_id_seq OWNED BY admin.estado_orden_trabajo.estado_orden_id;

-- 3. Set column default to nextval of the sequence
ALTER TABLE admin.estado_orden_trabajo ALTER COLUMN estado_orden_id SET DEFAULT nextval('admin.estado_orden_trabajo_estado_orden_id_seq');

-- 4. Synchronize sequence current value with MAX(estado_orden_id) safely
-- If table has records: setval(seq, MAX, true) -> next nextval() yields MAX + 1
-- If table is empty: setval(seq, 1, false) -> next nextval() yields 1
SELECT setval(
  'admin.estado_orden_trabajo_estado_orden_id_seq',
  COALESCE((SELECT MAX(estado_orden_id) FROM admin.estado_orden_trabajo), 1),
  (SELECT MAX(estado_orden_id) FROM admin.estado_orden_trabajo) IS NOT NULL
);
