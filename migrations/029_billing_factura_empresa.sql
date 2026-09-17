-- ============================================================================
-- MIGRATION: 029_billing_factura_empresa.sql
-- MODULE: Facturación (FAC-MULTITENANCY — Factura como Raíz Multitenant)
-- DESCRIPTION:
--   1. Agrega empresa_id a admin.facturas (FK canónica a admin.empresa).
--   2. Backfill seguro basado en relaciones reales existentes:
--      - Factura de OT -> admin.ordenes_trabajo (ot.empresa_id / recepcion / cliente)
--      - Factura directa -> admin.clientes.empresa_id
--      - Fallback confiable -> admin.usuario.empresa_id (usuario_creacion_id)
--   3. Valida detección estricta de inconsistencias antes de aplicar NOT NULL.
--   4. Aplica NOT NULL y FK restrict a admin.empresa(empresa_id).
--   5. Crea índices multitenant:
--      - facturas(empresa_id)
--      - facturas(empresa_id, estado)
--      - Mantiene/Asegura índice único parcial por OT: (empresa_id, orden_trabajo_id)
--   6. NO altera admin.pagos: la multitenencia de pagos se resuelve vía f.empresa_id.
-- IDEMPOTENT: Sí
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Agregar columna empresa_id a admin.facturas (si no existe)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'admin'
          AND table_name = 'facturas'
          AND column_name = 'empresa_id'
    ) THEN
        ALTER TABLE admin.facturas ADD COLUMN empresa_id INTEGER;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Backfill seguro de facturas existentes
-- ----------------------------------------------------------------------------

-- Prioridad 1: Factura asociada a Orden de Trabajo (OT)
-- Resuelve empresa desde la OT, su recepción o el cliente canónico de la orden
UPDATE admin.facturas f
SET empresa_id = COALESCE(ot.empresa_id, r.empresa_id, c.empresa_id)
FROM admin.ordenes_trabajo ot
LEFT JOIN admin.recepciones r ON ot.recepcion_id = r.recepcion_id
LEFT JOIN admin.clientes c ON ot.cliente_id = c.cliente_id
WHERE f.orden_trabajo_id = ot.orden_trabajo_id
  AND f.empresa_id IS NULL
  AND COALESCE(ot.empresa_id, r.empresa_id, c.empresa_id) IS NOT NULL;

-- Prioridad 2: Factura directa con cliente
-- Resuelve empresa desde admin.clientes
UPDATE admin.facturas f
SET empresa_id = c.empresa_id
FROM admin.clientes c
WHERE f.cliente_id = c.cliente_id
  AND f.empresa_id IS NULL
  AND c.empresa_id IS NOT NULL;

-- Prioridad 3: Relación confiable del usuario creador
-- Resuelve empresa desde admin.usuario
UPDATE admin.facturas f
SET empresa_id = u.empresa_id
FROM admin.usuario u
WHERE f.usuario_creacion_id = u.usuario_id
  AND f.empresa_id IS NULL
  AND u.empresa_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. Detección estricta de inconsistencias antes de aplicar NOT NULL
--    NO inventar empresa_id. Si quedan facturas huérfanas, abortar con error claro.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_inconsistentes INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_inconsistentes
    FROM admin.facturas
    WHERE empresa_id IS NULL;

    IF v_inconsistentes > 0 THEN
        RAISE EXCEPTION 'ERROR MIGRACION 029: Se encontraron % facturas con empresa_id NULL que no pudieron resolverse mediante relaciones canónicas (OT, Cliente, Usuario). Abortando migración para evitar asignación arbitraria.', v_inconsistentes;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Restricción NOT NULL sobre empresa_id
-- ----------------------------------------------------------------------------
ALTER TABLE admin.facturas ALTER COLUMN empresa_id SET NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. Foreign Key hacia tabla canónica admin.empresa
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'admin'
          AND table_name = 'facturas'
          AND constraint_name = 'fk_facturas_empresa'
    ) THEN
        ALTER TABLE admin.facturas
        ADD CONSTRAINT fk_facturas_empresa
        FOREIGN KEY (empresa_id)
        REFERENCES admin.empresa(empresa_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. Índices multitenant y preservación de regla Unique por OT activa
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_facturas_empresa_id ON admin.facturas (empresa_id);

CREATE INDEX IF NOT EXISTS idx_facturas_empresa_id_estado ON admin.facturas (empresa_id, estado);

-- Mantener regla: una factura activa por OT (no romper índice unique parcial)
CREATE UNIQUE INDEX IF NOT EXISTS uq_facturas_empresa_orden_activa
ON admin.facturas (empresa_id, orden_trabajo_id)
WHERE orden_trabajo_id IS NOT NULL AND estado <> 'ANULADA';

COMMIT;
