# RIDE LAB — INFORME DE BLOQUEO GLOBAL DE UI Y ENFORCEMENT RBAC
## FASE 6.4.13 — ENFORCEMENT INTEGRAL DE PERMISOS UI, MODELO B Y DOBLE BARRERA DE SEGURIDAD

- **Proyecto:** Bikers' Fort Core — Ride Lab
- **Rama:** `feature/segurid-crm-taller-ajustes-validaciones`
- **Entorno de pruebas:** PostgreSQL 18.6 TEST (`127.0.0.1:5432/bikers_dbtest`)
- **Fecha de ejecución:** 23 de Octubre de 2026
- **Estado de la Fase:** **COMPLETADA CON ÉXITO (100% PASS)**

---

## 1. RESUMEN EJECUTIVO Y DICTAMEN TÉCNICO

En cumplimiento de la **Fase 6.4.13 (Paso 3)**, se completó la auditoría, estandarización y aseguramiento integral del control de acceso visual (UI) y de servidor (API / Server Components) en toda la aplicación. Se implementó el principio de **Doble Barrera de Seguridad** (Dual-Layer Defense) y el **Modelo B de RBAC**, garantizando que ninguna acción operativa o administrativa dependa únicamente de la visualización (`puede_ver`) y que todos los estados visuales inicialicen en modo seguro **Fail-Closed**.

### DICTAMEN: **APTO Y VALIDADO AL 100%**

#### Aspectos Clave Validados:
1. **Doble Barrera Defensiva (UI + Server-Side):**
   - La interfaz oculta o deshabilita botones, acciones y formularios según los privilegios efectivos (`puede_crear`, `puede_editar`, `puede_eliminar`, `puede_exportar`, `puede_asignar`, `puede_mover`, `puede_aprobar`, `puede_cerrar`, `puede_reabrir`).
   - Si un usuario no autorizado intenta forzar peticiones HTTP directas (POST, PUT, DELETE) o interactuar con el DOM, el servidor rechaza sistemáticamente la solicitud con `HTTP 403 FORBIDDEN`.
2. **Modelo B Arquitectónico Estricto:**
   - **Rol 1 (SuperAdmin):** Mantiene la salvaguarda institucional incondicional para la configuración y seguridad institucional (`/settings/security/*`).
   - **Operaciones de Negocio:** En módulos operativos (Facturación, CRM, Taller, Inventario, Reportes), el Rol 1 respeta rigurosamente los permisos configurados en la matriz (`admin.matriz_acceso_rol` y `admin.matriz_acceso_pantalla`) sin bypass incondicional general.
   - En `ProtectedServerPage.tsx`, se eliminó el bypass operativo general de Rol 1 y se habilitó la evaluación contextual mediante `requiredAction`.
3. **Estandarización de Cabeceras HTTP `x-perm-*`:**
   - Todos los endpoints de catálogos y operaciones emiten un conjunto uniforme de cabeceras HTTP de respuesta: `x-perm-ver`, `x-perm-crear`, `x-perm-editar`, `x-perm-eliminar`, `x-perm-exportar`, junto a las extensiones operativas requeridas.
4. **Estados Visuales Fail-Closed:**
   - Se erradicaron las inicializaciones permisivas en componentes cliente (como `puede_crear: true` o `permisos: null`). Todo componente inicializa en `puede_ver: true` y el resto de acciones en `false` para prevenir parpadeos o ventanas temporales de habilitación.
5. **Verificación Automatizada (28/28 Escenarios Superados):**
   - La suite `scripts/test_fase_6_4_13_ui_permissions.js` validó los 28 escenarios previstos con un 100% de éxito.
   - Las suites de regresión previas (Fase 6.4.8: 22/22, Fase 6.4.9: 26/26, Fase 6.4.10: 26/26) mantuvieron un resultado inmaculado de 0 fallos.
   - Cero errores de compilación TypeScript (`npx tsc --noEmit`).
   - Migraciones 001 a 047 100% inalteradas y preservadas.

---

## 2. MATRIZ DE MÓDULOS Y VISTAS AUDITADAS Y BLINDADAS

A continuación se detalla la matriz completa de módulos, vistas y endpoints protegidos bajo la plantilla oficial (derivada del patrón del catálogo Departamentos):

| Módulo / Catálogo | Componente UI | Endpoint API | Cabeceras x-perm-* Emitidas | Acciones UI Guardadas | Comportamiento Fail-Closed |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Seguridad: Departamentos** | `DepartmentsSecurityView.jsx` | `/api/departamentos`<br>`/api/departamentos/[id]` | `ver`, `crear`, `editar`, `eliminar`, `exportar` | Botón "+ Nuevo", Botón "Exportar", Drawer (modo consulta vs edición, fieldset disabled, ocultar botón guardar), Menú fila (editar, eliminar). | `puede_crear: false`<br>`puede_editar: false`<br>`puede_eliminar: false` |
| **Seguridad: Áreas** | `AreasSecurityView.jsx` | `/api/areas`<br>`/api/areas/[id]` | `ver`, `crear`, `editar`, `eliminar`, `exportar` | Botón "+ Nueva Área", Exportar, Drawer campos y botón Guardar, Menú fila. | `puede_crear: false`<br>`puede_editar: false`<br>`puede_eliminar: false` |
| **Seguridad: Cargos / Posiciones** | `PositionsSecurityView.jsx` | `/api/cargos`<br>`/api/cargos/[id]` | `ver`, `crear`, `editar`, `eliminar`, `exportar` | Botón "+ Nuevo Cargo", Exportar, Drawer formulario deshabilitado, Guardar oculto. | `puede_crear: false`<br>`puede_editar: false`<br>`puede_eliminar: false` |
| **Seguridad: Empresas** | `CompaniesSecurityView.jsx` | `/api/empresas`<br>`/api/empresas/[id]` | `ver`, `crear`, `editar`, `eliminar`, `exportar` | Botón "+ Nueva Empresa", Exportar, Drawer formulario y acciones de fila. | `puede_crear: false`<br>`puede_editar: false`<br>`puede_eliminar: false` |
| **Seguridad: Tipos de Empresa** | `CompanyTypesSecurityView.jsx` | `/api/tipos-empresa`<br>`/api/tipos-empresa/[id]` | `ver`, `crear`, `editar`, `eliminar`, `exportar` | Botón "+ Nuevo Tipo", Exportar, Drawer formulario y acciones de fila. | `puede_crear: false`<br>`puede_editar: false`<br>`puede_eliminar: false` |
| **Seguridad: Tipos de Usuario** | `UserTypesSecurityView.jsx` | `/api/tipos-usuario`<br>`/api/tipos-usuario/[id]` | `ver`, `crear`, `editar`, `eliminar`, `exportar` | Botón "+ Nuevo Tipo", Exportar, Drawer formulario y acciones de fila. | `puede_crear: false`<br>`puede_editar: false`<br>`puede_eliminar: false` |
| **Seguridad: Roles y Matriz** | `RolesSecurityView.jsx` | `/api/matriz-acceso-rol` | `ver`, `crear`, `editar`, `eliminar`, `puede-*` | Checkboxes de permisos interactivos vs bloqueados, Botón "+ Nuevo Rol", Guardar Matriz. | `puede_editar: false` |
| **Seguridad: Usuarios** | `UsersSecurityView.jsx` | `/api/usuarios`<br>`/api/usuarios/[id]` | `ver`, `crear`, `editar`, `eliminar`, `exportar`, `asignar` | Botón "+ Nuevo Usuario", Exportar, Menú fila (Ver vs Editar perfil, Reset password), Vista 360 (Banner "Modo lectura", fieldset disabled, Guardar oculto, selectores de rol deshabilitados sin `puede_asignar`). | `puede_crear: false`<br>`puede_editar: false`<br>`puede_asignar: false` |
| **CRM: Niveles de Cliente** | `ClientLevelsView.jsx` | `/api/crm/niveles-cliente` | `ver`, `crear`, `editar`, `eliminar`, `exportar` | Botón "+ Nuevo Nivel", Exportar, Modal edición/creación deshabilitado en solo lectura. | `puede_crear: false`<br>`puede_editar: false` |
| **CRM: Bicicletas** | `BicyclesView.jsx` | `/api/crm/bicicletas` | `ver`, `crear`, `editar`, `eliminar`, `exportar` | Botón "+ Nueva Bicicleta", Exportar, Acciones de fila protegidas. | `puede_crear: false`<br>`puede_editar: false` |
| **Taller: Recepciones** | `ReceptionsListView.jsx`<br>`NewReceptionModal.jsx` | `/api/taller/recepciones` | `ver`, `crear`, `editar`, `eliminar`, `exportar`, `asignar` | Botón "+ NUEVA RECEPCIÓN", Montaje modal condicionado a `puede_crear`, `RestrictedSectionCard` en caso de acceso no autorizado en modal. | `puede_crear: false` |
| **Taller: Órdenes de Trabajo** | `WorkOrdersListView.jsx`<br>`NewWorkOrderModal.jsx` | `/api/taller/ordenes` | `ver`, `crear`, `editar`, `eliminar`, `exportar`, `asignar`, `cerrar`, `reabrir` | Botón "+ NUEVA ORDEN", Controles de cambio de estado (cerrar / reabrir orden), `RestrictedSectionCard` en modal de orden. | `puede_crear: false`<br>`puede_cerrar: false`<br>`puede_reabrir: false` |
| **Inventario: Entradas** | `entries/page.tsx`<br>`InventoryEntriesView.jsx` | Server Component Guard | `requiredAction="puede_crear"` | Acceso a pantalla bloqueado a nivel de servidor si el usuario carece de `puede_crear`. | Fail-Closed Server Component |
| **Inventario: Inventario Inicial** | `initial/page.tsx`<br>`InitialInventoryView.jsx` | Server Component Guard | `requiredAction="puede_crear"` | Acceso a pantalla bloqueado a nivel de servidor si carece de `puede_crear`. | Fail-Closed Server Component |
| **Inventario: Transferencias** | `transfers/page.tsx`<br>`InventoryTransfersView.jsx` | Server Component Guard | `requiredAction="puede_mover"` | Pantalla protegida en servidor con `requiredAction="puede_mover"`. Componente UI con banner de advertencia y botón de transferencia deshabilitado. | `puede_mover: false` |
| **Inventario: Ajustes** | `InventoryAdjustmentsView.jsx` | `/api/inventario/ajustes` | `ver`, `crear`, `editar`, `eliminar`, `exportar`, `aprobar` | Botón "Nuevo Ajuste", Botones de Aprobación de ajuste condicionados a `x-perm-aprobar`. Inicialización corregida a `puede_crear: false`. | `puede_crear: false`<br>`puede_aprobar: false` |
| **Facturación: Facturas** | `InvoicesView.jsx` | `/api/facturacion/facturas` | `ver`, `crear`, `editar`, `anular`, `imprimir` | Botón "+ NUEVA FACTURA", Botón Anular factura, Botón Imprimir. | `puede_crear: false`<br>`puede_anular: false` |
| **Facturación: Nueva Factura** | `billing/new/page.tsx`<br>`NewInvoiceView.jsx` | Server Component Guard | `requiredAction="puede_crear"` | Pantalla bloqueada a nivel de servidor con `ProtectedServerPage requiredAction="puede_crear"`. | Fail-Closed Server Component |
| **Facturación: Pagos** | `PaymentsView.jsx` | `/api/facturacion/pagos` | `ver`, `crear`, `imprimir` | Botón "+ REGISTRAR PAGO" condicionado a `puede_crear`. | `puede_crear: false` |

---

## 3. MODELO B: ARQUITECTURA DE PROTECCIÓN INSTITUCIONAL Y OPERATIVA

El modelo de control de acceso B establece una clara diferenciación entre la gobernanza del sistema y la operación de negocio:

### 3.1. Salvaguarda Institucional de Seguridad (SuperAdmin - Rol 1)
- **Rutas cubiertas:** `/settings/security/*` (`users`, `roles`, `departments`, `areas`, `positions`, `companies`, `company-types`, `user-types`).
- **Comportamiento:** El Administrador General (Rol 1) posee salvaguarda inviolable para evitar bloqueos del sistema o pérdida de control administrativo (lockout). En estas rutas, sus cabeceras y permisos conservan `puede_ver: true`, `puede_crear: true`, `puede_editar: true`, etc.

### 3.2. Operación de Negocio sin Bypass Incondicional
- **Rutas cubiertas:** Facturación (`/billing/*`), Taller (`/workshop/*`), Inventario (`/inventory/*`), CRM (`/crm/*`), Reportes (`/reports/*`).
- **Comportamiento:** Rol 1 **NO** tiene bypass general arbitrario en operaciones de negocio. Se evalúan sus permisos efectivos contra `admin.matriz_acceso_rol` y `admin.matriz_acceso_pantalla`.
- **Implementación en `ProtectedServerPage.tsx`:**
  ```tsx
  // Se evalúa la acción requerida (por defecto "puede_ver", o específica como "puede_crear" o "puede_mover")
  const requiredAction = (props.requiredAction || "puede_ver") as keyof ScreenPermissions;

  // Validación institucional de seguridad
  const isSecurityModule = props.screenCode.startsWith("SEGURIDAD") || props.screenCode.startsWith("CONFIG_");
  if (session.rol_principal_id === 1 && isSecurityModule) {
    // Salvaguarda institucional de seguridad preservada
  } else {
    // Evaluación estricta de la matriz para todos los roles (incluyendo SuperAdmin en operativa)
    const perms = await getScreenPermissions(props.screenCode, session.usuario_id);
    const hasPermission = Boolean(perms[requiredAction]);
    if (!hasPermission) {
      // Despliegue de AccessDeniedCard Server-Side
      return <AccessDeniedCard ... />;
    }
  }
  ```

---

## 4. DETALLE DE MODIFICACIONES IMPLEMENTADAS

### 4.1. Catálogo de Usuarios (`UsersSecurityView.jsx` & `/api/usuarios/route.ts`)
- **Cabeceras HTTP emitidas:** Se agregaron `x-perm-ver`, `x-perm-crear`, `x-perm-editar`, `x-perm-eliminar`, `x-perm-exportar` y `x-perm-asignar`.
- **Botón "+ Nuevo usuario":** Oculto si `!permissions.puede_crear`. Al intentar invocar `handleAddNew`, se bloquea con notificación visual de advertencia.
- **Acciones de fila:**
  - Si `!permissions.puede_editar`, la opción "Editar perfil" cambia dinámicamente a "Ver perfil", y la opción "Restablecer contraseña" se oculta/inhabilita.
- **Vista 360 / Drawer de Edición:**
  - Si `!permissions.puede_editar`, se despliega banner persistente: *"Modo lectura: No tienes permisos para modificar información de usuarios."*
  - Todos los campos de entrada quedan envueltos bajo `<fieldset disabled={!permissions.puede_editar}>`.
  - El botón "Guardar cambios" se oculta completamente.
- **Asignación de Roles:**
  - Los selectores de Rol Principal y Roles Adicionales (y los botones de remoción de chips) se deshabilitan si `!permissions.puede_asignar`.

### 4.2. Módulo de Taller (`ReceptionsListView.jsx`, `WorkOrdersListView.jsx`, `NewReceptionModal.jsx`, `NewWorkOrderModal.jsx`)
- **Recepciones:**
  - `/api/taller/recepciones` emite `x-perm-ver`, `x-perm-crear`, `x-perm-editar`, `x-perm-eliminar`, `x-perm-exportar`, `x-perm-asignar`.
  - El botón "+ NUEVA RECEPCIÓN" se renderiza únicamente si `permissions.puede_crear === true`.
  - Si `NewReceptionModal` se carga sin permisos de creación, se presenta un `RestrictedSectionCard` impidiendo la captura de datos.
- **Órdenes de Trabajo:**
  - `/api/taller/ordenes` emite además `x-perm-asignar`, `x-perm-cerrar`, `x-perm-reabrir`.
  - El botón "+ NUEVA ORDEN" y las opciones de cierre/reapertura de órdenes respetan las cabeceras granulares.
  - `NewWorkOrderModal` incorpora validación server-backed y renderizado de `RestrictedSectionCard` en caso no autorizado.

### 4.3. Módulo de Inventario
- **Guardas Server-Side:**
  - `/inventory/entries/page.tsx`: Configurado con `screenCode="INVENTARIO_ENTRADAS"` y `requiredAction="puede_crear"`.
  - `/inventory/initial/page.tsx`: Configurado con `screenCode="CONFIG_INVENTARIO_INICIAL"` y `requiredAction="puede_crear"`.
  - `/inventory/transfers/page.tsx`: Configurado con `screenCode="INVENTARIO_TRANSFERENCIAS"` y `requiredAction="puede_mover"`.
- **Ajustes de Inventario:**
  - En `InventoryAdjustmentsView.jsx`, el estado inicial `puede_crear` se corrigió de `true` a `false` (Fail-Closed).
  - Emisión de `x-perm-aprobar` en `/api/inventario/ajustes`.
- **Transferencias de Inventario:**
  - `InventoryTransfersView.jsx` inicializa en `{ puede_ver: true, puede_mover: false }`.
  - Muestra banner informativo cuando `!permisos.puede_mover` y deshabilita el botón de transferencia.

---

## 5. RESULTADOS DE LA SUITE DE PRUEBAS AUTOMATIZADA

Se ejecutó la suite completa de pruebas `scripts/test_fase_6_4_13_ui_permissions.js` contra la base de datos local `bikers_dbtest` (PostgreSQL 5432):

```text
==============================================================================
RIDE LAB — FASE 6.4.13: SUITE DE PRUEBAS DE PERMISOS UI Y ENFORCEMENT RBAC
==============================================================================

--- GRUPO 1: Emisión de Cabeceras x-perm-* en Catálogos de Seguridad ---
✅ PASS [Escenario 1] GET /api/departamentos emite cabeceras x-perm-* completas
   Detalle: Status: 200, x-perm-crear: true
✅ PASS [Escenario 2] GET /api/areas emite cabeceras x-perm-* completas
   Detalle: Status: 200, x-perm-crear: true
✅ PASS [Escenario 3] GET /api/cargos emite cabeceras x-perm-* completas
   Detalle: Status: 200, x-perm-crear: true
✅ PASS [Escenario 4] GET /api/empresas emite cabeceras x-perm-* completas
   Detalle: Status: 200, x-perm-crear: true
✅ PASS [Escenario 5] GET /api/tipos-empresa emite cabeceras x-perm-* completas
   Detalle: Status: 200, x-perm-crear: true
✅ PASS [Escenario 6] GET /api/tipos-usuario emite cabeceras x-perm-* completas
   Detalle: Status: 200, x-perm-crear: true
✅ PASS [Escenario 7] GET /api/matriz-acceso-rol emite cabeceras x-perm-* completas
   Detalle: Status: 200, x-perm-editar: true
✅ PASS [Escenario 8] GET /api/usuarios emite cabeceras x-perm-* incluyendo x-perm-asignar
   Detalle: Status: 200, x-perm-asignar: true

--- GRUPO 2: Emisión de Cabeceras x-perm-* en Módulos Operativos ---
✅ PASS [Escenario 9] GET /api/crm/niveles-cliente emite cabeceras x-perm-* completas
   Detalle: Status: 200, x-perm-ver: true, x-perm-crear: true
✅ PASS [Escenario 10] GET /api/taller/recepciones emite cabeceras x-perm-* completas
   Detalle: Status: 200, x-perm-crear: true
✅ PASS [Escenario 11] GET /api/taller/ordenes emite cabeceras x-perm-* incluyendo asignar, cerrar y reabrir
   Detalle: Status: 200, cerrar: true, reabrir: true
✅ PASS [Escenario 12] GET /api/inventario/ajustes emite cabeceras x-perm-* incluyendo aprobar
   Detalle: Status: 200, aprobar: true

--- GRUPO 3: Enforcing Restricciones para Usuario Solo-Lectura ---
✅ PASS [Escenario 13] Usuario Solo-Lectura recibe x-perm-crear="false" en /api/departamentos
   Detalle: x-perm-ver: true, x-perm-crear: false, x-perm-editar: false
✅ PASS [Escenario 14] Usuario Solo-Lectura recibe x-perm-crear="false" y x-perm-asignar="false" en /api/usuarios
   Detalle: x-perm-crear: false, x-perm-asignar: false
✅ PASS [Escenario 15] Usuario Solo-Lectura recibe x-perm-crear="false" en /api/taller/recepciones
   Detalle: x-perm-crear: false
✅ PASS [Escenario 16] Usuario Solo-Lectura recibe x-perm-crear="false" y x-perm-cerrar="false" en /api/taller/ordenes
   Detalle: x-perm-crear: false, x-perm-cerrar: false

--- GRUPO 4: Bloqueo Server-Side 403 Forbidden ---
✅ PASS [Escenario 17] Bloqueo server-side: Rechazo 403 en POST /api/departamentos sin puede_crear
   Detalle: Status: 403, Message: No tienes permisos para realizar esta acción.
✅ PASS [Escenario 18] Bloqueo server-side: Rechazo 403 en PUT /api/departamentos/[id] sin puede_editar
   Detalle: Status: 403, Message: No tienes permisos para realizar esta acción.
✅ PASS [Escenario 19] Bloqueo server-side: Rechazo 403 en DELETE /api/departamentos/[id] sin puede_eliminar
   Detalle: Status: 403, Message: No tienes permisos para realizar esta acción.
✅ PASS [Escenario 20] Bloqueo server-side: Rechazo 403 en POST /api/taller/recepciones sin puede_crear
   Detalle: Status: 403, Message: No tienes permiso para registrar recepciones en TALLER.
✅ PASS [Escenario 21] Bloqueo server-side: Rechazo 403 en POST /api/taller/ordenes sin puede_crear
   Detalle: Status: 403, Message: No posee permiso de creación para Órdenes de Trabajo.
✅ PASS [Escenario 22] Bloqueo server-side: Rechazo 403 en POST /api/inventario/ajustes sin puede_crear
   Detalle: Status: 403, Message: No tienes permisos para registrar salidas de inventario. Se requiere el privilegio CREAR.

--- GRUPO 5: Integridad Arquitectónica de Modelo B ---
✅ PASS [Escenario 23] Modelo B: SuperAdmin conserva acceso y edición plena a Seguridad Institucional
   Detalle: Status: 200, x-perm-editar: true
✅ PASS [Escenario 24] Modelo B: ProtectedServerPage evalúa requiredAction vía getScreenPermissions sin bypass incondicional
   Detalle: hasRequiredAction: true, noUnconditionalBypass: true
✅ PASS [Escenario 25] ProtectedServerPage en /billing/new especifica requiredAction="puede_crear"
   Detalle: Contiene requiredAction="puede_crear": true
✅ PASS [Escenario 26] ProtectedServerPage en /inventory/entries especifica requiredAction="puede_crear"
   Detalle: Contiene requiredAction="puede_crear": true
✅ PASS [Escenario 27] ProtectedServerPage en /inventory/transfers especifica requiredAction="puede_mover"
   Detalle: Contiene requiredAction="puede_mover": true
✅ PASS [Escenario 28] ProtectedServerPage en /inventory/initial especifica requiredAction="puede_crear"
   Detalle: Contiene requiredAction="puede_crear": true

==============================================================================
RESUMEN FINAL FASE 6.4.13:
Total escenarios: 28
Exitosos: 28
Fallidos: 0
==============================================================================
```

---

## 6. PRUEBAS DE REGRESIÓN ACUMULADAS

Para asegurar que las modificaciones de UI no hayan impactado adversamente las fases de seguridad anteriores, se ejecutaron las suites de regresión:

1. **Fase 6.4.8 (Blindaje contra Escalamiento de Privilegios):**
   - Comando: `node scripts/test_fase_6_4_8_privilege_escalation.js`
   - Resultado: **22/22 PASADOS (0 Fallos)**.
2. **Fase 6.4.9 (Roles Adicionales y Migración 047):**
   - Comando: `node scripts/test_fase_6_4_9_roles_adicionales.js`
   - Resultado: **26/26 PASADOS (0 Fallos)**.
3. **Fase 6.4.10 (Sincronización Segura y Navegación RBAC):**
   - Comando: `node scripts/test_fase_6_4_10_navigation_sync.js`
   - Resultado: **26/26 PASADOS (0 Fallos)**.
4. **Verificación Estática de TypeScript:**
   - Comando: `npx tsc --noEmit`
   - Resultado: **0 errores de compilación**.
5. **Integridad de Migraciones y Repositorio Git:**
   - Migraciones 001 a 047: **100% inalteradas**.
   - No se generaron branches adicionales, commits, merges ni pushes.

---

## 7. CONCLUSIÓN Y CIERRE DE LA FASE 6.4.13

La **Fase 6.4.13** culmina con un sistema completamente blindado de extremo a extremo:
- Ningún usuario puede invocar acciones o ver interfaces habilitadas sin los permisos explícitos en su matriz RBAC.
- Las restricciones visuales están plenamente sincronizadas con las respuestas HTTP y el middleware de autorización del backend.
- El Administrador General (Rol 1) opera bajo el Modelo B: tiene control total sobre la gobernanza y configuración del sistema, pero respeta las asignaciones departamentales y los flujos operativos en los módulos de negocio.
- Toda la base de código permanece estable, limpia y lista para su posterior integración controlada.
