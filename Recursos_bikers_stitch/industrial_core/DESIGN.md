---
name: Industrial Core
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c6c8b6'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#909282'
  outline-variant: '#46483b'
  surface-tint: '#bbcf7c'
  primary: '#bbcf7c'
  on-primary: '#293500'
  primary-container: '#86984c'
  on-primary-container: '#232e00'
  inverse-primary: '#54651e'
  secondary: '#c8c6c5'
  on-secondary: '#313030'
  secondary-container: '#474746'
  on-secondary-container: '#b7b5b4'
  tertiary: '#c8c6c5'
  on-tertiary: '#303030'
  tertiary-container: '#929090'
  on-tertiary-container: '#2a2a2a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d7ec95'
  primary-fixed-dim: '#bbcf7c'
  on-primary-fixed: '#161e00'
  on-primary-fixed-variant: '#3d4c05'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#e4e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#474746'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  stats-number:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  container-max: 1440px
  gutter: 24px
---

## Brand & Style
The design system is engineered for "Bikers' Fort Core," a management platform that balances rugged industrial utility with premium technical precision. The brand personality is authoritative, mechanical, and meticulous, mirroring the high-performance engineering found in professional cycling hardware.

The design style is **Industrial Modernism**. It utilizes a dark, high-contrast environment to reduce eye strain in workshop settings while employing a sophisticated olive accent to denote action and status. The aesthetic avoids unnecessary flourishes, focusing instead on structural integrity, clear hierarchies, and a tactile sense of depth that feels as solid as a carbon frame.

## Colors
The palette is rooted in a "Greyscale Industrial" foundation. 
- **Primary Olive (#708238):** Used exclusively for high-priority interaction points, active states, and success indicators. It should feel like a precision-machined component.
- **Deep Charcoal & Black (#0A0A0A, #121212):** These define the environment. The deepest black is reserved for the base canvas, while the charcoal is used for elevated surface containers.
- **Supportive Neutrals:** Medium greys are used for borders and secondary text to maintain legibility without breaking the dark-mode immersion.
- **Accent Texture:** Implement a CSS-based subtle "chain link" pattern or a fine micro-dot grid at 3% opacity over large background areas to provide mechanical texture.

## Typography
This design system uses **Inter** as the primary typeface for its exceptional legibility and neutral, technical appearance. To lean into the "Core" management aspect, **JetBrains Mono** is introduced for labels, serial numbers, and technical data points, providing a "workshop manual" feel.

- **Headlines:** Should be tight, bold, and impactful.
- **Data Display:** Large numbers (inventory counts, prices) use high-weight Inter with tighter letter spacing.
- **Labels:** Use monospaced font in all-caps for metadata, such as "SKU" or "PART NO."

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid** grid. The main content area lives within a 12-column grid with a maximum width of 1440px, while sidebars remain fixed to optimize the management dashboard experience.

- **Rhythm:** A strict 4px/8px baseline grid is used to ensure vertical alignment of technical data.
- **Margins:** 24px margins on mobile, scaling to 40px on desktop to provide breathing room around dense data tables.
- **Density:** High-density layouts are preferred for inventory and scheduling views, using 8px padding within table cells to maximize information visibility.

## Elevation & Depth
In this dark environment, depth is communicated through **Tonal Elevation** rather than traditional heavy shadows.
- **Base (Level 0):** #0A0A0A — The background canvas.
- **Surface (Level 1):** #121212 — Main content cards and panels.
- **Overlay (Level 2):** #1C1C1C — Modals and tooltips.

**Borders:** Use a subtle 1px "inner stroke" (#262626) on all elevated containers to define edges against the black background.
**Shadows:** Use a "Glow-Shadow" for active elements: a very soft, low-spread shadow tinted with the primary olive color (0.15 opacity) to make active components feel energized.

## Shapes
The shape language is "Calculated Softness." Elements use an 8px radius (`rounded-md`) as a standard, providing a modern feel that isn't as aggressive as sharp corners but far more professional than pill shapes.
- **Standard UI (Buttons, Inputs):** 8px radius.
- **Containers (Cards, Modals):** 12px-16px radius to frame content effectively.
- **Status Indicators:** Small 4px radius for tags/chips to maintain a compact, technical look.

## Components
- **Buttons:** Primary buttons are solid Olive (#708238) with White text. Secondary buttons are "Ghost" style: 1px Grey-800 border with a subtle hover state that reveals a 10% Olive tint.
- **Inputs:** Darker than the surface (#050505) with a 1px border. Focus state triggers a 1px Olive border and a faint glow.
- **Chips:** Monospaced text inside a 4px rounded box. Use Olive for "In Stock" and a muted amber for "Repair in Progress."
- **Data Tables:** Zebra-striping is avoided; instead, use 1px horizontal dividers (#1A1A1A). Header cells use the `label-caps` typography style.
- **Inventory Cards:** Feature a high-contrast image slot on the left, with technical specs on the right using monospaced fonts for SKU and sizing.
- **Progress Bars:** Thin (4px height) with the Olive fill. For critical warnings (overdue repairs), use a sharp Crimson (#B91C1C).