-- Migration: 009_work_order_deletion_history.sql
-- Description: Independent historical evidence table for deleted work orders (0 PK, 0 FK, 0 UNIQUE, 0 CHECK, 0 INDEX, 0 NOT NULL)

CREATE TABLE IF NOT EXISTS admin.orden_trabajo_eliminada_historial (
    historial_uuid UUID DEFAULT gen_random_uuid(),

    orden_trabajo_id INTEGER,
    codigo_orden VARCHAR(100),

    recepcion_id INTEGER,
    codigo_recepcion VARCHAR(100),

    empresa_id INTEGER,

    cliente_id INTEGER,
    cliente_nombre VARCHAR(300),
    cliente_identificacion VARCHAR(100),
    cliente_telefono VARCHAR(100),
    cliente_correo VARCHAR(300),

    bicicleta_id INTEGER,
    bicicleta_descripcion VARCHAR(500),

    estado_orden_id INTEGER,
    estado_orden_codigo VARCHAR(100),
    estado_orden_nombre VARCHAR(200),

    prioridad_orden_id INTEGER,
    prioridad_codigo VARCHAR(100),
    prioridad_nombre VARCHAR(200),

    mecanico_id INTEGER,
    mecanico_nombre VARCHAR(300),

    diagnostico TEXT,
    observaciones TEXT,

    fecha_registro TIMESTAMPTZ,
    fecha_inicio TIMESTAMPTZ,
    fecha_finalizacion TIMESTAMPTZ,
    fecha_entrega_estimada TIMESTAMPTZ,
    fecha_entrega_real TIMESTAMPTZ,

    facturado BOOLEAN,

    subtotal NUMERIC,
    impuestos NUMERIC,
    descuento NUMERIC,
    total NUMERIC,

    datos_orden JSONB,
    datos_recepcion JSONB,
    datos_servicios JSONB,
    datos_mano_obra JSONB,
    datos_productos JSONB,
    datos_historial_estados JSONB,
    datos_checklist JSONB,
    datos_firma JSONB,
    datos_evidencias JSONB,
    datos_facturacion JSONB,
    datos_pagos JSONB,

    eliminado_por_usuario_id INTEGER,
    eliminado_por_nombre VARCHAR(300),

    motivo_eliminacion TEXT,

    fecha_eliminacion TIMESTAMPTZ DEFAULT NOW(),

    origen VARCHAR(100) DEFAULT 'RIDE_LAB'
);

COMMENT ON TABLE admin.orden_trabajo_eliminada_historial IS 'Tabla documental de evidencia histórica para órdenes de trabajo eliminadas. 100% desacoplada sin restricciones relacionales ni índices.';
