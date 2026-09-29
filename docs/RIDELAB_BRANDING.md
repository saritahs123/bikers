# Ride Lab — Brand & UI Guidelines

Documento oficial de identidad visual, sistema de diseño y lineamientos UI para la plataforma **Ride Lab (Tienda y Taller de Bicicletas)**.  
Este documento consolida las reglas, tokens y componentes reales implementados en el código de la aplicación.

---

## 1. Brand Identity

- **Nombre Comercial:** Ride Lab — Tienda y Taller de Bicicletas
- **Misión Visual:** Taller especializado de alta gama y retail de ciclismo moderno. Combina tecnología, precisión mecánica y servicio premium.
- **Tonalidad Visual:**
  - **Técnica:** Información clara, tipografía monoespaciada para códigos y metadatos técnicos.
  - **Premium & Minimalista:** Sin ruido visual, sin iconos decorativos superfluos, sin sombras pesadas.
  - **Limpia & Funcional:** Alta legibilidad, superficies bien contrastadas, espaciado calibrado.
  - **Confiable:** Transmite seguridad tanto al personal del taller como al cliente final en el portal de autoservicio.

---

## 2. Logo

- **Archivos Oficiales:**
  - `public/ridelab-logo.png`: Logotipo canónico (engranaje Ride Lab + isotipo) utilizado en Sidebar, TopBar, pantalla de Login y perfil.
  - `public/ridelab-logo-white.png`: Versión optimizada con canal alfa para headers fijos, contrastes limpios y el portal público.
  - `public/logo-optimized.png` y `public/logo.png`: Assets auxiliares optimizados.
- **Reglas de Uso:**
  - Altura estándar en Header / TopBar: `h-7` a `h-8` (28px - 32px en mobile), hasta `h-10` en desktop.
  - Altura en Sidebar principal: `h-12` a `max-h-14` (48px - 56px).
  - Altura en Pantalla de Login: `h-14` a `h-16`.
  - **Alineación:** Siempre acompañado en una sola línea continua por el descriptor secundario en bold negro: `TIENDA Y TALLER DE BICICLETAS`.
  - **Prohibido:** No distorsionar, no rotar, no aplicar sombras directas sobre el SVG/PNG, siempre renderizar con `object-contain`.

---

## 3. Color Palette

Los colores provienen directamente del motor CSS `@theme` en `src/app/globals.css`.

### 3.1 Brand & Accent Colors
| Rol | Nombre | Hex (Modo Oscuro) | Hex (Modo Claro) | Tailwind Token |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Accent** | Ride Lab Olive | `#bfce7f` | `#5c701b` | `var(--color-primary)` / `text-primary` |
| **Primary Button** | Olive Action | `#84924a` | `#687e22` | `var(--color-primary-button-bg)` |
| **Primary Hover** | Olive Bright | `#d0e092` | `#475713` | `var(--color-primary-hover)` |
| **Primary Muted** | Olive Soft | `rgba(191,206,127,0.15)` | `rgba(92,112,27,0.10)` | `var(--color-primary-muted)` |
| **WhatsApp Brand** | WhatsApp Emerald | `#00a884` / `#059669` | `#00a884` / `#059669` | `bg-[#00a884]` / `bg-emerald-600` |

### 3.2 Superficies y Fondos
| Superficie | Modo Oscuro | Modo Claro | Clase CSS / Uso |
| :--- | :--- | :--- | :--- |
| **Background Principal** | `#0a0a0a` | `#f8fafc` | `bg-background` / `bg-[#f8fafc]` |
| **Surface (Cards / Paneles)** | `#0e1117` | `#ffffff` | `bg-surface` / `bg-white` |
| **Surface Subtle (Filas / Insets)** | `#161a21` | `#f1f5f9` (o `#f8fafc`) | `bg-surface-subtle` / `bg-slate-50/80` |
| **Surface Elevated (Modales / Dropdowns)** | `#1c2129` | `#ffffff` | `bg-surface-elevated` |
| **Footer Integrado** | `#0a0d14` | `#0a0d14` (Oscuro fijo) | `bg-[#0a0d14]` |

### 3.3 Textos y Tipografía
| Jerarquía | Modo Oscuro | Modo Claro | Clase Tailwind |
| :--- | :--- | :--- | :--- |
| **Text Primary (Encabezados / Datos)** | `#f8fafc` | `#0f172a` (Slate 900) | `text-foreground` / `text-slate-900` |
| **Text Secondary (Subtítulos / Cuerpos)** | `#cbd5e1` | `#334155` (Slate 700) | `text-foreground-secondary` / `text-slate-700` |
| **Text Muted (Labels / Fechas auxiliares)** | `#94a3b8` | `#64748b` (Slate 500) | `text-foreground-muted` / `text-slate-500` |
| **Text Labels Uppercase (Metadatos)** | `#64748b` | `#94a3b8` (Slate 400) | `text-slate-400 font-bold uppercase` |

### 3.4 Estados y Semántica
| Estado | Color Principal | Fondo Muted | Borde | Uso en Taller |
| :--- | :--- | :--- | :--- | :--- |
| **Success** | `#10b981` / `#059669` | `#ecfdf5` | `#a7f3d0` | Orden Entregada, Completada, Factura |
| **Warning / Process** | `#f97316` / `#f59e0b` | `#fff7ed` | `#fed7aa` | Pendiente, En Reparación |
| **Danger / Hold** | `#f43f5e` / `#e11d48` | `#fff1f2` | `#fecdd3` | Orden en Hold, Cancelada, Anulada |
| **Info / Neutral** | `#0ea5e9` / `#64748b` | `#f0f9ff` / `#f1f5f9` | `#e2e8f0` | En Cola, Informativo, Catálogos |

---

## 4. Typography

### 4.1 Fuentes del Sistema
1. **Sans-Serif Principal:** `Inter` (`var(--font-inter)`), fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
2. **Monospace Técnica:** `JetBrains Mono` (`var(--font-jetbrains-mono)`), fallback: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`. Utilizada para códigos de orden (`OT-202609-18`), números de factura, montos de moneda y códigos técnicos.

### 4.2 Escala Tipográfica Canónica (`globals.css`)
- **Page Title:** `text-2xl sm:text-[26px] font-black tracking-tight` (`.text-page-title`, 24px-26px, weight: 800-900).
- **Section Title:** `text-xs sm:text-sm font-bold tracking-wider uppercase` (`.text-section-title`, 12px-14px).
- **Card Title / Value Principal:** `text-lg sm:text-xl font-black tracking-tight` (`.text-card-title`, 18px-20px).
- **Body / Standard Text:** `text-xs sm:text-sm font-normal leading-relaxed` (12px-14px, weight: 400-500).
- **Secondary / Descriptor:** `text-[11px] sm:text-xs text-slate-500 font-medium` (11px-12px).
- **Field Label (Uppercase):** `text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400` (`.text-field-label`).
- **Badge / Pill:** `text-[10px] sm:text-[11px] font-bold uppercase tracking-tight` (10px-11px).

---

## 5. Spacing

- **Escala de Espaciado:** Basada en múltiplos de 4px (`gap-1` = 4px, `gap-2` = 8px, `gap-2.5` = 10px, `gap-3` = 12px, `gap-4` = 16px).
- **Separación entre Cards:** `space-y-4` (16px) a `space-y-4.5` (18px) en el contenedor principal.
- **Padding Interno de Cards:**
  - Card Principal / Paneles: `p-4 sm:p-5` (16px móvil, 20px desktop).
  - Filas de servicio / Sub-items: `p-3 sm:p-3.5` (12px a 14px).
- **Padding del Contenedor de Página:**
  - Móvil: `px-3.5` a `px-4`.
  - Ancho máximo para vista tracking: `max-w-[430px]` a `max-w-[450px]` centrado automáticamente con `mx-auto`.

---

## 6. Cards

Ride Lab utiliza una jerarquía clara de tarjetas:
1. **Card Principal (Dominante):**
   - Agrupa los metadatos clave: Código de Orden, Cliente, Bicicleta y Fecha de Ingreso.
   - Borde sutil: `border border-slate-100`.
   - Radio: `rounded-2xl` (16px).
   - Sombra: `shadow-[0_2px_8px_rgba(0,0,0,0.03)]`.
   - Distribución interna en 2 columnas equilibradas con divisor sutil (`border-t border-slate-100/90`).
2. **Card de Estado (Stepper):**
   - Tarjeta blanca `rounded-2xl` dedicada exclusivamente al progreso visual de la orden.
3. **Card de Servicios:**
   - Contenedor con encabezado en mayúsculas y contador de ítems a la derecha. Filas internas en `bg-slate-50/80` con bordes sutiles.
4. **Card de Fotos:**
   - Grid de 2 columnas `aspect-[4/3]` con thumbnails redondeados (`rounded-xl`).
5. **No-Card (Footer):**
   - El footer **NUNCA** debe ser una tarjeta flotante; se integra al fondo de la página como bloque estructural completo.

---

## 7. Buttons

### 7.1 Botón Primario (WhatsApp Action)
- **Fondo:** `#00a884` o verde Ride Lab `#059669`, hover `#008f6f` / `#047857`.
- **Texto:** `text-white font-bold text-sm sm:text-base`.
- **Altura:** `py-3.5 px-5`, `rounded-2xl`, con icono oficial de WhatsApp y chevron derecho.
- **Sombra:** `shadow-sm`, transición activa `active:scale-[0.99]`.

### 7.2 Botones Secundarios (Descargar Factura / Llamar al Taller)
- **Fondo:** Blanco `bg-white`, hover `hover:bg-slate-50`, active `active:bg-slate-100`.
- **Borde:** `border border-slate-300`.
- **Texto:** `text-slate-800 font-semibold text-[11px] min-[390px]:text-xs sm:text-sm`.
- **Altura:** `h-11 sm:h-12` consistente en grid 50/50.
- **Radio:** `rounded-xl`.
- **Estado Disabled:** `bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-75`.

---

## 8. Badges & Statuses

Reglas de visualización de estados en toda la plataforma:
- **Forma:** Píldora redondeada `rounded-full`, padding `px-2.5 py-0.5 sm:py-1`.
- **Indicador de Estado:** Punto de color circular `w-1.5 h-1.5 rounded-full` al inicio del badge.
- **Tipografía:** `text-[11px] sm:text-xs font-semibold`.
- **Mapeo de Estados de Orden de Trabajo:**
  1. `PENDIENTE` (Step 1): Color Naranja (`#f97316`).
  2. `EN REPARACIÓN` (Step 2): Color Naranja (`#f97316`).
  3. `COMPLETADA` (Step 3): Verde Esmeralda (`#10b981`).
  4. `ENTREGADA` (Step 4): Verde Esmeralda Profundo (`#059669`).
  5. `HOLD` / Bloqueada: Rosa / Rojo (`#f43f5e`).
  6. Pasos no alcanzados: Gris tenue (`bg-slate-100 border-slate-200 text-slate-400`).

---

## 9. Icons

- **Librería Oficial:** `lucide-react`.
- **Grosor habitual:** `strokeWidth={2}` por defecto, `stroke-[3]` únicamente en checks de confirmación.
- **Tamaños:**
  - Micro / Metadatos: `w-3.5 h-3.5` (14px).
  - Estándar / Botones: `w-4 h-4` (16px).
  - Destacado: `w-5 h-5` (20px).
- **Regla Estricta:** No usar iconos decorativos al lado de servicios o ítems de inventario (evitar llaves, estrellas, engranajes innecesarios). Los iconos se reservan exclusivamente para acciones (Teléfono, Descarga, WhatsApp, Check de estado, Mapa).

---

## 10. Light / Dark Surfaces

- **Aplicación Interna (Taller, CRM, Inventario, Facturación, Ajustes):**
  - Utiliza el motor de temas `ThemeContext.tsx` con soporte dinámico para Modo Oscuro (predeterminado) y Modo Claro.
  - La interfaz interna se adapta mediante variables CSS (`--bg-surface`, `--border-default`, etc.).
- **Portal Público de Seguimiento (`/s/[code]` y `/[code]`):**
  - Diseñado en una versión clara profesional optimizada para clientes en smartphones.
  - Fondo: `#f8fafc`.
  - Cards: `#ffffff`.
  - Footer: `#0a0d14` (Integrado estructuralmente, proporcionando peso y anclaje al final de la página).

---

## 11. Public Portal (Arquitectura y Flujo Visual)

Flujo visual estricto del portal de clientes:
```
[ HEADER FIJO BLANCO ]
Logo Ride Lab  |  TIENDA Y TALLER DE BICICLETAS
         ↓
[ CARD PRINCIPAL (Dominante) ]
- Izquierda: ORDEN DE TRABAJO (Código)  |  BICICLETA (Marca, modelo, tipo, año)
- Derecha:   CLIENTE (Nombre)           |  FECHA DE INGRESO (Fecha + hora en 1 sola línea)
         ↓
[ ESTADO DE LA REPARACIÓN ]
Stepper 4 pasos (Pendiente -> En Reparación -> Completada -> Entregada)
         ↓
[ SERVICIOS CONTRATADOS ]
Filas limpias sin iconos (Nombre destacado, descripción secundaria, badge a la derecha)
         ↓
[ FOTOS DE RECEPCIÓN ]
Grid de 2 columnas con thumbnails de fotos reales (si existen)
         ↓
[ BOTONES DE ACCIÓN ]
- Primario: Consultar por WhatsApp
- Secundarios: Descargar Factura (habilitado solo en Entregada)  |  Llamar al Taller
         ↓
[ FOOTER OSCURO ESTRUCTURAL ]
Datos dinámicos de admin.empresa (dirección, teléfono, horario, copyright)
```

---

## 12. Do / Don't

### DO
- ✅ Usar el logotipo oficial versionado en `public/ridelab-logo-white.png` o `public/ridelab-logo.png`.
- ✅ Mantener Fecha y Hora de ingreso en una sola línea continua en negrita.
- ✅ Utilizar el Stepper como el único comunicador del estado global de la reparación.
- ✅ Mantener filas de servicios limpias con tipografía contrastada y badge a la derecha.
- ✅ Garantizar que los botones secundarios mantengan la misma altura y alineación en móvil.
- ✅ Mantener el footer oscuro integrado sin apariencia de tarjeta flotante.

### DON'T
- ❌ NO agregar bloques "Hero" decorativos redundantes si la información clave ya está en la Card Principal.
- ❌ NO duplicar badges de estado en la Card Principal y en el Stepper.
- ❌ NO colocar iconos decorativos genéricos (llaves inglesas, brillos, tuercas) por cada servicio.
- ❌ NO partir "ÚLTIMA ACTUALIZACIÓN" ni "FECHA DE INGRESO" en saltos de línea innecesarios.
- ❌ NO utilizar sombras exageradas ni bordes gruesos de estilo SaaS genérico.
- ❌ NO inventar colores que no pertenezcan a la paleta oficial de Ride Lab.

---

## 13. Component Examples

### 13.1 Card Principal (Ejemplo Canónico)
```tsx
<div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-4 sm:p-5 space-y-3.5">
  <div className="grid grid-cols-2 gap-3 sm:gap-4 items-start">
    <div className="min-w-0">
      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
        ORDEN DE TRABAJO
      </span>
      <div className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5 truncate">
        OT-202609-18
      </div>
    </div>
    <div className="text-right min-w-0">
      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
        CLIENTE
      </span>
      <div className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5 truncate max-w-[170px] ml-auto">
        Nelson Molano
      </div>
    </div>
  </div>

  <div className="border-t border-slate-100/90 pt-3.5 grid grid-cols-2 gap-3 sm:gap-4 items-start">
    <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
      <div className="min-w-0 flex-1">
        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
          BICICLETA
        </span>
        <div className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight truncate mt-0.5">
          MONDRAKER ZENDIT
        </div>
        <div className="text-[10px] sm:text-[11px] font-medium text-slate-400 uppercase tracking-wider truncate mt-0.5">
          E-BIKE • 2027 • ARENA
        </div>
      </div>
    </div>
    <div className="text-right shrink-0">
      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
        FECHA DE INGRESO
      </span>
      <div className="text-[10.5px] min-[390px]:text-[11.5px] sm:text-xs font-bold text-slate-900 whitespace-nowrap mt-0.5">
        10 sep 2026 11:30 a. m.
      </div>
    </div>
  </div>
</div>
```

### 13.2 Fila de Servicio Contratado (Sin Icono Decorativo)
```tsx
<div className="p-3 sm:p-3.5 rounded-xl bg-slate-50/80 border border-slate-100/90 flex items-center justify-between gap-3">
  <div className="min-w-0 flex-1">
    <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
      Lavado Sencillo
    </div>
    <div className="text-[11px] text-slate-500 truncate mt-0.5">
      Desengrasado y lubricación biodegradable
    </div>
  </div>
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shrink-0">
    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
    Completado
  </span>
</div>
```

---

## 14. Source Files

Los lineamientos descritos en este documento están fundamentados y verificados en los siguientes archivos reales del repositorio:

- `src/app/globals.css`: Definición del motor `@theme` de Tailwind v4, tokens CSS para Dark Mode y Light Mode, escala tipográfica canónica y scrollbars.
- `src/context/ThemeContext.tsx`: Motor de temas, sincronización de cookies y atributos `data-theme` en el DOM.
- `public/ridelab-logo.png` y `public/ridelab-logo-white.png`: Assets gráficos oficiales del logotipo de Ride Lab.
- `src/components/layout/Sidebar.tsx`: Implementación del branding en navegación lateral, proporciones de logo y botones de colapso.
- `src/components/layout/TopBar.tsx`: Implementación de barra superior, selector de tema e integración de isotipo.
- `src/lib/workshop/workOrderPipelineConfig.ts`: Fuente de verdad canónica de estados de órdenes de trabajo, códigos oficiales (`RECIBIDA`, `REPARACION`, `LISTA_ENTREGA`, `ENTREGADA`) y asignación de colores.
- `src/components/workshop/WorkOrderDetailView.jsx`: Componente maestro del detalle operativo de órdenes de trabajo en taller.
- `src/components/workshop/NewWorkOrderModal.jsx`: Modales, formularios y tipografías monoespaciadas técnicas para el taller.
- `src/components/tracking/PublicTrackingView.tsx`: Vista pública de seguimiento de reparación, implementada como extensión ligera y profesional del sistema visual Ride Lab.
