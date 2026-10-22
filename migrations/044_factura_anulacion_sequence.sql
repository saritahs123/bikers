-- ============================================================================
-- MIGRATION: 044_factura_anulacion_sequence.sql
-- MODULE: Facturación (Auditoría Inmutable de Anulación de Facturas)
-- DESCRIPTION:
--   1. Crea la secuencia admin.factura_anulacion_factura_anulacion_id_seq de manera idempotente.
--   2. Asocia la propiedad de la secuencia a la columna admin.factura_anulacion.factura_anulacion_id.
--   3. Establece el valor DEFAULT de la columna mediante nextval() de la secuencia.
--   4. Sincroniza de forma segura el valor actual con COALESCE(MAX(factura_anulacion_id), 1).
-- IDEMPOTENT: Sí
-- PRECAUCIÓN: No ejecutar en caliente en producción sin la ventana de mantenimiento autorizada.
-- ============================================================================

BEGIN;

-- 1. Crear secuencia de clave primaria si no existe previamente
CREATE SEQUENCE IF NOT EXISTS admin.factura_anulacion_factura_anulacion_id_seq;

-- 2. Asociar pertenencia de la secuencia a la tabla y columna correspondiente
ALTER SEQUENCE admin.factura_anulacion_factura_anulacion_id_seq 
    OWNED BY admin.factura_anulacion.factura_anulacion_id;

-- 3. Asignar nextval como valor predeterminado de la columna para inserciones automáticas
ALTER TABLE admin.factura_anulacion 
    ALTER COLUMN factura_anulacion_id 
    SET DEFAULT nextval('admin.factura_anulacion_factura_anulacion_id_seq');

-- 4. Sincronizar el cursor de la secuencia con el ID máximo existente
SELECT setval(
    'admin.factura_anulacion_factura_anulacion_id_seq',
    COALESCE((SELECT MAX(factura_anulacion_id) FROM admin.factura_anulacion), 1),
    (SELECT MAX(factura_anulacion_id) FROM admin.factura_anulacion) IS NOT NULL
);

COMMIT;
