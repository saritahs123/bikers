-- ============================================================================
-- MIGRATION 042: MATRIZ DE ROLES Y ACCESOS ESPECÍFICOS POR PANTALLA Y REPORTE
-- ============================================================================

-- 1. Sincronizar catálogo canónico de módulos del sistema según el Sidebar real
DO $$
DECLARE
  v_next_mod_id INT;
  v_config_mod_id INT;
  v_next_matriz_id INT;
BEGIN
  -- Actualizar orden y estado de los módulos activos oficiales
  UPDATE admin.modulo_sistema SET orden = 1, estado = 'ACTIVO' WHERE UPPER(nombre) IN ('DASHBOARD', 'HOME');
  UPDATE admin.modulo_sistema SET orden = 2, estado = 'ACTIVO' WHERE UPPER(nombre) = 'TALLER';
  UPDATE admin.modulo_sistema SET orden = 3, estado = 'ACTIVO' WHERE UPPER(TRANSLATE(nombre, 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou')) = 'FACTURACION';
  UPDATE admin.modulo_sistema SET orden = 4, estado = 'ACTIVO' WHERE UPPER(nombre) = 'CRM';
  UPDATE admin.modulo_sistema SET orden = 5, estado = 'ACTIVO' WHERE UPPER(nombre) = 'INVENTARIO';
  UPDATE admin.modulo_sistema SET orden = 6, estado = 'ACTIVO' WHERE UPPER(nombre) = 'REPORTES';
  UPDATE admin.modulo_sistema SET orden = 8, estado = 'ACTIVO' WHERE UPPER(nombre) = 'SEGURIDAD';

  -- Desactivar de forma segura módulos obsoletos o internos para que no aparezcan en la matriz
  UPDATE admin.modulo_sistema 
  SET estado = 'INACTIVO' 
  WHERE UPPER(nombre) IN ('BICICLETA', 'RECEPCIÓN', 'DIAGNÓSTICO', 'CONTROL INVENTARIO', 'PORTAL CLIENTE', 'VENDEDOR', 'OTROS', 'ADFADFAD', 'JUAN');

  -- Asegurar existencia del módulo CONFIGURACIÓN
  SELECT modulo_sistema_id INTO v_config_mod_id 
  FROM admin.modulo_sistema 
  WHERE UPPER(TRANSLATE(nombre, 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou')) = 'CONFIGURACION';

  IF v_config_mod_id IS NULL THEN
    SELECT COALESCE(MAX(modulo_sistema_id), 0) + 1 INTO v_next_mod_id FROM admin.modulo_sistema;
    INSERT INTO admin.modulo_sistema (modulo_sistema_id, nombre, orden, estado, fecha_creacion, fecha_actualizacion)
    VALUES (v_next_mod_id, 'CONFIGURACIÓN', 7, 'ACTIVO', now(), now())
    RETURNING modulo_sistema_id INTO v_config_mod_id;
  ELSE
    UPDATE admin.modulo_sistema 
    SET nombre = 'CONFIGURACIÓN', orden = 7, estado = 'ACTIVO', fecha_actualizacion = now()
    WHERE modulo_sistema_id = v_config_mod_id;
  END IF;

  -- Otorgar accesos en matriz_acceso_rol a roles de administración para el módulo CONFIGURACIÓN si no existen
  FOR v_next_matriz_id IN 
    SELECT r.rol_funcional_id 
    FROM admin.rol_funcional r
    WHERE r.estado = 'ACTIVO'
      AND NOT EXISTS (
        SELECT 1 FROM admin.matriz_acceso_rol mar 
        WHERE mar.rol_funcional_id = r.rol_funcional_id AND mar.modulo_sistema_id = v_config_mod_id
      )
  LOOP
    INSERT INTO admin.matriz_acceso_rol (
      matriz_acceso_rol_id, rol_funcional_id, modulo_sistema_id,
      puede_ver, puede_crear, puede_editar, puede_inactivar, puede_exportar, puede_importar,
      puede_aprobar, puede_asignar, puede_mover, puede_cerrar, puede_reabrir, puede_eliminar,
      estado, fecha_creacion, fecha_actualizacion
    )
    SELECT
      (SELECT COALESCE(MAX(matriz_acceso_rol_id), 0) + 1 FROM admin.matriz_acceso_rol),
      v_next_matriz_id,
      v_config_mod_id,
      true, true, true, true, true, true,
      true, true, true, true, true, true,
      'ACTIVO', now(), now();
  END LOOP;
END $$;

-- 2. Tabla para pantallas y reportes individuales dentro de cada menú
CREATE TABLE IF NOT EXISTS admin.pantalla_sistema (
  pantalla_id SERIAL PRIMARY KEY,
  modulo_sistema_id INT NOT NULL REFERENCES admin.modulo_sistema(modulo_sistema_id) ON DELETE CASCADE,
  codigo VARCHAR(100) NOT NULL UNIQUE,
  nombre VARCHAR(150) NOT NULL,
  ruta VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL DEFAULT 'PANTALLA', -- 'PANTALLA' | 'REPORTE'
  orden INT NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pantalla_modulo ON admin.pantalla_sistema(modulo_sistema_id);
CREATE INDEX IF NOT EXISTS idx_pantalla_codigo ON admin.pantalla_sistema(codigo);
CREATE INDEX IF NOT EXISTS idx_pantalla_ruta ON admin.pantalla_sistema(ruta);

-- 3. Tabla para la matriz de acceso específica por pantalla / reporte por rol
CREATE TABLE IF NOT EXISTS admin.matriz_acceso_pantalla (
  matriz_pantalla_id SERIAL PRIMARY KEY,
  rol_funcional_id INT NOT NULL REFERENCES admin.rol_funcional(rol_funcional_id) ON DELETE CASCADE,
  pantalla_id INT NOT NULL REFERENCES admin.pantalla_sistema(pantalla_id) ON DELETE CASCADE,
  puede_ver BOOLEAN NULL,       -- NULL indica que HEREDA el valor del menú
  puede_crear BOOLEAN NULL,
  puede_editar BOOLEAN NULL,
  puede_inactivar BOOLEAN NULL,
  puede_exportar BOOLEAN NULL,
  puede_importar BOOLEAN NULL,
  puede_aprobar BOOLEAN NULL,
  puede_asignar BOOLEAN NULL,
  puede_mover BOOLEAN NULL,
  puede_cerrar BOOLEAN NULL,
  puede_reabrir BOOLEAN NULL,
  puede_eliminar BOOLEAN NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_matriz_acceso_pantalla UNIQUE (rol_funcional_id, pantalla_id)
);

CREATE INDEX IF NOT EXISTS idx_matriz_pantalla_rol ON admin.matriz_acceso_pantalla(rol_funcional_id);
CREATE INDEX IF NOT EXISTS idx_matriz_pantalla_pantalla ON admin.matriz_acceso_pantalla(pantalla_id);

-- 4. Registrar / Sincronizar catálogo real de pantallas y reportes del Sidebar
DO $$
DECLARE
  v_mod_home INT;
  v_mod_taller INT;
  v_mod_facturacion INT;
  v_mod_crm INT;
  v_mod_inventario INT;
  v_mod_reportes INT;
  v_mod_configuracion INT;
  v_mod_seguridad INT;
BEGIN
  SELECT modulo_sistema_id INTO v_mod_home FROM admin.modulo_sistema WHERE UPPER(nombre) IN ('DASHBOARD', 'HOME') LIMIT 1;
  SELECT modulo_sistema_id INTO v_mod_taller FROM admin.modulo_sistema WHERE UPPER(nombre) = 'TALLER' LIMIT 1;
  SELECT modulo_sistema_id INTO v_mod_facturacion FROM admin.modulo_sistema WHERE UPPER(TRANSLATE(nombre, 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou')) = 'FACTURACION' LIMIT 1;
  SELECT modulo_sistema_id INTO v_mod_crm FROM admin.modulo_sistema WHERE UPPER(nombre) = 'CRM' LIMIT 1;
  SELECT modulo_sistema_id INTO v_mod_inventario FROM admin.modulo_sistema WHERE UPPER(nombre) = 'INVENTARIO' LIMIT 1;
  SELECT modulo_sistema_id INTO v_mod_reportes FROM admin.modulo_sistema WHERE UPPER(nombre) = 'REPORTES' LIMIT 1;
  SELECT modulo_sistema_id INTO v_mod_configuracion FROM admin.modulo_sistema WHERE UPPER(TRANSLATE(nombre, 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou')) = 'CONFIGURACION' LIMIT 1;
  SELECT modulo_sistema_id INTO v_mod_seguridad FROM admin.modulo_sistema WHERE UPPER(nombre) = 'SEGURIDAD' LIMIT 1;

  -- HOME
  IF v_mod_home IS NOT NULL THEN
    INSERT INTO admin.pantalla_sistema (modulo_sistema_id, codigo, nombre, ruta, tipo, orden)
    VALUES (v_mod_home, 'DASHBOARD_MAIN', 'Dashboard Principal', '/', 'PANTALLA', 1)
    ON CONFLICT (codigo) DO UPDATE 
    SET nombre = EXCLUDED.nombre, ruta = EXCLUDED.ruta, modulo_sistema_id = EXCLUDED.modulo_sistema_id, orden = EXCLUDED.orden;
  END IF;

  -- TALLER
  IF v_mod_taller IS NOT NULL THEN
    INSERT INTO admin.pantalla_sistema (modulo_sistema_id, codigo, nombre, ruta, tipo, orden)
    VALUES 
      (v_mod_taller, 'TALLER_RECEPCIONES', 'Recepciones', '/workshop?view=list', 'PANTALLA', 1),
      (v_mod_taller, 'TALLER_ORDENES', 'Órdenes de Trabajo', '/workshop?view=work_orders', 'PANTALLA', 2),
      (v_mod_taller, 'TALLER_KANBAN', 'Vista Kanban', '/workshop?view=kanban', 'PANTALLA', 3)
    ON CONFLICT (codigo) DO UPDATE 
    SET nombre = EXCLUDED.nombre, ruta = EXCLUDED.ruta, modulo_sistema_id = EXCLUDED.modulo_sistema_id, orden = EXCLUDED.orden;
  END IF;

  -- FACTURACIÓN
  IF v_mod_facturacion IS NOT NULL THEN
    INSERT INTO admin.pantalla_sistema (modulo_sistema_id, codigo, nombre, ruta, tipo, orden)
    VALUES 
      (v_mod_facturacion, 'FACTURACION_NUEVA', 'Nueva Factura', '/billing/new', 'PANTALLA', 1),
      (v_mod_facturacion, 'FACTURACION_FACTURAS', 'Facturas Emitidas', '/billing/invoices', 'PANTALLA', 2),
      (v_mod_facturacion, 'FACTURACION_PAGOS', 'Cobros y Pagos', '/billing/payments', 'PANTALLA', 3),
      (v_mod_facturacion, 'FACTURACION_DESPACHO', 'Despacho de Órdenes', '/workshop?view=billing', 'PANTALLA', 4)
    ON CONFLICT (codigo) DO UPDATE 
    SET nombre = EXCLUDED.nombre, ruta = EXCLUDED.ruta, modulo_sistema_id = EXCLUDED.modulo_sistema_id, orden = EXCLUDED.orden;
  END IF;

  -- CRM
  IF v_mod_crm IS NOT NULL THEN
    INSERT INTO admin.pantalla_sistema (modulo_sistema_id, codigo, nombre, ruta, tipo, orden)
    VALUES 
      (v_mod_crm, 'CRM_CLIENTES', 'Clientes', '/crm/customers', 'PANTALLA', 1),
      (v_mod_crm, 'CRM_BICICLETAS', 'Bicicletas', '/crm/bicycles', 'PANTALLA', 2),
      (v_mod_crm, 'CRM_NIVELES_CLIENTES', 'Niveles de Clientes', '/crm/client-levels', 'PANTALLA', 3)
    ON CONFLICT (codigo) DO UPDATE 
    SET nombre = EXCLUDED.nombre, ruta = EXCLUDED.ruta, modulo_sistema_id = EXCLUDED.modulo_sistema_id, orden = EXCLUDED.orden;
  END IF;

  -- INVENTARIO
  IF v_mod_inventario IS NOT NULL THEN
    INSERT INTO admin.pantalla_sistema (modulo_sistema_id, codigo, nombre, ruta, tipo, orden)
    VALUES 
      (v_mod_inventario, 'INVENTARIO_RESUMEN', 'Resumen de Inventario', '/inventory/summary', 'PANTALLA', 1),
      (v_mod_inventario, 'INVENTARIO_EXISTENCIAS', 'Existencias y Stock', '/inventory/stock', 'PANTALLA', 2),
      (v_mod_inventario, 'INVENTARIO_MOVIMIENTOS', 'Kardex y Movimientos', '/inventory/movements', 'PANTALLA', 3),
      (v_mod_inventario, 'INVENTARIO_ENTRADAS', 'Entradas de Mercancía', '/inventory/entries', 'PANTALLA', 4),
      (v_mod_inventario, 'INVENTARIO_SALIDAS_AJUSTES', 'Salidas y Ajustes', '/inventory/adjustments', 'PANTALLA', 5),
      (v_mod_inventario, 'INVENTARIO_TRANSFERENCIAS', 'Transferencias', '/inventory/transfers', 'PANTALLA', 6)
    ON CONFLICT (codigo) DO UPDATE 
    SET nombre = EXCLUDED.nombre, ruta = EXCLUDED.ruta, modulo_sistema_id = EXCLUDED.modulo_sistema_id, orden = EXCLUDED.orden;
  END IF;

  -- REPORTES
  IF v_mod_reportes IS NOT NULL THEN
    INSERT INTO admin.pantalla_sistema (modulo_sistema_id, codigo, nombre, ruta, tipo, orden)
    VALUES 
      (v_mod_reportes, 'REPORTES_FACTURAS_DIA', 'Reporte Facturas por Día', '/reports/invoices-daily', 'REPORTE', 1),
      (v_mod_reportes, 'REPORTES_ORDENES_DIA', 'Reporte Órdenes por Día', '/reports/work-orders-daily', 'REPORTE', 2),
      (v_mod_reportes, 'REPORTES_CUENTAS_COBRAR', 'Reporte Cuentas por Cobrar', '/reports/receivables', 'REPORTE', 3),
      (v_mod_reportes, 'REPORTES_ACTIVIDAD_CLIENTES', 'Reporte Actividad de Clientes', '/reports/customer-activity', 'REPORTE', 4),
      (v_mod_reportes, 'REPORTES_INVENTARIO_SUPLIDOR', 'Reporte Inventario por Suplidor', '/reports/inventory-supplier', 'REPORTE', 5),
      (v_mod_reportes, 'REPORTES_CUADRE_CAJA', 'Reporte Cuadre de Caja', '/reports/daily-cash', 'REPORTE', 6)
    ON CONFLICT (codigo) DO UPDATE 
    SET nombre = EXCLUDED.nombre, ruta = EXCLUDED.ruta, modulo_sistema_id = EXCLUDED.modulo_sistema_id, orden = EXCLUDED.orden;
  END IF;

  -- CONFIGURACIÓN
  IF v_mod_configuracion IS NOT NULL THEN
    INSERT INTO admin.pantalla_sistema (modulo_sistema_id, codigo, nombre, ruta, tipo, orden)
    VALUES 
      (v_mod_configuracion, 'CONFIG_SERVICIOS', 'Servicios de Taller', '/workshop/service-types', 'PANTALLA', 1),
      (v_mod_configuracion, 'CONFIG_ESTADOS_ORDEN', 'Estados de Orden de Trabajo', '/workshop/order-statuses', 'PANTALLA', 2),
      (v_mod_configuracion, 'CONFIG_PRODUCTOS_TALLER', 'Productos y Repuestos Taller', '/workshop/products', 'PANTALLA', 3),
      (v_mod_configuracion, 'CONFIG_TIPOS_PRODUCTO', 'Tipos de Producto', '/inventory/product-types', 'PANTALLA', 4),
      (v_mod_configuracion, 'CONFIG_CATEGORIAS_PRODUCTO', 'Categorías de Producto', '/inventory/product-categories', 'PANTALLA', 5),
      (v_mod_configuracion, 'CONFIG_MARCAS_PRODUCTO', 'Marcas de Producto', '/inventory/product-brands', 'PANTALLA', 6),
      (v_mod_configuracion, 'CONFIG_UNIDADES_MEDIDA', 'Unidades de Medida', '/inventory/measurement-units', 'PANTALLA', 7),
      (v_mod_configuracion, 'CONFIG_PROVEEDORES', 'Proveedores', '/inventory/suppliers', 'PANTALLA', 8),
      (v_mod_configuracion, 'CONFIG_INVENTARIO_INICIAL', 'Inventario Inicial', '/inventory/initial', 'PANTALLA', 9),
      (v_mod_configuracion, 'CONFIG_NIVELES_CLIENTES', 'Niveles de Clientes', '/crm/client-levels', 'PANTALLA', 10),
      (v_mod_configuracion, 'CONFIG_CATEGORIAS_COMPONENTES', 'Categorías Componentes', '/crm/component-categories', 'PANTALLA', 11),
      (v_mod_configuracion, 'CONFIG_ESTADOS_COMPONENTES', 'Estados Componentes', '/crm/component-states', 'PANTALLA', 12),
      (v_mod_configuracion, 'CONFIG_NOTIFICACIONES_ORDENES', 'Notificaciones de Órdenes', '/settings/order-notifications', 'PANTALLA', 13)
    ON CONFLICT (codigo) DO UPDATE 
    SET nombre = EXCLUDED.nombre, ruta = EXCLUDED.ruta, modulo_sistema_id = EXCLUDED.modulo_sistema_id, orden = EXCLUDED.orden;
  END IF;

  -- SEGURIDAD
  IF v_mod_seguridad IS NOT NULL THEN
    INSERT INTO admin.pantalla_sistema (modulo_sistema_id, codigo, nombre, ruta, tipo, orden)
    VALUES 
      (v_mod_seguridad, 'SEGURIDAD_USUARIOS', 'Administrar Usuarios', '/settings/security/users', 'PANTALLA', 1),
      (v_mod_seguridad, 'SEGURIDAD_ROLES', 'Matriz de Roles', '/settings/security/roles', 'PANTALLA', 2),
      (v_mod_seguridad, 'SEGURIDAD_TIPOS_EMPRESA', 'Tipos de Empresa', '/settings/security/company-types', 'PANTALLA', 3),
      (v_mod_seguridad, 'SEGURIDAD_EMPRESAS', 'Empresas', '/settings/security/companies', 'PANTALLA', 4),
      (v_mod_seguridad, 'SEGURIDAD_TIPOS_USUARIO', 'Tipos de Usuario', '/settings/security/user-types', 'PANTALLA', 5)
    ON CONFLICT (codigo) DO UPDATE 
    SET nombre = EXCLUDED.nombre, ruta = EXCLUDED.ruta, modulo_sistema_id = EXCLUDED.modulo_sistema_id, orden = EXCLUDED.orden;
  END IF;
END $$;
