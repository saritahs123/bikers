-- ============================================================================
-- Migración 023: Trazabilidad estructurada de línea de consumo en inventario
-- Agrega columna orden_producto_id a admin.movimientos_inventario
-- Mantiene intactos los movimientos históricos (NULL) y asegura integridad
-- con ON DELETE SET NULL para preservar el Kardex ante eliminación de OTs.
-- ============================================================================

-- 1. Agregar columna orden_producto_id de tipo INTEGER NULLABLE si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'admin'
          AND table_name = 'movimientos_inventario'
          AND column_name = 'orden_producto_id'
    ) THEN
        ALTER TABLE admin.movimientos_inventario
        ADD COLUMN orden_producto_id INTEGER NULL;
    END IF;
END $$;

-- 2. Agregar clave foránea hacia admin.orden_productos con ON DELETE SET NULL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'admin'
          AND table_name = 'movimientos_inventario'
          AND constraint_name = 'movimientos_orden_producto_fk'
    ) THEN
        ALTER TABLE admin.movimientos_inventario
        ADD CONSTRAINT movimientos_orden_producto_fk
        FOREIGN KEY (orden_producto_id)
        REFERENCES admin.orden_productos (orden_producto_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Crear índice para optimizar búsquedas y navegación por línea de producto
CREATE INDEX IF NOT EXISTS idx_movimientos_inventario_orden_producto_id
ON admin.movimientos_inventario (orden_producto_id);
