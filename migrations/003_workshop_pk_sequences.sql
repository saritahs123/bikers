-- ============================================================================
-- MIGRATION: 003_workshop_pk_sequences.sql
-- DESCRIPTION: Creation, association, default assignment and synchronization
--              of PostgreSQL sequences for transactional workshop (Taller) tables.
-- IDEMPOTENT: Yes (CREATE SEQUENCE IF NOT EXISTS, ALTER COLUMN SET DEFAULT, setval sync)
-- ============================================================================

-- 1. admin.recepciones (recepcion_id)
CREATE SEQUENCE IF NOT EXISTS admin.recepciones_recepcion_id_seq;
ALTER SEQUENCE admin.recepciones_recepcion_id_seq OWNED BY admin.recepciones.recepcion_id;
ALTER TABLE admin.recepciones ALTER COLUMN recepcion_id SET DEFAULT nextval('admin.recepciones_recepcion_id_seq');
SELECT setval(
  'admin.recepciones_recepcion_id_seq',
  COALESCE((SELECT MAX(recepcion_id) FROM admin.recepciones), 1),
  (SELECT MAX(recepcion_id) FROM admin.recepciones) IS NOT NULL
);

-- 2. admin.recepcion_checklist (recepcion_checklist_id)
CREATE SEQUENCE IF NOT EXISTS admin.recepcion_checklist_recepcion_checklist_id_seq;
ALTER SEQUENCE admin.recepcion_checklist_recepcion_checklist_id_seq OWNED BY admin.recepcion_checklist.recepcion_checklist_id;
ALTER TABLE admin.recepcion_checklist ALTER COLUMN recepcion_checklist_id SET DEFAULT nextval('admin.recepcion_checklist_recepcion_checklist_id_seq');
SELECT setval(
  'admin.recepcion_checklist_recepcion_checklist_id_seq',
  COALESCE((SELECT MAX(recepcion_checklist_id) FROM admin.recepcion_checklist), 1),
  (SELECT MAX(recepcion_checklist_id) FROM admin.recepcion_checklist) IS NOT NULL
);

-- 3. admin.firma_recepcion (firma_recepcion_id)
CREATE SEQUENCE IF NOT EXISTS admin.firma_recepcion_firma_recepcion_id_seq;
ALTER SEQUENCE admin.firma_recepcion_firma_recepcion_id_seq OWNED BY admin.firma_recepcion.firma_recepcion_id;
ALTER TABLE admin.firma_recepcion ALTER COLUMN firma_recepcion_id SET DEFAULT nextval('admin.firma_recepcion_firma_recepcion_id_seq');
SELECT setval(
  'admin.firma_recepcion_firma_recepcion_id_seq',
  COALESCE((SELECT MAX(firma_recepcion_id) FROM admin.firma_recepcion), 1),
  (SELECT MAX(firma_recepcion_id) FROM admin.firma_recepcion) IS NOT NULL
);

-- 4. admin.ordenes_trabajo (orden_trabajo_id)
CREATE SEQUENCE IF NOT EXISTS admin.ordenes_trabajo_orden_trabajo_id_seq;
ALTER SEQUENCE admin.ordenes_trabajo_orden_trabajo_id_seq OWNED BY admin.ordenes_trabajo.orden_trabajo_id;
ALTER TABLE admin.ordenes_trabajo ALTER COLUMN orden_trabajo_id SET DEFAULT nextval('admin.ordenes_trabajo_orden_trabajo_id_seq');
SELECT setval(
  'admin.ordenes_trabajo_orden_trabajo_id_seq',
  COALESCE((SELECT MAX(orden_trabajo_id) FROM admin.ordenes_trabajo), 1),
  (SELECT MAX(orden_trabajo_id) FROM admin.ordenes_trabajo) IS NOT NULL
);

-- 5. admin.orden_historial_estado (orden_historial_estado_id)
CREATE SEQUENCE IF NOT EXISTS admin.orden_historial_estado_orden_historial_estado_id_seq;
ALTER SEQUENCE admin.orden_historial_estado_orden_historial_estado_id_seq OWNED BY admin.orden_historial_estado.orden_historial_estado_id;
ALTER TABLE admin.orden_historial_estado ALTER COLUMN orden_historial_estado_id SET DEFAULT nextval('admin.orden_historial_estado_orden_historial_estado_id_seq');
SELECT setval(
  'admin.orden_historial_estado_orden_historial_estado_id_seq',
  COALESCE((SELECT MAX(orden_historial_estado_id) FROM admin.orden_historial_estado), 1),
  (SELECT MAX(orden_historial_estado_id) FROM admin.orden_historial_estado) IS NOT NULL
);

-- 6. admin.orden_servicios (orden_servicio_id)
CREATE SEQUENCE IF NOT EXISTS admin.orden_servicios_orden_servicio_id_seq;
ALTER SEQUENCE admin.orden_servicios_orden_servicio_id_seq OWNED BY admin.orden_servicios.orden_servicio_id;
ALTER TABLE admin.orden_servicios ALTER COLUMN orden_servicio_id SET DEFAULT nextval('admin.orden_servicios_orden_servicio_id_seq');
SELECT setval(
  'admin.orden_servicios_orden_servicio_id_seq',
  COALESCE((SELECT MAX(orden_servicio_id) FROM admin.orden_servicios), 1),
  (SELECT MAX(orden_servicio_id) FROM admin.orden_servicios) IS NOT NULL
);

-- 7. admin.orden_servicio_mano_obra (orden_servicio_mano_obra_id)
CREATE SEQUENCE IF NOT EXISTS admin.orden_servicio_mano_obra_orden_servicio_mano_obra_id_seq;
ALTER SEQUENCE admin.orden_servicio_mano_obra_orden_servicio_mano_obra_id_seq OWNED BY admin.orden_servicio_mano_obra.orden_servicio_mano_obra_id;
ALTER TABLE admin.orden_servicio_mano_obra ALTER COLUMN orden_servicio_mano_obra_id SET DEFAULT nextval('admin.orden_servicio_mano_obra_orden_servicio_mano_obra_id_seq');
SELECT setval(
  'admin.orden_servicio_mano_obra_orden_servicio_mano_obra_id_seq',
  COALESCE((SELECT MAX(orden_servicio_mano_obra_id) FROM admin.orden_servicio_mano_obra), 1),
  (SELECT MAX(orden_servicio_mano_obra_id) FROM admin.orden_servicio_mano_obra) IS NOT NULL
);

-- 8. admin.orden_productos (orden_producto_id)
CREATE SEQUENCE IF NOT EXISTS admin.orden_productos_orden_producto_id_seq;
ALTER SEQUENCE admin.orden_productos_orden_producto_id_seq OWNED BY admin.orden_productos.orden_producto_id;
ALTER TABLE admin.orden_productos ALTER COLUMN orden_producto_id SET DEFAULT nextval('admin.orden_productos_orden_producto_id_seq');
SELECT setval(
  'admin.orden_productos_orden_producto_id_seq',
  COALESCE((SELECT MAX(orden_producto_id) FROM admin.orden_productos), 1),
  (SELECT MAX(orden_producto_id) FROM admin.orden_productos) IS NOT NULL
);

-- 9. admin.bicicleta_componentes (bicicleta_componente_id)
CREATE SEQUENCE IF NOT EXISTS admin.bicicleta_componentes_bicicleta_componente_id_seq;
ALTER SEQUENCE admin.bicicleta_componentes_bicicleta_componente_id_seq OWNED BY admin.bicicleta_componentes.bicicleta_componente_id;
ALTER TABLE admin.bicicleta_componentes ALTER COLUMN bicicleta_componente_id SET DEFAULT nextval('admin.bicicleta_componentes_bicicleta_componente_id_seq');
SELECT setval(
  'admin.bicicleta_componentes_bicicleta_componente_id_seq',
  COALESCE((SELECT MAX(bicicleta_componente_id) FROM admin.bicicleta_componentes), 1),
  (SELECT MAX(bicicleta_componente_id) FROM admin.bicicleta_componentes) IS NOT NULL
);
