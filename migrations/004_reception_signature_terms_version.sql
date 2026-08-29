-- Migration: 004_reception_signature_terms_version.sql
-- Description: Add version_terminos column to admin.firma_recepcion for legal consent traceability.
-- Author: Bikers Core Team
-- Date: 2026-08-29

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'admin' 
          AND table_name = 'firma_recepcion' 
          AND column_name = 'version_terminos'
    ) THEN
        ALTER TABLE admin.firma_recepcion 
        ADD COLUMN version_terminos VARCHAR(50) DEFAULT NULL;
        
        COMMENT ON COLUMN admin.firma_recepcion.version_terminos IS 'Identificador explícito de versión de los términos y condiciones aceptados (ej. RECEPTION_TERMS_2026_01). Las firmas previas se preservan como NULL (LEGACY_UNVERSIONED).';
    END IF;
END $$;
