/**
 * Centralized Single Source of Truth for Navigation, Sidebar & RBAC Screen Hierarchy
 *
 * Regla de negocio:
 * Cualquier nuevo menú o pantalla agregado aquí se reflejará automáticamente
 * tanto en el Sidebar como en la Matriz de Roles sin requerir múltiples registros manuales.
 */

export interface ScreenDefinition {
  id: string;
  codigo: string;
  nombre: string;
  ruta: string;
  tipo: "PANTALLA" | "REPORTE";
  orden: number;
  apiPatterns?: string[];
  /** Si se omite, aplican todas las 12 acciones estándar */
  disallowActions?: string[];
}

export interface MenuDefinition {
  id: string;
  codigo: string;
  nombre: string;
  icono: string; // Material symbol or Lucide icon name
  ruta?: string;
  orden: number;
  screens: ScreenDefinition[];
}

export const CANONICAL_NAVIGATION: MenuDefinition[] = [
  {
    id: "home",
    codigo: "DASHBOARD",
    nombre: "HOME",
    icono: "home",
    ruta: "/",
    orden: 1,
    screens: [
      {
        id: "dashboard_main",
        codigo: "DASHBOARD_MAIN",
        nombre: "Dashboard Principal",
        ruta: "/",
        tipo: "PANTALLA",
        orden: 1,
        apiPatterns: ["/api/dashboard"]
      }
    ]
  },
  {
    id: "taller",
    codigo: "TALLER",
    nombre: "TALLER",
    icono: "build",
    orden: 2,
    screens: [
      {
        id: "taller_recepciones",
        codigo: "TALLER_RECEPCIONES",
        nombre: "Recepciones",
        ruta: "/workshop?view=list",
        tipo: "PANTALLA",
        orden: 1,
        apiPatterns: ["/api/taller/recepciones"]
      },
      {
        id: "taller_ordenes",
        codigo: "TALLER_ORDENES",
        nombre: "Órdenes de Trabajo",
        ruta: "/workshop?view=work_orders",
        tipo: "PANTALLA",
        orden: 2,
        apiPatterns: ["/api/taller/ordenes", "/api/taller/facturacion/ordenes"]
      },
      {
        id: "taller_kanban",
        codigo: "TALLER_KANBAN",
        nombre: "Vista Kanban",
        ruta: "/workshop?view=kanban",
        tipo: "PANTALLA",
        orden: 3,
        apiPatterns: ["/api/taller/ordenes"]
      }
    ]
  },
  {
    id: "facturacion",
    codigo: "FACTURACIÓN",
    nombre: "FACTURACIÓN",
    icono: "receipt_long",
    orden: 3,
    screens: [
      {
        id: "facturacion_nueva",
        codigo: "FACTURACION_NUEVA",
        nombre: "Nueva Factura",
        ruta: "/billing/new",
        tipo: "PANTALLA",
        orden: 1,
        apiPatterns: ["/api/facturacion/facturas", "/api/facturacion/ordenes-facturables"]
      },
      {
        id: "facturacion_facturas",
        codigo: "FACTURACION_FACTURAS",
        nombre: "Facturas Emitidas",
        ruta: "/billing/invoices",
        tipo: "PANTALLA",
        orden: 2,
        apiPatterns: ["/api/facturacion/facturas"]
      },
      {
        id: "facturacion_pagos",
        codigo: "FACTURACION_PAGOS",
        nombre: "Cobros y Pagos",
        ruta: "/billing/payments",
        tipo: "PANTALLA",
        orden: 3,
        apiPatterns: ["/api/facturacion/pagos"]
      },
      {
        id: "facturacion_despacho",
        codigo: "FACTURACION_DESPACHO",
        nombre: "Despacho de Órdenes",
        ruta: "/workshop?view=billing",
        tipo: "PANTALLA",
        orden: 4,
        apiPatterns: ["/api/taller/facturacion/ordenes"]
      }
    ]
  },
  {
    id: "crm",
    codigo: "CRM",
    nombre: "CRM",
    icono: "group",
    orden: 4,
    screens: [
      {
        id: "crm_clientes",
        codigo: "CRM_CLIENTES",
        nombre: "Clientes",
        ruta: "/crm/customers",
        tipo: "PANTALLA",
        orden: 1,
        apiPatterns: ["/api/crm/clientes"]
      },
      {
        id: "crm_bicicletas",
        codigo: "CRM_BICICLETAS",
        nombre: "Bicicletas",
        ruta: "/crm/bicycles",
        tipo: "PANTALLA",
        orden: 2,
        apiPatterns: ["/api/crm/bicicletas"]
      },
      {
        id: "crm_niveles_clientes",
        codigo: "CRM_NIVELES_CLIENTES",
        nombre: "Niveles de Clientes",
        ruta: "/crm/client-levels",
        tipo: "PANTALLA",
        orden: 3,
        apiPatterns: ["/api/crm/niveles-cliente"]
      }
    ]
  },
  {
    id: "inventario",
    codigo: "INVENTARIO",
    nombre: "INVENTARIO",
    icono: "inventory_2",
    orden: 5,
    screens: [
      {
        id: "inventario_resumen",
        codigo: "INVENTARIO_RESUMEN",
        nombre: "Resumen de Inventario",
        ruta: "/inventory/summary",
        tipo: "PANTALLA",
        orden: 1,
        apiPatterns: ["/api/inventario/resumen"]
      },
      {
        id: "inventario_existencias",
        codigo: "INVENTARIO_EXISTENCIAS",
        nombre: "Existencias y Stock",
        ruta: "/inventory/stock",
        tipo: "PANTALLA",
        orden: 2,
        apiPatterns: ["/api/inventario/existencias"]
      },
      {
        id: "inventario_movimientos",
        codigo: "INVENTARIO_MOVIMIENTOS",
        nombre: "Kardex y Movimientos",
        ruta: "/inventory/movements",
        tipo: "PANTALLA",
        orden: 3,
        apiPatterns: ["/api/inventario/movimientos"]
      },
      {
        id: "inventario_entradas",
        codigo: "INVENTARIO_ENTRADAS",
        nombre: "Entradas de Mercancía",
        ruta: "/inventory/entries",
        tipo: "PANTALLA",
        orden: 4,
        apiPatterns: ["/api/inventario/entradas"]
      },
      {
        id: "inventario_salidas_ajustes",
        codigo: "INVENTARIO_SALIDAS_AJUSTES",
        nombre: "Salidas y Ajustes",
        ruta: "/inventory/adjustments",
        tipo: "PANTALLA",
        orden: 5,
        apiPatterns: ["/api/inventario/salidas-ajustes"]
      },
      {
        id: "inventario_transferencias",
        codigo: "INVENTARIO_TRANSFERENCIAS",
        nombre: "Transferencias",
        ruta: "/inventory/transfers",
        tipo: "PANTALLA",
        orden: 6,
        apiPatterns: ["/api/inventario/transferencias"]
      }
    ]
  },
  {
    id: "reportes",
    codigo: "REPORTES",
    nombre: "REPORTES",
    icono: "bar_chart",
    orden: 6,
    screens: [
      {
        id: "reportes_facturas_dia",
        codigo: "REPORTES_FACTURAS_DIA",
        nombre: "Facturas por Día",
        ruta: "/reports/invoices-daily",
        tipo: "REPORTE",
        orden: 1,
        apiPatterns: ["/api/reports/invoices-daily"]
      },
      {
        id: "reportes_ordenes_dia",
        codigo: "REPORTES_ORDENES_DIA",
        nombre: "Órdenes por Día",
        ruta: "/reports/work-orders-daily",
        tipo: "REPORTE",
        orden: 2,
        apiPatterns: ["/api/reports/work-orders-daily"]
      },
      {
        id: "reportes_cuentas_cobrar",
        codigo: "REPORTES_CUENTAS_COBRAR",
        nombre: "Cuentas por Cobrar",
        ruta: "/reports/receivables",
        tipo: "REPORTE",
        orden: 3,
        apiPatterns: ["/api/reports/receivables"]
      },
      {
        id: "reportes_actividad_clientes",
        codigo: "REPORTES_ACTIVIDAD_CLIENTES",
        nombre: "Actividad de Clientes",
        ruta: "/reports/customer-activity",
        tipo: "REPORTE",
        orden: 4,
        apiPatterns: ["/api/reports/customer-activity"]
      },
      {
        id: "reportes_inventario_suplidor",
        codigo: "REPORTES_INVENTARIO_SUPLIDOR",
        nombre: "Inventario por Suplidor",
        ruta: "/reports/inventory-supplier",
        tipo: "REPORTE",
        orden: 5,
        apiPatterns: ["/api/reports/inventory-supplier"]
      },
      {
        id: "reportes_cuadre_caja",
        codigo: "REPORTES_CUADRE_CAJA",
        nombre: "Cuadre de Caja",
        ruta: "/reports/daily-cash",
        tipo: "REPORTE",
        orden: 6,
        apiPatterns: ["/api/reports/daily-cash"]
      }
    ]
  },
  {
    id: "configuracion",
    codigo: "CONFIGURACIÓN",
    nombre: "CONFIGURACIÓN",
    icono: "settings",
    orden: 7,
    screens: [
      {
        id: "config_servicios",
        codigo: "CONFIG_SERVICIOS",
        nombre: "Servicios",
        ruta: "/workshop/service-types",
        tipo: "PANTALLA",
        orden: 1,
        apiPatterns: ["/api/taller/tipos-servicio"]
      },
      {
        id: "config_estados_orden",
        codigo: "CONFIG_ESTADOS_ORDEN",
        nombre: "Estados de Orden de Trabajo",
        ruta: "/workshop/order-statuses",
        tipo: "PANTALLA",
        orden: 2,
        apiPatterns: ["/api/taller/estados-orden"]
      },
      {
        id: "config_productos_taller",
        codigo: "CONFIG_PRODUCTOS_TALLER",
        nombre: "Productos",
        ruta: "/workshop/products",
        tipo: "PANTALLA",
        orden: 3,
        apiPatterns: ["/api/taller/productos"]
      },
      {
        id: "config_tipos_producto",
        codigo: "CONFIG_TIPOS_PRODUCTO",
        nombre: "Tipos de Producto",
        ruta: "/inventory/product-types",
        tipo: "PANTALLA",
        orden: 4,
        apiPatterns: ["/api/inventario/tipos-producto"]
      },
      {
        id: "config_categorias_producto",
        codigo: "CONFIG_CATEGORIAS_PRODUCTO",
        nombre: "Categorías de Producto",
        ruta: "/inventory/product-categories",
        tipo: "PANTALLA",
        orden: 5,
        apiPatterns: ["/api/inventario/categorias-producto"]
      },
      {
        id: "config_marcas_producto",
        codigo: "CONFIG_MARCAS_PRODUCTO",
        nombre: "Marcas de Producto",
        ruta: "/inventory/product-brands",
        tipo: "PANTALLA",
        orden: 6,
        apiPatterns: ["/api/inventario/marcas-producto"]
      },
      {
        id: "config_unidades_medida",
        codigo: "CONFIG_UNIDADES_MEDIDA",
        nombre: "Unidades de Medida",
        ruta: "/inventory/measurement-units",
        tipo: "PANTALLA",
        orden: 7,
        apiPatterns: ["/api/inventario/unidades-medida"]
      },
      {
        id: "config_proveedores",
        codigo: "CONFIG_PROVEEDORES",
        nombre: "Proveedores",
        ruta: "/inventory/suppliers",
        tipo: "PANTALLA",
        orden: 8,
        apiPatterns: ["/api/inventario/proveedores"]
      },
      {
        id: "config_inventario_inicial",
        codigo: "CONFIG_INVENTARIO_INICIAL",
        nombre: "Inventario Inicial",
        ruta: "/inventory/initial",
        tipo: "PANTALLA",
        orden: 9,
        apiPatterns: ["/api/inventario/inventario-inicial"]
      },
      {
        id: "config_niveles_clientes",
        codigo: "CONFIG_NIVELES_CLIENTES",
        nombre: "Niveles de Clientes",
        ruta: "/crm/client-levels",
        tipo: "PANTALLA",
        orden: 10,
        apiPatterns: ["/api/crm/niveles-cliente"]
      },
      {
        id: "config_categorias_componentes",
        codigo: "CONFIG_CATEGORIAS_COMPONENTES",
        nombre: "Categorías Componentes",
        ruta: "/crm/component-categories",
        tipo: "PANTALLA",
        orden: 11,
        apiPatterns: ["/api/crm/categorias-componentes"]
      },
      {
        id: "config_estados_componentes",
        codigo: "CONFIG_ESTADOS_COMPONENTES",
        nombre: "Estados Componentes",
        ruta: "/crm/component-states",
        tipo: "PANTALLA",
        orden: 12,
        apiPatterns: ["/api/crm/estados-componentes"]
      },
      {
        id: "config_notificaciones_ordenes",
        codigo: "CONFIG_NOTIFICACIONES_ORDENES",
        nombre: "Notificaciones de Órdenes",
        ruta: "/settings/order-notifications",
        tipo: "PANTALLA",
        orden: 13,
        apiPatterns: ["/api/settings/order-notifications"]
      }
    ]
  },
  {
    id: "seguridad",
    codigo: "SEGURIDAD",
    nombre: "SEGURIDAD",
    icono: "verified_user",
    orden: 8,
    screens: [
      {
        id: "seguridad_usuarios",
        codigo: "SEGURIDAD_USUARIOS",
        nombre: "Administrar Usuarios",
        ruta: "/settings/security/users",
        tipo: "PANTALLA",
        orden: 1,
        apiPatterns: ["/api/usuarios"]
      },
      {
        id: "seguridad_roles",
        codigo: "SEGURIDAD_ROLES",
        nombre: "Matriz de Roles",
        ruta: "/settings/security/roles",
        tipo: "PANTALLA",
        orden: 2,
        apiPatterns: ["/api/matriz-acceso-rol"]
      },
      {
        id: "seguridad_tipos_empresa",
        codigo: "SEGURIDAD_TIPOS_EMPRESA",
        nombre: "Tipos de Empresa",
        ruta: "/settings/security/company-types",
        tipo: "PANTALLA",
        orden: 3,
        apiPatterns: ["/api/tipos-empresa"]
      },
      {
        id: "seguridad_empresas",
        codigo: "SEGURIDAD_EMPRESAS",
        nombre: "Empresas",
        ruta: "/settings/security/companies",
        tipo: "PANTALLA",
        orden: 4,
        apiPatterns: ["/api/empresas"]
      },
      {
        id: "seguridad_tipos_usuario",
        codigo: "SEGURIDAD_TIPOS_USUARIO",
        nombre: "Tipos de Usuario",
        ruta: "/settings/security/user-types",
        tipo: "PANTALLA",
        orden: 5,
        apiPatterns: ["/api/tipos-usuario"]
      }
    ]
  }
];

export const RBAC_ACTIONS = [
  { id: "ver", label: "VER", tooltip: "Visualización y lectura de datos" },
  { id: "crear", label: "CREAR", tooltip: "Creación de nuevos registros" },
  { id: "editar", label: "EDITAR", tooltip: "Modificación de registros existentes" },
  { id: "inactivar", label: "INACTIVAR", tooltip: "Desactivación de registros o estados" },
  { id: "exportar", label: "EXPORTAR", tooltip: "Descarga de reportes o exportación a Excel / PDF" },
  { id: "importar", label: "IMPORTAR", tooltip: "Carga masiva de datos externos" },
  { id: "aprobar", label: "APROBAR", tooltip: "Aprobación o validación de procesos y transacciones" },
  { id: "asignar", label: "ASIGNAR", tooltip: "Asignación de recursos, técnicos o responsabilidades" },
  { id: "mover", label: "MOVER", tooltip: "Cambio de etapa o traslados entre estados/ubicaciones" },
  { id: "cerrar", label: "CERRAR", tooltip: "Cierre formal de órdenes, periodos o registros" },
  { id: "reabrir", label: "REABRIR", tooltip: "Reapertura de registros previamente cerrados" },
  { id: "eliminar", label: "ELIMINAR", tooltip: "Eliminación o borrado lógico / físico de registros" }
] as const;

export type RbacActionId = typeof RBAC_ACTIONS[number]["id"];

/**
 * Normaliza nombres o códigos para búsquedas tolerantes a mayúsculas y acentos
 */
export function normalizeCode(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

/**
 * Encuentra la definición de pantalla correspondiente a una ruta y searchParams
 */
export function matchScreenByPath(pathname: string, searchParams?: URLSearchParams | string): ScreenDefinition | null {
  const currentParams = typeof searchParams === "string"
    ? new URLSearchParams(searchParams)
    : searchParams;

  const currentView = currentParams?.get("view");

  for (const menu of CANONICAL_NAVIGATION) {
    for (const screen of menu.screens) {
      if (screen.ruta.includes("?")) {
        const [screenPath, screenQuery] = screen.ruta.split("?");
        if (pathname === screenPath) {
          const screenParams = new URLSearchParams(screenQuery);
          const screenView = screenParams.get("view");
          if (screenView && screenView === currentView) {
            return screen;
          }
        }
      } else {
        if (pathname === screen.ruta || pathname.startsWith(screen.ruta + "/")) {
          return screen;
        }
      }
    }
  }

  return null;
}
