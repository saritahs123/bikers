-- ============================================================================
-- MIGRATION: 025_billing_base_model.sql
-- MODULE: Facturación (FAC-1 — Modelo de Datos y Motor Base)
-- DESCRIPTION:
--   1. Crea catálogo admin.tipo_factura (VENTA_DIRECTA, ORDEN_TRABAJO).
--   2. Crea catálogo admin.tipo_pago (EFECTIVO, TARJETA, TRANSFERENCIA).
--   3. Crea tabla admin.facturas con estados BORRADOR, PENDIENTE, PARCIAL, PAGADA, ANULADA.
--   4. Agrega índice único condicional (empresa_id, orden_trabajo_id) WHERE orden_trabajo_id IS NOT NULL AND estado <> 'ANULADA'
--      para prevenir doble facturación activa de una Orden de Trabajo.
--   5. Crea tabla admin.detalle_factura con tipo_linea (PRODUCTO, SERVICIO, REPUESTO) y snapshot inmutable.
--   6. Crea tabla admin.pagos para soporte de pagos múltiples y trazabilidad de cobranza.
--   7. Configura código de sistema canónico ID 14 ('FACTURA', 'FAC') en admin.codigo_sistema
--      y actualiza función admin.provisionar_codigos_sistema_empresa(p_empresa_id).
--   8. Crea índices operativos y de integridad referencial multitenant.
-- IDEMPOTENT: Sí
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Catálogo admin.tipo_factura
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin.tipo_factura (
    tipo_factura_id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    usuario_creacion_id INTEGER NULL
);

INSERT INTO admin.tipo_factura (codigo, nombre, descripcion, activo)
VALUES
    ('VENTA_DIRECTA', 'Venta Directa', 'Factura por venta directa en mostrador o tienda', true),
    ('ORDEN_TRABAJO', 'Orden de Trabajo', 'Factura generada desde una orden de trabajo de taller', true)
ON CONFLICT (codigo) DO UPDATE
SET nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    activo = EXCLUDED.activo;

-- ----------------------------------------------------------------------------
-- 2. Catálogo admin.tipo_pago
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin.tipo_pago (
    tipo_pago_id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO admin.tipo_pago (codigo, nombre, descripcion, activo)
VALUES
    ('EFECTIVO', 'Efectivo', 'Pago en efectivo', true),
    ('TARJETA', 'Tarjeta', 'Pago con tarjeta de débito o crédito', true),
    ('TRANSFERENCIA', 'Transferencia', 'Pago mediante transferencia bancaria', true)
ON CONFLICT (codigo) DO UPDATE
SET nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    activo = EXCLUDED.activo;

-- ----------------------------------------------------------------------------
-- 3. Tabla admin.facturas
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin.facturas (
    factura_id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    codigo_factura VARCHAR(50) NOT NULL,
    numero_factura VARCHAR(50) NULL,
    tipo_factura_id INTEGER NOT NULL,
    cliente_id INTEGER NULL,
    orden_trabajo_id INTEGER NULL,
    fecha_factura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    descuento NUMERIC(12, 2) NOT NULL DEFAULT 0,
    descuento_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    impuesto NUMERIC(12, 2) NOT NULL DEFAULT 0,
    impuesto_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_factura NUMERIC(12, 2) NOT NULL DEFAULT 0,
    monto_pagado NUMERIC(12, 2) NOT NULL DEFAULT 0,
    balance_pendiente NUMERIC(12, 2) NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
    observacion TEXT NULL,
    usuario_creacion_id INTEGER NOT NULL DEFAULT 1,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    usuario_modificacion_id INTEGER NULL,
    fecha_modificacion TIMESTAMPTZ NULL
);

-- Migración de columnas adicionales en admin.facturas si la tabla ya existía
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'codigo_factura') THEN
        ALTER TABLE admin.facturas ADD COLUMN codigo_factura VARCHAR(50);
        UPDATE admin.facturas SET codigo_factura = numero_factura WHERE codigo_factura IS NULL AND numero_factura IS NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'numero_factura') THEN
        ALTER TABLE admin.facturas ADD COLUMN numero_factura VARCHAR(50);
        UPDATE admin.facturas SET numero_factura = codigo_factura WHERE numero_factura IS NULL AND codigo_factura IS NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'empresa_id') THEN
        ALTER TABLE admin.facturas ADD COLUMN empresa_id INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'tipo_factura_id') THEN
        ALTER TABLE admin.facturas ADD COLUMN tipo_factura_id INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'descuento') THEN
        ALTER TABLE admin.facturas ADD COLUMN descuento NUMERIC(12, 2) DEFAULT 0;
        UPDATE admin.facturas SET descuento = descuento_total WHERE descuento IS NULL AND descuento_total IS NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'descuento_total') THEN
        ALTER TABLE admin.facturas ADD COLUMN descuento_total NUMERIC(12, 2) DEFAULT 0;
        UPDATE admin.facturas SET descuento_total = descuento WHERE descuento_total IS NULL AND descuento IS NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'impuesto') THEN
        ALTER TABLE admin.facturas ADD COLUMN impuesto NUMERIC(12, 2) DEFAULT 0;
        UPDATE admin.facturas SET impuesto = impuesto_total WHERE impuesto IS NULL AND impuesto_total IS NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'impuesto_total') THEN
        ALTER TABLE admin.facturas ADD COLUMN impuesto_total NUMERIC(12, 2) DEFAULT 0;
        UPDATE admin.facturas SET impuesto_total = impuesto WHERE impuesto_total IS NULL AND impuesto IS NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'total') THEN
        ALTER TABLE admin.facturas ADD COLUMN total NUMERIC(12, 2) DEFAULT 0;
        UPDATE admin.facturas SET total = total_factura WHERE total IS NULL AND total_factura IS NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'total_factura') THEN
        ALTER TABLE admin.facturas ADD COLUMN total_factura NUMERIC(12, 2) DEFAULT 0;
        UPDATE admin.facturas SET total_factura = total WHERE total_factura IS NULL AND total IS NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'observacion') THEN
        ALTER TABLE admin.facturas ADD COLUMN observacion TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'usuario_creacion_id') THEN
        ALTER TABLE admin.facturas ADD COLUMN usuario_creacion_id INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'usuario_modificacion_id') THEN
        ALTER TABLE admin.facturas ADD COLUMN usuario_modificacion_id INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'fecha_creacion') THEN
        ALTER TABLE admin.facturas ADD COLUMN fecha_creacion TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'facturas' AND column_name = 'fecha_modificacion') THEN
        ALTER TABLE admin.facturas ADD COLUMN fecha_modificacion TIMESTAMPTZ;
    END IF;
END $$;

-- Check constraint en admin.facturas.estado
DO $$
BEGIN
    ALTER TABLE admin.facturas DROP CONSTRAINT IF EXISTS chk_facturas_estado;
    ALTER TABLE admin.facturas ADD CONSTRAINT chk_facturas_estado
        CHECK (estado IN ('BORRADOR', 'PENDIENTE', 'PARCIAL', 'PAGADA', 'ANULADA', 'EMITIDA'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Foreign Keys en admin.facturas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_facturas_empresa') THEN
        ALTER TABLE admin.facturas ADD CONSTRAINT fk_facturas_empresa FOREIGN KEY (empresa_id) REFERENCES admin.empresa(empresa_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_facturas_tipo_factura') THEN
        ALTER TABLE admin.facturas ADD CONSTRAINT fk_facturas_tipo_factura FOREIGN KEY (tipo_factura_id) REFERENCES admin.tipo_factura(tipo_factura_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_facturas_cliente') THEN
        ALTER TABLE admin.facturas ADD CONSTRAINT fk_facturas_cliente FOREIGN KEY (cliente_id) REFERENCES admin.clientes(cliente_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_facturas_orden_trabajo') THEN
        ALTER TABLE admin.facturas ADD CONSTRAINT fk_facturas_orden_trabajo FOREIGN KEY (orden_trabajo_id) REFERENCES admin.ordenes_trabajo(orden_trabajo_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_facturas_usuario_creacion') THEN
        ALTER TABLE admin.facturas ADD CONSTRAINT fk_facturas_usuario_creacion FOREIGN KEY (usuario_creacion_id) REFERENCES admin.usuario(usuario_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_facturas_usuario_modificacion') THEN
        ALTER TABLE admin.facturas ADD CONSTRAINT fk_facturas_usuario_modificacion FOREIGN KEY (usuario_modificacion_id) REFERENCES admin.usuario(usuario_id);
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Restricción para evitar doble facturación activa de OT
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_facturas_empresa_orden_activa
ON admin.facturas (empresa_id, orden_trabajo_id)
WHERE orden_trabajo_id IS NOT NULL AND estado <> 'ANULADA';

-- ----------------------------------------------------------------------------
-- 5. Tabla admin.detalle_factura
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin.detalle_factura (
    detalle_factura_id SERIAL PRIMARY KEY,
    factura_id INTEGER NOT NULL REFERENCES admin.facturas(factura_id) ON DELETE CASCADE,
    tipo_linea VARCHAR(20) NOT NULL DEFAULT 'PRODUCTO',
    tipo_detalle VARCHAR(20) NULL,
    producto_id INTEGER NULL,
    tipo_servicio_id INTEGER NULL,
    orden_servicio_id INTEGER NULL,
    orden_producto_id INTEGER NULL,
    codigo VARCHAR(50) NULL,
    descripcion VARCHAR(255) NOT NULL,
    cantidad NUMERIC(12, 2) NOT NULL DEFAULT 1,
    precio_unitario NUMERIC(12, 2) NOT NULL DEFAULT 0,
    descuento NUMERIC(12, 2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    costo_unitario NUMERIC(12, 2) NULL,
    usuario_creacion_id INTEGER NOT NULL DEFAULT 1,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migración de columnas adicionales en admin.detalle_factura si ya existía
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'detalle_factura' AND column_name = 'tipo_linea') THEN
        ALTER TABLE admin.detalle_factura ADD COLUMN tipo_linea VARCHAR(20) DEFAULT 'PRODUCTO';
        UPDATE admin.detalle_factura SET tipo_linea = tipo_detalle WHERE tipo_linea IS NULL AND tipo_detalle IS NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'detalle_factura' AND column_name = 'tipo_detalle') THEN
        ALTER TABLE admin.detalle_factura ADD COLUMN tipo_detalle VARCHAR(20) DEFAULT 'PRODUCTO';
        UPDATE admin.detalle_factura SET tipo_detalle = tipo_linea WHERE tipo_detalle IS NULL AND tipo_linea IS NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'detalle_factura' AND column_name = 'tipo_servicio_id') THEN
        ALTER TABLE admin.detalle_factura ADD COLUMN tipo_servicio_id INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'detalle_factura' AND column_name = 'orden_servicio_id') THEN
        ALTER TABLE admin.detalle_factura ADD COLUMN orden_servicio_id INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'detalle_factura' AND column_name = 'orden_producto_id') THEN
        ALTER TABLE admin.detalle_factura ADD COLUMN orden_producto_id INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'detalle_factura' AND column_name = 'codigo') THEN
        ALTER TABLE admin.detalle_factura ADD COLUMN codigo VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'detalle_factura' AND column_name = 'costo_unitario') THEN
        ALTER TABLE admin.detalle_factura ADD COLUMN costo_unitario NUMERIC(12, 2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'detalle_factura' AND column_name = 'usuario_creacion_id') THEN
        ALTER TABLE admin.detalle_factura ADD COLUMN usuario_creacion_id INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'detalle_factura' AND column_name = 'fecha_creacion') THEN
        ALTER TABLE admin.detalle_factura ADD COLUMN fecha_creacion TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Check constraint en admin.detalle_factura.tipo_linea
DO $$
BEGIN
    ALTER TABLE admin.detalle_factura DROP CONSTRAINT IF EXISTS chk_detalle_factura_tipo_linea;
    ALTER TABLE admin.detalle_factura ADD CONSTRAINT chk_detalle_factura_tipo_linea
        CHECK (tipo_linea IN ('PRODUCTO', 'SERVICIO', 'REPUESTO', 'MANO_OBRA'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Foreign Keys en admin.detalle_factura
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_detalle_factura_producto') THEN
        ALTER TABLE admin.detalle_factura ADD CONSTRAINT fk_detalle_factura_producto FOREIGN KEY (producto_id) REFERENCES admin.productos(producto_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_detalle_factura_tipo_servicio') THEN
        ALTER TABLE admin.detalle_factura ADD CONSTRAINT fk_detalle_factura_tipo_servicio FOREIGN KEY (tipo_servicio_id) REFERENCES admin.tipo_servicio(tipo_servicio_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_detalle_factura_orden_servicio') THEN
        ALTER TABLE admin.detalle_factura ADD CONSTRAINT fk_detalle_factura_orden_servicio FOREIGN KEY (orden_servicio_id) REFERENCES admin.orden_servicios(orden_servicio_id);
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 6. Tabla admin.pagos
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin.pagos (
    pago_id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    factura_id INTEGER NOT NULL REFERENCES admin.facturas(factura_id) ON DELETE CASCADE,
    tipo_pago_id INTEGER NOT NULL REFERENCES admin.tipo_pago(tipo_pago_id),
    monto NUMERIC(12, 2) NOT NULL,
    monto_pago NUMERIC(12, 2) NULL,
    referencia VARCHAR(100) NULL,
    observacion TEXT NULL,
    fecha_pago TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    estado VARCHAR(20) NOT NULL DEFAULT 'APLICADO',
    usuario_id INTEGER NOT NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migración de columnas adicionales en admin.pagos si ya existía
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'pagos' AND column_name = 'empresa_id') THEN
        ALTER TABLE admin.pagos ADD COLUMN empresa_id INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'pagos' AND column_name = 'monto') THEN
        ALTER TABLE admin.pagos ADD COLUMN monto NUMERIC(12, 2);
        UPDATE admin.pagos SET monto = monto_pago WHERE monto IS NULL AND monto_pago IS NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'pagos' AND column_name = 'monto_pago') THEN
        ALTER TABLE admin.pagos ADD COLUMN monto_pago NUMERIC(12, 2);
        UPDATE admin.pagos SET monto_pago = monto WHERE monto_pago IS NULL AND monto IS NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'pagos' AND column_name = 'tipo_pago_id') THEN
        ALTER TABLE admin.pagos ADD COLUMN tipo_pago_id INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'pagos' AND column_name = 'referencia') THEN
        ALTER TABLE admin.pagos ADD COLUMN referencia VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'pagos' AND column_name = 'observacion') THEN
        ALTER TABLE admin.pagos ADD COLUMN observacion TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'pagos' AND column_name = 'fecha_pago') THEN
        ALTER TABLE admin.pagos ADD COLUMN fecha_pago TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'pagos' AND column_name = 'estado') THEN
        ALTER TABLE admin.pagos ADD COLUMN estado VARCHAR(20) DEFAULT 'APLICADO';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'pagos' AND column_name = 'usuario_id') THEN
        ALTER TABLE admin.pagos ADD COLUMN usuario_id INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'admin' AND table_name = 'pagos' AND column_name = 'fecha_creacion') THEN
        ALTER TABLE admin.pagos ADD COLUMN fecha_creacion TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Check constraint en admin.pagos.monto
DO $$
BEGIN
    ALTER TABLE admin.pagos DROP CONSTRAINT IF EXISTS chk_pagos_monto_positivo;
    ALTER TABLE admin.pagos ADD CONSTRAINT chk_pagos_monto_positivo CHECK (monto > 0);
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Foreign Keys en admin.pagos
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pagos_empresa') THEN
        ALTER TABLE admin.pagos ADD CONSTRAINT fk_pagos_empresa FOREIGN KEY (empresa_id) REFERENCES admin.empresa(empresa_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pagos_tipo_pago') THEN
        ALTER TABLE admin.pagos ADD CONSTRAINT fk_pagos_tipo_pago FOREIGN KEY (tipo_pago_id) REFERENCES admin.tipo_pago(tipo_pago_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pagos_usuario') THEN
        ALTER TABLE admin.pagos ADD CONSTRAINT fk_pagos_usuario FOREIGN KEY (usuario_id) REFERENCES admin.usuario(usuario_id);
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 7. Índices de Rendimiento e Integridad
-- ----------------------------------------------------------------------------
-- facturas:
CREATE INDEX IF NOT EXISTS idx_facturas_empresa_id ON admin.facturas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_facturas_codigo_factura ON admin.facturas (codigo_factura);
CREATE INDEX IF NOT EXISTS idx_facturas_cliente_id ON admin.facturas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_facturas_orden_trabajo_id ON admin.facturas (orden_trabajo_id);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha_factura ON admin.facturas (fecha_factura);
CREATE INDEX IF NOT EXISTS idx_facturas_estado ON admin.facturas (estado);

-- detalle_factura:
CREATE INDEX IF NOT EXISTS idx_detalle_factura_factura_id ON admin.detalle_factura (factura_id);
CREATE INDEX IF NOT EXISTS idx_detalle_factura_producto_id ON admin.detalle_factura (producto_id);
CREATE INDEX IF NOT EXISTS idx_detalle_factura_orden_servicio_id ON admin.detalle_factura (orden_servicio_id);
CREATE INDEX IF NOT EXISTS idx_detalle_factura_orden_producto_id ON admin.detalle_factura (orden_producto_id);

-- pagos:
CREATE INDEX IF NOT EXISTS idx_pagos_factura_id ON admin.pagos (factura_id);
CREATE INDEX IF NOT EXISTS idx_pagos_empresa_id ON admin.pagos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha_pago ON admin.pagos (fecha_pago);
CREATE INDEX IF NOT EXISTS idx_pagos_tipo_pago_id ON admin.pagos (tipo_pago_id);

-- ----------------------------------------------------------------------------
-- 8. Código de Sistema 14 (FACTURA - 'FAC') y Aprovisionamiento Multitenant
-- ----------------------------------------------------------------------------
INSERT INTO admin.codigo_sistema (
    codigo_sistema_id,
    empresa_id,
    tipo_transaccion,
    prefijo,
    periodo,
    ultimo_numero,
    longitud_numero,
    activo,
    es_catalogo,
    fecha_creacion,
    fecha_actualizacion
)
SELECT
    14,
    e.empresa_id,
    'FACTURA',
    'FAC',
    TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santo_Domingo', 'YYYYMM'),
    0,
    6,
    true,
    false,
    NOW(),
    NOW()
FROM admin.empresa e
ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;

-- Actualizar función admin.provisionar_codigos_sistema_empresa
CREATE OR REPLACE FUNCTION admin.provisionar_codigos_sistema_empresa(p_empresa_id integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_periodo_actual CHAR(6);
BEGIN
    v_periodo_actual := TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santo_Domingo', 'YYYYMM');

    -- 5: ENTRADA_INVENTARIO
    INSERT INTO admin.codigo_sistema (
        codigo_sistema_id, empresa_id, tipo_transaccion, prefijo, periodo, ultimo_numero, longitud_numero, activo, es_catalogo
    ) VALUES (
        5, p_empresa_id, 'ENTRADA_INVENTARIO', 'EI', v_periodo_actual, 0, 6, true, false
    ) ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;

    -- 6: SALIDA_INVENTARIO
    INSERT INTO admin.codigo_sistema (
        codigo_sistema_id, empresa_id, tipo_transaccion, prefijo, periodo, ultimo_numero, longitud_numero, activo, es_catalogo
    ) VALUES (
        6, p_empresa_id, 'SALIDA_INVENTARIO', 'SI', v_periodo_actual, 0, 6, true, false
    ) ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;

    -- 7: AJUSTE_POSITIVO_INVENTARIO
    INSERT INTO admin.codigo_sistema (
        codigo_sistema_id, empresa_id, tipo_transaccion, prefijo, periodo, ultimo_numero, longitud_numero, activo, es_catalogo
    ) VALUES (
        7, p_empresa_id, 'AJUSTE_POSITIVO_INVENTARIO', 'API', v_periodo_actual, 0, 6, true, false
    ) ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;

    -- 8: AJUSTE_NEGATIVO_INVENTARIO
    INSERT INTO admin.codigo_sistema (
        codigo_sistema_id, empresa_id, tipo_transaccion, prefijo, periodo, ultimo_numero, longitud_numero, activo, es_catalogo
    ) VALUES (
        8, p_empresa_id, 'AJUSTE_NEGATIVO_INVENTARIO', 'ANI', v_periodo_actual, 0, 6, true, false
    ) ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;

    -- 9: TRANSFERENCIA_INVENTARIO
    INSERT INTO admin.codigo_sistema (
        codigo_sistema_id, empresa_id, tipo_transaccion, prefijo, periodo, ultimo_numero, longitud_numero, activo, es_catalogo
    ) VALUES (
        9, p_empresa_id, 'TRANSFERENCIA_INVENTARIO', 'TRFI', v_periodo_actual, 0, 6, true, false
    ) ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;

    -- 10: INVENTARIO_INCIAL
    INSERT INTO admin.codigo_sistema (
        codigo_sistema_id, empresa_id, tipo_transaccion, prefijo, periodo, ultimo_numero, longitud_numero, activo, es_catalogo
    ) VALUES (
        10, p_empresa_id, 'INVENTARIO_INCIAL', 'INVI', v_periodo_actual, 0, 6, true, false
    ) ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;

    -- 12: CONSUMO_REPUESTO_TALLER
    INSERT INTO admin.codigo_sistema (
        codigo_sistema_id, empresa_id, tipo_transaccion, prefijo, periodo, ultimo_numero, longitud_numero, activo, es_catalogo
    ) VALUES (
        12, p_empresa_id, 'CONSUMO_REPUESTO_TALLER', 'CRT', v_periodo_actual, 0, 6, true, false
    ) ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;

    -- 13: DEVOLUCION_REPUESTO_TALLER
    INSERT INTO admin.codigo_sistema (
        codigo_sistema_id, empresa_id, tipo_transaccion, prefijo, periodo, ultimo_numero, longitud_numero, activo, es_catalogo
    ) VALUES (
        13, p_empresa_id, 'DEVOLUCION_REPUESTO_TALLER', 'DRT', v_periodo_actual, 0, 6, true, false
    ) ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;

    -- 14: FACTURA
    INSERT INTO admin.codigo_sistema (
        codigo_sistema_id, empresa_id, tipo_transaccion, prefijo, periodo, ultimo_numero, longitud_numero, activo, es_catalogo
    ) VALUES (
        14, p_empresa_id, 'FACTURA', 'FAC', v_periodo_actual, 0, 6, true, false
    ) ON CONFLICT (empresa_id, codigo_sistema_id) DO NOTHING;
END;
$function$;

COMMIT;
