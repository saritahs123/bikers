-- ============================================================================
-- MIGRATION: 031_billing_cancellation_reasons.sql
-- MODULE: Facturación (FAC-6.1 — Catálogo de Motivos de Anulación y Trazabilidad)
-- DESCRIPTION:
--   1. Crea tabla admin.motivo_anulacion_factura con constraints y secuencia segura.
--   2. Inserta catálogo inicial de motivos con mapeo de inventario (DEV_VENTA).
--   3. Agrega columna movimiento_inventario_id en admin.detalle_factura con FK a admin.movimientos_inventario.
--   4. Crea tabla admin.factura_anulacion para snapshot histórico inmutable de anulaciones.
-- IDEMPOTENT: Sí
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Tabla admin.motivo_anulacion_factura
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin.motivo_anulacion_factura (
    motivo_anulacion_factura_id INT4 NOT NULL,
    codigo                      VARCHAR(30) NOT NULL,
    motivo_anulacion            VARCHAR(100) NOT NULL,
    descripcion                 VARCHAR(255) NULL,

    genera_movimiento           BOOLEAN NOT NULL DEFAULT TRUE,
    tipo_movimiento_id          INT4 NULL,

    requiere_observacion        BOOLEAN NOT NULL DEFAULT FALSE,
    requiere_autorizacion       BOOLEAN NOT NULL DEFAULT FALSE,

    estado                      VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',

    fecha_registro              TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    fecha_actualizacion         TIMESTAMPTZ NULL,
    usuario_registro            INT4 NULL,
    usuario_actualizacion       INT4 NULL,

    CONSTRAINT motivo_anulacion_factura_pk
        PRIMARY KEY (motivo_anulacion_factura_id),

    CONSTRAINT motivo_anulacion_factura_codigo_uk
        UNIQUE (codigo),

    CONSTRAINT motivo_anulacion_factura_movimiento_fk
        FOREIGN KEY (tipo_movimiento_id)
        REFERENCES admin.tipo_movimiento_inventario(tipo_movimiento_id),

    CONSTRAINT motivo_anulacion_factura_estado_ck
        CHECK (estado IN ('ACTIVO', 'INACTIVO')),

    CONSTRAINT motivo_anulacion_factura_movimiento_ck
        CHECK (
            (genera_movimiento = TRUE AND tipo_movimiento_id IS NOT NULL)
            OR
            (genera_movimiento = FALSE AND tipo_movimiento_id IS NULL)
        )
);

-- Secuencia para motivo_anulacion_factura_id
CREATE SEQUENCE IF NOT EXISTS admin.motivo_anulacion_factura_motivo_anulacion_factura_id_seq;
ALTER SEQUENCE admin.motivo_anulacion_factura_motivo_anulacion_factura_id_seq OWNED BY admin.motivo_anulacion_factura.motivo_anulacion_factura_id;
ALTER TABLE admin.motivo_anulacion_factura
    ALTER COLUMN motivo_anulacion_factura_id SET DEFAULT nextval('admin.motivo_anulacion_factura_motivo_anulacion_factura_id_seq');

-- Comentarios requeridos
COMMENT ON TABLE admin.motivo_anulacion_factura IS
'Catálogo de motivos permitidos para anular facturas. Determina si la anulación genera un movimiento de inventario.';

COMMENT ON COLUMN admin.motivo_anulacion_factura.genera_movimiento IS
'Indica si el motivo contempla efecto de inventario. La aplicación además valida las líneas reales de la factura.';

COMMENT ON COLUMN admin.motivo_anulacion_factura.tipo_movimiento_id IS
'Tipo de movimiento configurado para el efecto de inventario de la anulación.';

COMMENT ON COLUMN admin.motivo_anulacion_factura.requiere_observacion IS
'Indica si el usuario debe escribir una explicación adicional.';

COMMENT ON COLUMN admin.motivo_anulacion_factura.requiere_autorizacion IS
'Indica si la anulación necesita autorización de un usuario con permisos.';

-- ----------------------------------------------------------------------------
-- 2. Columna movimiento_inventario_id en admin.detalle_factura
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'admin' AND table_name = 'detalle_factura' AND column_name = 'movimiento_inventario_id'
    ) THEN
        ALTER TABLE admin.detalle_factura ADD COLUMN movimiento_inventario_id INTEGER NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'admin' AND table_name = 'detalle_factura' AND constraint_name = 'fk_detalle_factura_movimiento_inventario'
    ) THEN
        ALTER TABLE admin.detalle_factura
        ADD CONSTRAINT fk_detalle_factura_movimiento_inventario
        FOREIGN KEY (movimiento_inventario_id)
        REFERENCES admin.movimientos_inventario(movimiento_inventario_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_detalle_factura_movimiento_id
ON admin.detalle_factura(movimiento_inventario_id);

-- ----------------------------------------------------------------------------
-- 3. Tabla admin.factura_anulacion (Snapshot Histórico Inmutable)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin.factura_anulacion (
    factura_anulacion_id                INT4 NOT NULL,
    factura_id                          INT4 NOT NULL,
    motivo_anulacion_factura_id         INT4 NULL,

    motivo_codigo_snapshot              VARCHAR(50) NOT NULL,
    motivo_snapshot                     VARCHAR(150) NOT NULL,
    motivo_descripcion_snapshot         VARCHAR(255) NULL,

    genera_movimiento_snapshot          BOOLEAN NOT NULL DEFAULT TRUE,
    tipo_movimiento_id_snapshot         INT4 NULL,
    tipo_movimiento_codigo_snapshot     VARCHAR(50) NULL,
    tipo_movimiento_nombre_snapshot     VARCHAR(100) NULL,
    tipo_movimiento_naturaleza_snapshot VARCHAR(20) NULL,

    destino_producto                    VARCHAR(30) NULL DEFAULT 'DISPONIBLE',
    observacion                         TEXT NULL,

    requiere_autorizacion_snapshot      BOOLEAN NOT NULL DEFAULT FALSE,
    usuario_autorizacion_id             INT4 NULL,

    fecha_anulacion                     TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    usuario_anulacion_id                INT4 NOT NULL,
    empresa_id                          INT4 NOT NULL,

    CONSTRAINT factura_anulacion_pk
        PRIMARY KEY (factura_anulacion_id),

    CONSTRAINT factura_anulacion_factura_uk
        UNIQUE (factura_id),

    CONSTRAINT factura_anulacion_factura_fk
        FOREIGN KEY (factura_id)
        REFERENCES admin.facturas(factura_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT factura_anulacion_motivo_fk
        FOREIGN KEY (motivo_anulacion_factura_id)
        REFERENCES admin.motivo_anulacion_factura(motivo_anulacion_factura_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT factura_anulacion_usuario_anul_fk
        FOREIGN KEY (usuario_anulacion_id)
        REFERENCES admin.usuario(usuario_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT factura_anulacion_usuario_aut_fk
        FOREIGN KEY (usuario_autorizacion_id)
        REFERENCES admin.usuario(usuario_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT factura_anulacion_empresa_fk
        FOREIGN KEY (empresa_id)
        REFERENCES admin.empresa(empresa_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- Secuencia para factura_anulacion_id
CREATE SEQUENCE IF NOT EXISTS admin.factura_anulacion_factura_anulacion_id_seq;
ALTER SEQUENCE admin.factura_anulacion_factura_anulacion_id_seq OWNED BY admin.factura_anulacion.factura_anulacion_id;
ALTER TABLE admin.factura_anulacion
    ALTER COLUMN factura_anulacion_id SET DEFAULT nextval('admin.factura_anulacion_factura_anulacion_id_seq');

CREATE INDEX IF NOT EXISTS idx_factura_anulacion_empresa ON admin.factura_anulacion(empresa_id);

-- ----------------------------------------------------------------------------
-- 4. Sembrado de Catálogo Inicial de Motivos
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_dev_venta_id INTEGER;
BEGIN
    SELECT tipo_movimiento_id INTO v_dev_venta_id
    FROM admin.tipo_movimiento_inventario
    WHERE UPPER(TRIM(codigo)) = 'DEV_VENTA'
    LIMIT 1;

    -- 1. ERROR_FACTURACION
    INSERT INTO admin.motivo_anulacion_factura (
        motivo_anulacion_factura_id, codigo, motivo_anulacion, descripcion,
        genera_movimiento, tipo_movimiento_id, requiere_observacion, requiere_autorizacion, estado
    ) VALUES (
        1, 'ERROR_FACTURACION', 'Error de facturación', 'Error en montos, cliente o conceptos emitidos en la factura.',
        TRUE, v_dev_venta_id, TRUE, FALSE, 'ACTIVO'
    ) ON CONFLICT (codigo) DO UPDATE
    SET motivo_anulacion = EXCLUDED.motivo_anulacion,
        descripcion = EXCLUDED.descripcion,
        genera_movimiento = EXCLUDED.genera_movimiento,
        tipo_movimiento_id = EXCLUDED.tipo_movimiento_id,
        requiere_observacion = EXCLUDED.requiere_observacion;

    -- 2. CLIENTE_DESISTE
    INSERT INTO admin.motivo_anulacion_factura (
        motivo_anulacion_factura_id, codigo, motivo_anulacion, descripcion,
        genera_movimiento, tipo_movimiento_id, requiere_observacion, requiere_autorizacion, estado
    ) VALUES (
        2, 'CLIENTE_DESISTE', 'Cliente desiste de la compra', 'El cliente decide no concretar la compra antes de retirar o procesar la entrega.',
        TRUE, v_dev_venta_id, FALSE, FALSE, 'ACTIVO'
    ) ON CONFLICT (codigo) DO UPDATE
    SET motivo_anulacion = EXCLUDED.motivo_anulacion,
        descripcion = EXCLUDED.descripcion,
        genera_movimiento = EXCLUDED.genera_movimiento,
        tipo_movimiento_id = EXCLUDED.tipo_movimiento_id,
        requiere_observacion = EXCLUDED.requiere_observacion;

    -- 3. PRODUCTO_INCORRECTO
    INSERT INTO admin.motivo_anulacion_factura (
        motivo_anulacion_factura_id, codigo, motivo_anulacion, descripcion,
        genera_movimiento, tipo_movimiento_id, requiere_observacion, requiere_autorizacion, estado
    ) VALUES (
        3, 'PRODUCTO_INCORRECTO', 'Producto facturado incorrectamente', 'Se despachó o seleccionó un ítem no correspondiente al pedido real.',
        TRUE, v_dev_venta_id, TRUE, FALSE, 'ACTIVO'
    ) ON CONFLICT (codigo) DO UPDATE
    SET motivo_anulacion = EXCLUDED.motivo_anulacion,
        descripcion = EXCLUDED.descripcion,
        genera_movimiento = EXCLUDED.genera_movimiento,
        tipo_movimiento_id = EXCLUDED.tipo_movimiento_id,
        requiere_observacion = EXCLUDED.requiere_observacion;

    -- 4. FACTURA_DUPLICADA
    INSERT INTO admin.motivo_anulacion_factura (
        motivo_anulacion_factura_id, codigo, motivo_anulacion, descripcion,
        genera_movimiento, tipo_movimiento_id, requiere_observacion, requiere_autorizacion, estado
    ) VALUES (
        4, 'FACTURA_DUPLICADA', 'Factura duplicada', 'Emisión repetida o duplicada accidentalmente de una misma transacción.',
        TRUE, v_dev_venta_id, TRUE, TRUE, 'ACTIVO'
    ) ON CONFLICT (codigo) DO UPDATE
    SET motivo_anulacion = EXCLUDED.motivo_anulacion,
        descripcion = EXCLUDED.descripcion,
        genera_movimiento = EXCLUDED.genera_movimiento,
        tipo_movimiento_id = EXCLUDED.tipo_movimiento_id,
        requiere_observacion = EXCLUDED.requiere_observacion,
        requiere_autorizacion = EXCLUDED.requiere_autorizacion;

    -- 5. CAMBIO_FORMA_PAGO
    -- REGLA: Para corregir únicamente la forma de pago se recomienda modificar/revertir el pago.
    -- Si se anula la factura físicamente, se compensa el inventario para evitar doble salida en la refacturación.
    INSERT INTO admin.motivo_anulacion_factura (
        motivo_anulacion_factura_id, codigo, motivo_anulacion, descripcion,
        genera_movimiento, tipo_movimiento_id, requiere_observacion, requiere_autorizacion, estado
    ) VALUES (
        5, 'CAMBIO_FORMA_PAGO', 'Cambio de forma de pago', 'Cambio en la condición o medio de pago (compensa inventario de productos para evitar duplicidad al refacturar).',
        TRUE, v_dev_venta_id, TRUE, FALSE, 'ACTIVO'
    ) ON CONFLICT (codigo) DO UPDATE
    SET motivo_anulacion = EXCLUDED.motivo_anulacion,
        descripcion = EXCLUDED.descripcion,
        genera_movimiento = EXCLUDED.genera_movimiento,
        tipo_movimiento_id = EXCLUDED.tipo_movimiento_id,
        requiere_observacion = EXCLUDED.requiere_observacion;

    -- 6. AJUSTE_ADMINISTRATIVO (Sin movimiento de inventario)
    INSERT INTO admin.motivo_anulacion_factura (
        motivo_anulacion_factura_id, codigo, motivo_anulacion, descripcion,
        genera_movimiento, tipo_movimiento_id, requiere_observacion, requiere_autorizacion, estado
    ) VALUES (
        6, 'AJUSTE_ADMINISTRATIVO', 'Ajuste administrativo / fiscal sin movimiento', 'Corrección contable o fiscal que no requiere alteración física del stock en almacén.',
        FALSE, NULL, TRUE, TRUE, 'ACTIVO'
    ) ON CONFLICT (codigo) DO UPDATE
    SET motivo_anulacion = EXCLUDED.motivo_anulacion,
        descripcion = EXCLUDED.descripcion,
        genera_movimiento = EXCLUDED.genera_movimiento,
        tipo_movimiento_id = EXCLUDED.tipo_movimiento_id,
        requiere_observacion = EXCLUDED.requiere_observacion,
        requiere_autorizacion = EXCLUDED.requiere_autorizacion;
END $$;

-- Sincronizar secuencias con MAX
SELECT setval(
    'admin.motivo_anulacion_factura_motivo_anulacion_factura_id_seq',
    COALESCE((SELECT MAX(motivo_anulacion_factura_id) FROM admin.motivo_anulacion_factura), 1),
    (SELECT MAX(motivo_anulacion_factura_id) FROM admin.motivo_anulacion_factura) IS NOT NULL
);

SELECT setval(
    'admin.factura_anulacion_factura_anulacion_id_seq',
    COALESCE((SELECT MAX(factura_anulacion_id) FROM admin.factura_anulacion), 1),
    (SELECT MAX(factura_anulacion_id) FROM admin.factura_anulacion) IS NOT NULL
);

COMMIT;
