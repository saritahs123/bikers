-- =============================================================================
-- MIGRACIÓN MULTI-TENANT VERSIONADA: 20260812_02_workshop_multi_tenant.sql
-- Propósito: Adición formal de empresa_id a tablas de Taller y CRM tras análisis
-- NOTA: Archivo creado únicamente para revisión. NO EJECUTADO.
-- =============================================================================

BEGIN;

-- 1. Añadir empresa_id NULLable a tablas CRM y Taller
ALTER TABLE admin.clientes ADD COLUMN IF NOT EXISTS empresa_id integer NULL REFERENCES admin.empresa(empresa_id);
ALTER TABLE admin.bicicletas ADD COLUMN IF NOT EXISTS empresa_id integer NULL REFERENCES admin.empresa(empresa_id);
ALTER TABLE admin.recepciones ADD COLUMN IF NOT EXISTS empresa_id integer NULL REFERENCES admin.empresa(empresa_id);
ALTER TABLE admin.ordenes_trabajo ADD COLUMN IF NOT EXISTS empresa_id integer NULL REFERENCES admin.empresa(empresa_id);

-- NOTA ARQUITECTÓNICA: Los estatutos NOT NULL y la actualización masiva de empresa_id
-- se aplicarán únicamente en la Fase E tras ejecutar el script de análisis multi-tenant
-- (20260812_02_multi_tenant_analysis.sql) y obtener la aprobación del usuario.

COMMIT;
