-- ============================================================================
-- MIGRATION: 011_usuario_identidad_nullable_org_columns.sql
-- DESCRIPTION: Make departamento_id, area_id, and cargo_id nullable in
--              admin.usuario_identidad to support user creation without
--              mandatory organizational assignment.
-- IDEMPOTENT: Yes (ALTER TABLE ... ALTER COLUMN ... DROP NOT NULL)
-- ============================================================================

ALTER TABLE admin.usuario_identidad ALTER COLUMN departamento_id DROP NOT NULL;
ALTER TABLE admin.usuario_identidad ALTER COLUMN area_id DROP NOT NULL;
ALTER TABLE admin.usuario_identidad ALTER COLUMN cargo_id DROP NOT NULL;
