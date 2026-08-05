# Especificaciones Técnicas y de Requerimientos: Bikers' Fort Core

Este documento detalla los requerimientos funcionales, la arquitectura recomendada y las especificaciones de interfaz de usuario para el desarrollo del sistema **Bikers' Fort Core**, una plataforma integrada de gestión para tienda y taller de bicicletas premium.

---

## 1. Arquitectura y Stack Tecnológico Recomendado

Para garantizar un rendimiento óptimo, alta disponibilidad y facilidad de mantenimiento, se propone una arquitectura **Multi-Tenant** optimizada para la operación exclusiva del taller:

* **Base de Datos:** **PostgreSQL**. Crucial para garantizar la integridad referencial y transaccional (crucial en el descuento de inventario y estados de órdenes).
* **Backend:** Arquitectura **Serverless** (ej. Node.js/TypeScript o Python en Vercel/AWS Lambda) para endpoints desacoplados, escalables y de bajo costo operativo.
* **Frontend:** React (Next.js) con Tailwind CSS para una interfaz fluida, interactiva y con soporte nativo para Modo Oscuro Premium.
* **Autenticación:** Sistema basado en roles para el personal de la tienda/taller y acceso **sin fricción (sin contraseña)** basado en tokens UUID únicos para los clientes.

---

## 2. Especificación Detallada de Módulos
BIKERS' FORT CORE
'

├── SEGURIDAD
│   ├── Usuarios
│   ├── Roles
│   └── Permisos
│
├── CRM
│   ├── Clientes
│   ├── Bicicletas
│   ├── Componentes
│   └── Historial
│
├── TALLER
│   ├── Recepción
│   ├── Ordenes Trabajo
│   ├── Diagnóstico
│   ├── Mano Obra
│   └── Fotografías
│
├── INVENTARIO
│   ├── Productos
│   ├── Categorías
│   ├── Marcas
│   ├── Proveedores
│   ├── Compras
│   └── Movimientos
│
├── FACTURACIÓN
│   ├── Facturas
│   ├── Pagos
│   └── Detalles
│
├── COMPRA
│   ├── orden_compra
│   ├── detalle_orden_compra
│   ├── recepcion_compra
│   ├── detalle_recepcion_compra
│   ├── estado_compra
│   
│
└── PORTAL CLIENTE
    ├── Tokens
    ├── Aprobaciones
    └── Notificaciones


### Módulo 1: Recepción de Bicicletas (Ingreso al Taller)
Diseñado principalmente para pantallas táctiles o tablets en el mostrador de recepción.
* **Búsqueda e Identificación:** Filtro rápido por cliente (teléfono, cédula o nombre) y selección de bicicleta existente. Si no existen, registro exprés en la misma pantalla.
* **Diagnóstico Preliminar:** Checklist visual parametrizable de componentes críticos (transmisión, frenos, suspensiones, cuadro, ruedas) y estado de limpieza.
* **Registro de Observaciones:** Notas de daños previos (rayones, abolladuras) para protección legal del taller, requerimientos específicos del cliente y presupuesto estimado inicial.
* **Firma Digital:** Captura de firma digital del cliente aceptando los términos del servicio y condiciones de ingreso.
* **Disparador:** Al guardar, se genera automáticamente una nueva Orden de Trabajo en estado `Recibida` y se emite el enlace de seguimiento al cliente.

### Módulo 2: Seguimiento de Órdenes (Portal del Cliente)
Una vista pública de solo lectura diseñada específicamente para dispositivos móviles.
* **Acceso sin Fricción:** El cliente accede mediante un enlace único (ej. `core.bikersfort.com/track/[UUID-UNICO]`) enviado automáticamente por WhatsApp o correo electrónico. No requiere creación de cuenta ni contraseñas.
* **Línea de Tiempo Dinámica:** Representación gráfica del progreso actual de la bicicleta (`Recibida` -> `En Diagnóstico` -> `En Reparación` -> `Lista para Entrega`).
* **Transparencia Técnica:** Visualización de notas del mecánico, fotos adjuntas del estado de los componentes y desglose de piezas/mano de obra aprobadas.
* **Módulo de Aprobación:** Opción para que el cliente apruebe o rechace presupuestos adicionales de repuestos directamente desde su móvil, actualizando el estado de la orden en el taller en tiempo real.

### Módulo 3: Órdenes de Trabajo (Operación Interna del Taller)
El centro de control de los mecánicos, optimizado para la gestión del flujo técnico.
* **Interfaz Kanban:** Vista de tablero con columnas basadas en la máquina de estados de la orden:
    1.  `Recibida` (Por evaluar)
    2.  `En Diagnóstico` (Evaluando requerimientos y repuestos)
    3.  `Esperando Repuestos` (Bloqueada por stock externo)
    4.  `En Reparación` (Manos a la obra)
    5.  `Lista para Entrega` (Control de calidad superado, lista para facturar)
* **Ficha del Mecánico:** Asignación de mecánico responsable, registro de horas de mano de obra y buscador interno de repuestos para asociar directamente a la orden.
* **Integración de Diagnóstico:** Alerta visual si la bicicleta cuenta con componentes específicos de alta gama registrados previamente (transmisiones electrónicas, suspensiones específicas, etc.) para asegurar el herramental correcto.

### Módulo 4: Inventario y Partes (Stock y Tienda)
Control de existencias transaccional y analítico del taller y la tienda.
* **Control Transaccional de Stock:** Descuento automático y atómico en la base de datos cuando una pieza se asigna a una orden de trabajo en estado `En Reparación` o se vende directamente por mostrador.
* **Métricas e Indicadores Clave:**
    * *Alertas de Stock Bajo / Reorden:* Notificaciones visuales automáticas cuando un artículo llega a su stock mínimo crítico.
    * *Tasa de Rotación de Inventario:* Identificación de piezas de alta rotación (pastillas de freno, cadenas, neumáticos) frente a piezas estancadas.
    * *Valor total del inventario:* Costo total en almacén vs. valor proyectado de venta.
* **Trazabilidad:** Historial de entradas (compras a proveedores) y salidas (asociadas a Órdenes de Trabajo específicas o ventas directas).

### Módulo 5: Base de Clientes y Activos (CRM)
Historial unificado y centralizado del cliente y sus pertenencias.
* **Perfil Único del Cliente:** Datos de contacto, preferencias de comunicación y métricas de valor (gasto total en taller, gasto en tienda, frecuencia de visita).
* **Pasaporte del Activo (Bicicletas):** Cada cliente puede tener múltiples bicicletas registradas. Cada bicicleta cuenta con un perfil técnico permanente (Marca, Modelo, Año, Número de serie del cuadro, Modificaciones de componentes).
* **Historial Clínico:** Registro histórico completo de todas las órdenes de trabajo cerradas, repuestos instalados y notas técnicas previas por cada bicicleta individual. Permite al mecánico predecir fatiga de materiales en futuras visitas.

---

## 3. Modelo de Datos Relacional Propuesto (PostgreSQL)

Para asegurar el rendimiento y la consistencia, se recomienda la siguiente estructura  de las tabla que ya están creada en la base de datos en el usuario ADMIN:


##Aquí está el listado de tablas agrupadas por módulo:
##Modulo SEGURIDAD
1.	tipo_empresa
2.	empresa
3.	tipo_usuario
4.	rol_funcional
5.	modulo_sistema
6.	matriz_acceso_rol
7.	departamento
8.	area
9.	cargo
10.	usuario
11.	usuario_identidad
12.	usuario_rol_adicional
13.	usuario_configuracion_acceso
14.	usuario_alcance
15.	usuario_alcance_detalle
16.	usuario_alcance_accion
17.	usuario_seguridad
18.	usuario_onboarding_log
19.	usuario_sesion
20.	usuario_actividad
21.	usuario_auditoria
22.	usuario_creacion_log

##Modulo  CRM
23.	clientes
24.	bicicletas
25.	categoria_componente
26.	estado_componente
27.	bicicleta_componentes
28.	bicicleta_fotos

##Modulo TALLER
29.	categoria_servicio
30.	tipo_servicio
31.	estado_recepcion
32.	recepciones
33.	item_checklist_recepcion
34.	estado_checklist
35.	recepcion_checklist
36.	firma_recepcion
37.	estado_orden_trabajo
38.	prioridad_orden_trabajo
39.	ordenes_trabajo
40.	orden_historial_estado
41.	estado_orden_servicio
42.	estado_aprobacion
43.	orden_servicios
44.	orden_servicio_mano_obra

##Modulo  INVENTARIO
45.	tipo_producto
46.	categoria_producto
47.	marca_producto
48.	unidad_medida
49.	productos
50.	proveedores
51.	producto_proveedor
52.	almacenes
53.	existencias_producto
54.	tipo_movimiento_inventario
55.	movimientos_inventario
TALLER (tabla puente, aparece después de Inventario en el documento)
56.	orden_productos (conecta ordenes_trabajo/orden_servicios con productos de Inventario)

##Modulo  FACTURACIÓN
57.	tipo_factura
58.	facturas
59.	detalle_factura
60.	tipo_pago
61.	pagos

##Modulo COMPRA
62.	tipo_estado_compra
63.	orden_compra
64.	detalle_orden_compra
65.	recepcion_compra
66.	detalle_recepcion_compra

4. Guías de UI/UX (Identidad e Interfaz Visual)
El diseño del software debe seguir una línea estética Modo Oscuro Premium / Industrial de Alto Rendimiento, alineada con la identidad corporativa de Bikers' Fort:

Paleta de Colores:

Fondo Profundo: #0a0c10 (Negro mate industrial / Charcoal oscuro)

Paneles y Tarjetas: #161a21 (Gris oscuro limpio con bordes finos #2d3748)

Color de Acento Principal: #84924a (Verde militar desaturado/oliva extraído del logo corporativo)

Textos: #f8fafc (Blanco nítido) y #94a3b8 (Gris atenuado para datos secundarios)

Detalles Gráficos: Texturas lineales sutiles inspiradas en eslabones de cadena y piñones de bicicletas, implementados mediante CSS/SVG limpios para no sobrecargar el rendimiento de renderizado.

Prompts de UI para Prototipado (Stitch o similar):
Para acelerar el desarrollo del Frontend y la maquetación de vistas, se definieron los siguientes prompts estructurales:

Vista General del Inventario:
Genera un panel de administración en modo oscuro premium llamado "Bikers' Fort Core". Barra lateral izquierda con fondo #0a0c10 que integre un logotipo blanco que diga "BIKER'S FORT TALLER • TIENDA" junto a una etiqueta verde oliva "CORE". Navegación con iconos limpios para Dashboard, Recepción, Órdenes de Trabajo, Inventario & Partes (activo), Clientes y Reportes. El panel principal de Inventario debe mostrar tres tarjetas superiores de métricas: "Alertas de Stock Bajo" con un contador numérico destacado, "Tasa de Rotación" en porcentaje, y "Valor Total del Inventario". Abajo, una tabla moderna con esquinas redondeadas que liste productos incluyendo columna de Imagen del Producto, Nombre, SKU, Categoría, Stock Level (usando barras de progreso verde oliva y rojo para estados críticos), Precio y un botón de acción rápida "Añadir a Orden". El diseño debe verse profesional, industrial y ultra limpio.

Vista del Tablero de Operación (Órdenes de Trabajo):
Genera una interfaz web de taller en modo oscuro enfocada en un tablero Kanban para "Bikers' Fort Core". Las columnas del tablero deben estar encabezadas con tipografía geométrica en mayúsculas y fondo sutil verde militar: 'RECIBIDA', 'EN DIAGNÓSTICO', 'EN REPARACIÓN', 'REPUESTOS PENDIENTES' y 'LISTA PARA ENTREGA'. Cada columna debe contener tarjetas flotantes de órdenes de trabajo individuales. Cada tarjeta debe detallar de forma jerárquica y limpia: Icono sutil de bicicleta, Nombre del modelo (ej. 'Transition Spur Carbon'), Nombre del Cliente, Tipo de Servicio (ej. 'Servicio de Suspensión Completo'), Nivel de Prioridad (con badges como 'Urgente' en rojo o 'Normal' en verde), Mecánico Asignado y una fecha de entrega estimada compacta. Barra superior con buscador global de órdenes y perfil de administrador.
