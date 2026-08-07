---
name: Industrial Performance System
colors:
  surface: '#13140f'
  surface-dim: '#13140f'
  surface-bright: '#393a33'
  surface-container-lowest: '#0e0f0a'
  surface-container-low: '#1b1c17'
  surface-container: '#1f201a'
  surface-container-high: '#2a2a24'
  surface-container-highest: '#35352f'
  on-surface: '#e4e3d9'
  on-surface-variant: '#c7c8b7'
  inverse-surface: '#e4e3d9'
  inverse-on-surface: '#30312b'
  outline: '#919282'
  outline-variant: '#46483b'
  surface-tint: '#bfce7f'
  primary: '#bfce7f'
  on-primary: '#2b3400'
  primary-container: '#89974f'
  on-primary-container: '#252d00'
  inverse-primary: '#576421'
  secondary: '#c3c6d0'
  on-secondary: '#2d3138'
  secondary-container: '#43474f'
  on-secondary-container: '#b2b5be'
  tertiary: '#bdc7dc'
  on-tertiary: '#273141'
  tertiary-container: '#8791a5'
  on-tertiary-container: '#202a3a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dbea98'
  primary-fixed-dim: '#bfce7f'
  on-primary-fixed: '#181e00'
  on-primary-fixed-variant: '#404c0a'
  secondary-fixed: '#dfe2ec'
  secondary-fixed-dim: '#c3c6d0'
  on-secondary-fixed: '#181c23'
  on-secondary-fixed-variant: '#43474f'
  tertiary-fixed: '#d9e3f9'
  tertiary-fixed-dim: '#bdc7dc'
  on-tertiary-fixed: '#121c2c'
  on-tertiary-fixed-variant: '#3d4759'
  background: '#13140f'
  on-background: '#e4e3d9'
  surface-variant: '#35352f'
typography:
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.1em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '800'
    lineHeight: '1.2'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  container-max: 1440px
---

## Brand & Style

The design system is engineered for a premium, industrial workshop environment. It balances the rugged durability of high-end mountain biking with the precision of a professional management tool. The aesthetic is "Matte Industrial"—utilizing deep charcoals, military olive accents, and technical linework.

The emotional response is one of reliability, mechanical precision, and "armored" protection. Drawing from **Minimalism** and **Modern Corporate** styles, the UI prioritizes clarity and efficiency while incorporating subtle tactile elements like hairline borders and gear-inspired patterns to root the digital experience in the physical workshop.

## Colors

The palette is anchored in a high-performance dark mode. 

- **Deep Background:** A matte charcoal (#0a0c10) that reduces glare and provides a stable foundation for workshop environments.
- **Surface Layering:** Panels and cards utilize #161a21, creating a subtle lift from the background.
- **The Accent:** Military Olive (#84924a) is used sparingly for primary actions, success states, and brand-critical highlights.
- **Borders:** Fine, low-contrast borders (#2d3748) are essential to the industrial aesthetic, replacing heavy shadows with structural definition.

## Typography

This design system uses **Hanken Grotesk** as the primary typeface for its sharp, technical feel and excellent readability in low-light environments. 

**JetBrains Mono** is introduced for labels, status chips, and technical data points (like serial numbers or part dimensions) to reinforce the "workshop/engineering" narrative. 

Headlines should use tight letter spacing and heavy weights to mimic the bold, impactful presence of industrial machinery. Body text maintains generous line height for clarity during fast-paced management tasks.

## Layout & Spacing

The layout philosophy follows a **Fixed-Fluid Hybrid Grid**. Content is housed within a 12-column grid system that maxes out at 1440px to ensure management dashboards remain scannable on large monitors.

- **Rhythm:** A 4px baseline unit governs all padding and margin, ensuring a mathematically precise "engineered" look.
- **Density:** High information density is permitted for workshop management views (inventory, schedules), while customer-facing views (shop fronts) should utilize larger 64px or 80px vertical breathing spaces.
- **Breakpoints:** 
  - Mobile (<768px): 4-column layout, 16px margins.
  - Tablet (768px - 1024px): 8-column layout, 24px margins.
  - Desktop (>1024px): 12-column layout, 40px margins.

## Elevation & Depth

Elevation in this design system is achieved through **Tonal Layering and Borders** rather than traditional soft shadows.

- **Surfaces:** Use #161a21 for primary cards. For secondary popovers or nested containers, use #1c2129.
- **Borders:** Every container must have a 1px solid border (#2d3748). This simulates the "joinery" of industrial parts.
- **Depth:** To indicate a "lifted" state (e.g., an active modal), use a sharp, 0-blur offset shadow: `4px 4px 0px rgba(0,0,0,0.5)`.
- **Textures:** A subtle 5% opacity "grid" or "dot" pattern can be applied to the background (#0a0c10) to suggest a technical blueprint or workshop floor.

## Shapes

The shape language is **Soft (0.25rem)**. While a bike is organic, the tools and workshop environment are defined by rigid, precise corners. 

- **Primary Corners:** 4px (Soft) for buttons, inputs, and small cards.
- **Large Containers:** 8px (rounded-lg) for main dashboard sections.
- **Interaction Feedback:** Hover states should remain geometric; avoid pill-shapes unless used for status indicators (chips) where high differentiation is needed.

## Components

- **Buttons:** Primary buttons use the Military Olive (#84924a) with white text. They should have a 1px inset top-border of a lighter green to simulate a beveled industrial edge.
- **Input Fields:** Background should be the deepest charcoal (#0a0c10) with a #2d3748 border. Focus state switches the border to the Accent color.
- **Chips/Status:** Use JetBrains Mono. High-priority statuses (Urgent Repair) use high-contrast fills; low-priority statuses use outlined variants.
- **Cards:** Cards should never have shadows in their resting state. Use the border-only approach. On hover, the border color should brighten to #4a5568.
- **Progress Bars:** Use a "segmented" style (dividing the bar into small blocks) to resemble a bike chain or gear teeth.
- **Technical Lists:** Use alternating row highlights (Zebra striping) with #161a21 and #1c2129 to manage large datasets in the workshop management view.