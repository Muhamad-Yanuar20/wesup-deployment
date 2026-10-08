---
version: alpha
name: Pinterest
description: "Pinterest is a visual discovery platform whose surface is a stark white canvas punctuated by a single high-saturation red — a brand red so confident it needs no gradient, no secondary accent, no mesh. The entire colour system is three tokens: a near-black ink for text, white for every surface, and that unmistakable crimson primary that carries every call-to-action and the wordmark itself. Type is set in a proprietary rounded geometric sans (Pin Sans) at weights 700 for display and 400 for body — a face that reads warm and approachable rather than editorial. The decoration system is the imagery: a collage of real user photographs arranged in a loose masonry grid, offset and overlapping at hero scale, doing all the atmospheric work that another brand would assign to gradient or illustration."
colors:
  primary: "#e60023"
  on-primary: "#ffffff"
  ink: "#111111"
  body: "#211922"
  mute: "#767676"
  hairline: "#e0e0e0"
  canvas: "#ffffff"
  canvas-soft: "#f4f0eb"
  link: "#e60023"
  success: "#00a854"
  error: "#e60023"
  warning: "#f5a623"
  selection-bg: "#e60023"
  selection-fg: "#ffffff"
  nav-bg: "#ffffff"
  pill-ghost-bg: "#efefef"
  pill-ghost-text: "#111111"
typography:
  display-xl:
    fontFamily: Pin Sans, -apple-system, system-ui, Segoe UI, Roboto, Helvetica Neue, Helvetica, Arial, sans-serif
    fontSize: 48px
    fontWeight: 700
    lineHeight: 52px
    letterSpacing: -0.5px
  display-lg:
    fontFamily: Pin Sans, -apple-system, system-ui, Segoe UI, Roboto, Helvetica Neue, Helvetica, Arial, sans-serif
    fontSize: 36px
    fontWeight: 700
    lineHeight: 40px
    letterSpacing: -0.5px
  display-md:
    fontFamily: Pin Sans, -apple-system, system-ui, Segoe UI, Roboto, Helvetica Neue, Helvetica, Arial, sans-serif
    fontSize: 24px
    fontWeight: 700
    lineHeight: 26.4px
    letterSpacing: -0.5px
  display-sm:
    fontFamily: Pin Sans, -apple-system, system-ui, Segoe UI, Roboto, Helvetica Neue, Helvetica, Arial, sans-serif
    fontSize: 20px
    fontWeight: 700
    lineHeight: 24px
    letterSpacing: -0.5px
  body-lg:
    fontFamily: Pin Sans, -apple-system, system-ui, Segoe UI, Roboto, Helvetica Neue, Helvetica, Arial, sans-serif
    fontSize: 18px
    fontWeight: 400
    lineHeight: 26px
  body-md:
    fontFamily: Pin Sans, -apple-system, system-ui, Segoe UI, Roboto, Helvetica Neue, Helvetica, Arial, sans-serif
    fontSize: 16px
    fontWeight: 400
    lineHeight: 22.4px
  body-md-strong:
    fontFamily: Pin Sans, -apple-system, system-ui, Segoe UI, Roboto, Helvetica Neue, Helvetica, Arial, sans-serif
    fontSize: 16px
    fontWeight: 700
    lineHeight: 22.4px
  body-sm:
    fontFamily: Pin Sans, -apple-system, system-ui, Segoe UI, Roboto, Helvetica Neue, Helvetica, Arial, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
  body-sm-strong:
    fontFamily: Pin Sans, -apple-system, system-ui, Segoe UI, Roboto, Helvetica Neue, Helvetica, Arial, sans-serif
    fontSize: 14px
    fontWeight: 700
    lineHeight: 20px
  caption:
    fontFamily: Pin Sans, -apple-system, system-ui, Segoe UI, Roboto, Helvetica Neue, Helvetica, Arial, sans-serif
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
  button-md:
    fontFamily: Pin Sans, -apple-system, system-ui, Segoe UI, Roboto, Helvetica Neue, Helvetica, Arial, sans-serif
    fontSize: 12px
    fontWeight: 700
    lineHeight: 16px
  button-lg:
    fontFamily: Pin Sans, -apple-system, system-ui, Segoe UI, Roboto, Helvetica Neue, Helvetica, Arial, sans-serif
    fontSize: 16px
    fontWeight: 700
    lineHeight: 20px
  nav-link:
    fontFamily: Pin Sans, -apple-system, system-ui, Segoe UI, Roboto, Helvetica Neue, Helvetica, Arial, sans-serif
    fontSize: 16px
    fontWeight: 700
    lineHeight: 20px
rounded:
  none: 0px
  xs: 4px
  sm: 8px
  button: 16px
  md: 16px
  lg: 24px
  xl: 32px
  pill: 999px
  full: 9999px
spacing:
  xxs: 4px
  xs: 6px
  sm: 8px
  md: 14px
  lg: 16px
  xl: 32px
  2xl: 48px
  3xl: 64px
  4xl: 100px
  5xl: 182px
  section: 90px
components:
  nav-bar:
    backgroundColor: "{colors.nav-bg}"
    textColor: "{colors.body}"
    typography: "{typography.nav-link}"
    height: 64px
    padding: "{spacing.sm} {spacing.lg}"
  nav-link:
    textColor: "{colors.body}"
    typography: "{typography.nav-link}"
    rounded: "{rounded.pill}"
    padding: "{spacing.xs} {spacing.md}"
  nav-cta-login:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-lg}"
    rounded: "{rounded.button}"
    padding: "{spacing.xs} {spacing.lg}"
  nav-cta-signup:
    backgroundColor: "{colors.pill-ghost-bg}"
    textColor: "{colors.pill-ghost-text}"
    typography: "{typography.button-lg}"
    rounded: "{rounded.button}"
    padding: "{spacing.xs} {spacing.lg}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.button}"
    padding: "{spacing.xs} {spacing.md}"
    border: 2px solid transparent
  button-secondary:
    backgroundColor: "{colors.pill-ghost-bg}"
    textColor: "{colors.pill-ghost-text}"
    typography: "{typography.button-md}"
    rounded: "{rounded.button}"
    padding: "{spacing.xs} {spacing.md}"
  button-pill-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-lg}"
    rounded: "{rounded.button}"
    padding: "{spacing.xs} {spacing.lg}"
  button-pill-secondary:
    backgroundColor: "{colors.pill-ghost-bg}"
    textColor: "{colors.pill-ghost-text}"
    typography: "{typography.button-lg}"
    rounded: "{rounded.button}"
    padding: "{spacing.xs} {spacing.lg}"
  hero-band:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.display-xl}"
    padding: "{spacing.4xl} {spacing.lg}"
  feature-band:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.display-lg}"
    padding: "{spacing.section} {spacing.lg}"
  pin-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
  pin-card-overlay:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-sm-strong}"
    rounded: "{rounded.md}"
  masonry-grid:
    backgroundColor: "{colors.canvas}"
    padding: "{spacing.sm}"
    gap: "{spacing.sm}"
  section-headline:
    textColor: "{colors.ink}"
    typography: "{typography.display-lg}"
    padding: "{spacing.xl} {spacing.lg}"
  section-body:
    textColor: "{colors.body}"
    typography: "{typography.body-lg}"
    padding: "{spacing.sm} {spacing.lg}"
  footer:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.mute}"
    typography: "{typography.caption}"
    padding: "{spacing.xl} {spacing.lg}"
  link-inline:
    textColor: "{colors.link}"
    typography: "{typography.body-md}"
  badge:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "{spacing.xxs} {spacing.xs}"
  form-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body}"
    borderColor: "{colors.hairline}"
    typography: "{typography.body-md}"
    rounded: "{rounded.pill}"
    padding: "{spacing.sm} {spacing.lg}"
    height: 48px
  topic-pill:
    backgroundColor: "{colors.pill-ghost-bg}"
    textColor: "{colors.pill-ghost-text}"
    typography: "{typography.body-sm-strong}"
    rounded: "{rounded.pill}"
    padding: "{spacing.xs} {spacing.md}"
  ex-pricing-tier:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.md}"
    padding: "{spacing.xl}"
  ex-pricing-tier-featured:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "{spacing.xl}"
  ex-product-selector:
    backgroundColor: "{colors.canvas-soft}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
  ex-cart-drawer:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
    item-divider: "{colors.hairline}"
  ex-app-shell-row:
    backgroundColor: "{colors.canvas}"
    activeIndicator: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xs} {spacing.sm}"
  ex-data-table-cell:
    headerBackground: "{colors.canvas-soft}"
    headerTypography: "{typography.body-sm-strong}"
    bodyTypography: "{typography.body-sm}"
    cellPadding: "{spacing.xs} {spacing.sm}"
    rowBorder: "{colors.hairline}"
  ex-auth-form-card:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
  ex-modal-card:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
  ex-empty-state-card:
    backgroundColor: "{colors.canvas-soft}"
    rounded: "{rounded.lg}"
    padding: "{spacing.2xl}"
    captionTypography: "{typography.body-md}"
  ex-toast:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.button}"
    padding: "{spacing.sm} {spacing.md}"
    typography: "{typography.body-sm}"
---
## Overview

Pinterest is one of the most restrained one-colour brands on the consumer web — and it earns that restraint. The entire marketing surface runs on three values: white canvas, near-black ink, and `{colors.primary}`, a pure punchy red that carries the wordmark, every primary CTA, and every interactive accent simultaneously. There are no gradients, no illustration-system, no decorative stroke work. The photography does the atmospheric lifting. At hero scale a loose collage of user photographs — staggered, overlapping, cropped at different ratios — creates all the visual energy the page needs. Pinterest does not need a colour system to feel expressive; it outsources expression entirely to its content.

Type is set in Pin Sans, the brand's own proprietary geometric rounded sans. The face is warmer than a sharp geometric (rounded terminals, open apertures) and the brand uses it boldly at weight 700 for every headline and button label, dropping cleanly to 400 for body copy. There is no monospaced voice, no editorial serif, no secondary typeface of any kind. Sentence-case headlines with slight negative tracking (`-0.5px`) give the display sizes calm authority without the corporate stiffness of all-caps.

The layout philosophy matches the content model. Masonry grids with a tight `{spacing.sm}` gutter let images breathe without imposing rigid column discipline. The hero sits on a pure white band; the first editorial section below transitions to a warm off-white (`{colors.canvas-soft}`) — the softest possible surface shift. Buttons at marketing scale are true pill shapes (`{rounded.pill}` 999px) while small utility buttons retain the brand's measured 16px radius (`{rounded.button}`), and both scales coexist deliberately depending on context.

**Key characteristics:**
- Single-accent system — `{colors.primary}` red is the ONLY brand colour; it must never share the page with a competing accent.
- Photography-first decoration — the masonry collage IS the hero; no gradient or illustration supplements it.
- Two-radius vocabulary — `{rounded.button}` 16px for small utility buttons and inputs, `{rounded.pill}` 999px for nav CTAs and marketing-scale calls to action.
- Pin Sans at 700 for all display and button labels; 400 for all body; no intermediate weights or secondary faces.
- Warm off-white `{colors.canvas-soft}` (`#f4f0eb`) as the alternating section background — the brand's only surface step besides pure white and the dark footer.

## Colors

### Brand & Accent
- **Primary Red** (`{colors.primary}` — `#e60023`): The brand's singular accent. Used for the Pinterest wordmark and logo, every primary CTA button, every link hover state, and every interactive indicator. This red is the entire colour personality of the brand; it is never diluted into a tint or supplemented by a second accent.
- **On Primary** (`{colors.on-primary}` — `#ffffff`): White text and icon colour used on red surfaces — nav login button, primary marketing CTA, badge fills.
- **Link** (`{colors.link}` — `#e60023`): Inline links resolve to the same primary red, maintaining the single-accent discipline.

### Surface
- **Canvas** (`{colors.canvas}` — `#ffffff`): The default page and card background. The hero band, the nav, card surfaces, modals, and the footer all sit on pure white.
- **Canvas Soft** (`{colors.canvas-soft}` — `#f4f0eb`): A warm, slightly parchment-toned off-white used for alternating editorial sections ("Step into soccer season" band). Visible in the screenshot as the warm section below the white hero. Not a cool gray — it has a distinctly warm, organic undertone.
- **Pill Ghost BG** (`{colors.pill-ghost-bg}` — `#efefef`): The light gray fill used for secondary buttons ("I already have an account", "Sign up" ghost state in nav). A soft neutral that reads as "inactive" against the red primary.

### Text
- **Ink** (`{colors.ink}` — `#111111`): Headline and primary label text. Used at display scale on both white and warm-off-white surfaces.
- **Body** (`{colors.body}` — `#211922`): The brand's near-black body copy tone — very close to ink but with a faint warm-purple undertone consistent with the logo palette.
- **Mute** (`{colors.mute}` — `#767676`): De-emphasised text — footer legal copy, secondary captions, placeholder text in search inputs.
- **Pill Ghost Text** (`{colors.pill-ghost-text}` — `#111111`): Labels on ghost / secondary buttons and topic pills.

### Semantic
- **Error** (`{colors.error}` — `#e60023`): Shares the primary red; destructive states and validation errors use the same brand token.
- **Success** (`{colors.success}` — `#00a854`): Green success indicator for confirmations — not prominent in the marketing surface but present in the product.
- **Warning** (`{colors.warning}` — `#f5a623`): Amber caution state — product-layer only, not visible in marketing.
- **Hairline** (`{colors.hairline}` — `#e0e0e0`): 1px dividers on form inputs, row separators, and card borders when a border is needed.

## Typography

### Font Family
Pinterest runs on a single proprietary face: **Pin Sans**. It is a rounded geometric sans that covers every display size, every body paragraph, every button label, and every nav link. There is no monospaced voice, no serif, no secondary face. The typeface's rounded terminals are the subtle warmth cue — without them, the colour system alone would read clinical.

Open-source substitute: *Nunito* (700 / 400) is the closest rounded geometric available. *Poppins* is the second option.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xl}` | 48px | 700 | 52px | -0.5px | Hero headline at marketing scale — "Create the life you love on Pinterest." |
| `{typography.display-lg}` | 36px | 700 | 40px | -0.5px | Section headlines — "Step into soccer season". |
| `{typography.display-md}` | 24px | 700 | 26.4px | -0.5px | Sub-section or card cluster headlines. Extracted h1 measurement. |
| `{typography.display-sm}` | 20px | 700 | 24px | -0.5px | Inline display micro-headings. |
| `{typography.body-lg}` | 18px | 400 | 26px | 0 | Lead body copy under section headlines — "Flex your fandom and score fresh inspiration." |
| `{typography.body-md}` | 16px | 400 | 22.4px | 0 | Default body paragraph. Extracted h2 size. |
| `{typography.body-md-strong}` | 16px | 700 | 22.4px | 0 | Bolded inline body, sub-heading labels. |
| `{typography.body-sm}` | 14px | 400 | 20px | 0 | Pin card captions, secondary metadata. |
| `{typography.body-sm-strong}` | 14px | 700 | 20px | 0 | Topic pill labels, card overlay CTAs. |
| `{typography.caption}` | 12px | 400 | 16px | 0 | Footer legal copy, fine print, badge labels. |
| `{typography.button-md}` | 12px | 700 | 16px | 0 | Small utility button labels — extracted CTA fontSize 12px. |
| `{typography.button-lg}` | 16px | 700 | 20px | 0 | Marketing-scale pill button labels — nav Login / Sign up. |
| `{typography.nav-link}` | 16px | 700 | 20px | 0 | Nav link labels — "Explore", "Shop", "About", "Businesses". |

### Principles
- **Single typeface, two weights.** Pin Sans 700 carries everything commanding; Pin Sans 400 carries everything informational. The brand never splits across faces.
- **Slight negative tracking at display sizes.** `-0.5px` at every headline size gives the rounded face just enough sharpness to avoid reading as soft. Body text stays at neutral tracking.
- **Sentence-case throughout.** Headlines are sentence-case — "Create the life you love on Pinterest", "Step into soccer season". All-caps never appears in the brand voice.
- **The face is warm, not technical.** Do not substitute a neutral grotesque (Inter, Helvetica) — the rounded terminals are load-bearing personality.

## Layout

### Spacing System
- **Base unit**: 4px. The extracted scale (`4px, 6px, 8px, 14px, 16px`) is not strictly base-4 above 4px — it reflects Pinterest's own pragmatic UI spacing decisions rather than a mathematical grid.
- **Tokens**: `{spacing.xxs}` 4px · `{spacing.xs}` 6px · `{spacing.sm}` 8px · `{spacing.md}` 14px · `{spacing.lg}` 16px · `{spacing.xl}` 32px · `{spacing.2xl}` 48px · `{spacing.3xl}` 64px · `{spacing.4xl}` 100px · `{spacing.5xl}` 182px · `{spacing.section}` 90px.
- **Section padding**: editorial bands use `{spacing.section}` 90px top/bottom to give the masonry imagery room to establish itself. The hero uses `{spacing.4xl}` 100px top to push the headline clear of the nav.
- **Card interior padding**: pin cards are padless at the image level — the image fills the card — with internal text overlays or below-image captions sitting at `{spacing.sm}` 8px inset.
- **Button padding**: small utility buttons use `{spacing.xs}` 6px × `{spacing.md}` 14px (extracted). Marketing pill buttons use `{spacing.xs}` 6px × `{spacing.lg}` 16px.
- **Masonry gutter**: `{spacing.sm}` 8px between pin columns and rows, consistent across the grid.

### Grid & Container
- **Max width**: ~1200px centred with horizontal gutters of `{spacing.lg}` 16px on mobile and `{spacing.xl}` 32px on desktop.
- **Column patterns**:
  - Hero: left-column headline + CTA row (roughly 45% width) with right-column photo collage (55% width) at desktop; stacks vertically at mobile.
  - Masonry pin grid: variable-column fluid grid — 2-up on mobile, 4-up on tablet, 5–6-up on desktop, driven by a fixed column width rather than a percentage grid.
  - Feature editorial section: single centred column with headline + body centred, max ~700px wide.
  - Nav: logo + left links left-aligned, right links + CTA cluster right-aligned, full-width.

### Whitespace Philosophy
Pinterest's whitespace is image-driven, not margin-driven. The masonry grid tiles to the full container width with only `{spacing.sm}` 8px gaps — the images themselves are the breathing space. Editorial sections outside the grid are deliberately generous: `{spacing.section}` 90px vertical padding lets the warm off-white band settle before and after its headline. The hero white band is the emptiest surface on the page — the imagery on the right provides density while the left holds a single lean headline and two buttons.

### Responsive Strategy

#### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 600px | Hero stacks vertically; photo collage moves below headline; masonry drops to 2 columns; nav collapses to logo + icon buttons. |
| Tablet | 600–959px | Masonry 3–4 columns; hero may still stack; nav link row visible. |
| Desktop | 960–1199px | Full split hero; masonry 4–5 columns; nav fully expanded. |
| Wide | ≥ 1200px | Content centred at ~1200px; masonry extends to 6 columns. |

#### Touch Targets
Nav CTA pills ("Log in", "Sign up") render at ~40px tall. Marketing hero CTAs ("Join Pinterest for free") render at approximately 44–48px tall. Both comfortably meet WCAG minimum touch target size, aided by the generous horizontal padding.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Level 0 — Flat | No shadow, no border. | Hero band, masonry images, full-bleed editorial bands. |
| Level 1 — Hairline Card | `0 0 0 1px {colors.hairline}` inset. | Form inputs, secondary button outlines when bordered. |
| Level 2 — Soft Drop | `0 2px 8px rgba(0,0,0,0.08)` | Pin card hover state — a gentle lift to indicate interactivity. |
| Level 3 — Overlay | `0 4px 16px rgba(0,0,0,0.12)` | Modals, drawers, dropdown menus. |

Pinterest's elevation model is deliberately minimal. The masonry images carry all visual weight; card surfaces are flat by default, elevating only on hover. The brand uses no stacked-shadow construction — a single soft drop is sufficient because the imagery provides the depth cue.

### Decorative Depth
- **Masonry photo collage as atmospheric depth**: the staggered, overlapping grid of user photographs at hero scale is the brand's primary depth and atmosphere mechanism — no gradient, no 3D illustration, no mesh.
- **Warm surface shift as band depth**: transitioning from `{colors.canvas}` to `{colors.canvas-soft}` is the only surface-level depth cue between editorial sections.
- **Red primary as focal depth**: `{colors.primary}` buttons sit above every neutral surface chromatically, creating hierarchy without elevation.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Full-bleed hero images, masonry images at the grid edge, header/footer bands. |
| `{rounded.xs}` | 4px | Tightest UI detail — icon chips, avatar size-indicator dots. |
| `{rounded.sm}` | 8px | Internal card chrome for tightly-spaced UI rows. |
| `{rounded.button}` | 16px | **The brand's primary UI radius.** Small utility buttons ("Join Pinterest for free" hero CTA as extracted, inline action buttons), form inputs, notification badges. This is the measured primary button radius — all small buttons use this value. |
| `{rounded.md}` | 16px | Alias of `{rounded.button}` — pin card chrome, tag chip elements. |
| `{rounded.lg}` | 24px | Larger card surfaces, modal containers. |
| `{rounded.xl}` | 32px | Largest card chrome — showcase image frames with prominent corner treatment. |
| `{rounded.pill}` | 999px | **Marketing-scale CTAs.** Nav "Log in" and "Sign up" buttons, "I already have an account" secondary button, topic/interest pills. These are explicitly pill-shaped and visually distinct from the 16px utility buttons. |
| `{rounded.full}` | 9999px | Avatar frames, circular icon buttons. |

### Photography Geometry
- **Hero collage**: 3–4 overlapping photographs at variable crop ratios, arranged in a loose stagger. Each individual photo has `{rounded.lg}` corners. The collage as a whole is the hero's sole decoration.
- **Masonry pin images**: variable-height images in a uniform-width column system; each image has `{rounded.md}` 16px corners. The rounded corners are consistent across the entire feed — a gentle, approachable detail that distinguishes Pinterest's grid from a flat image table.
- **Profile avatars**: circular crop, `{rounded.full}`.

## Components

### Buttons

**`button-primary`** — small utility red button used for in-feed and in-form CTAs.
- Background `{colors.primary}`, text `{colors.on-primary}`, label in `{typography.button-md}` (12px / 700), padding `{spacing.xs}` × `{spacing.md}`, shape `{rounded.button}` 16px, 2px solid transparent border (extracted measurement). Renders ~28–32px tall in utility contexts.

**`button-secondary`** — ghost-fill secondary to `button-primary` at the same scale.
- Background `{colors.pill-ghost-bg}`, text `{colors.pill-ghost-text}`, same typography + padding + shape as `button-primary`.

**`button-pill-primary`** — the large red pill CTA used at marketing and nav scale.
- Background `{colors.primary}`, text `{colors.on-primary}`, label in `{typography.button-lg}` (16px / 700), padding `{spacing.xs}` × `{spacing.lg}`, shape `{rounded.pill}` 999px. Used for "Join Pinterest for free" hero CTA and the nav "Log in" button.

**`button-pill-secondary`** — the ghost-fill pill paired with `button-pill-primary`.
- Background `{colors.pill-ghost-bg}`, text `{colors.pill-ghost-text}`, same typography + shape. Used for "I already have an account" and "Sign up" ghost state in nav.

**`topic-pill`** — interest / topic category pill in the discovery layer.
- Background `{colors.pill-ghost-bg}`, text `{colors.pill-ghost-text}`, label in `{typography.body-sm-strong}`, padding `{spacing.xs}` × `{spacing.md}`, shape `{rounded.pill}`.

### Cards & Containers

**`pin-card`** — the canonical masonry image tile.
- Background `{colors.canvas}`, text `{colors.ink}`, image fills the full card width, `{rounded.md}` 16px corners. No internal padding at image level; below-image caption text at `{spacing.sm}` 8px inset. Elevates to Level 2 drop shadow on hover.

**`pin-card-overlay`** — pin card variant with on-image text overlay (save button, board name).
- Inherits `pin-card` chrome. Text on overlay surfaces in `{colors.on-primary}` against a semi-transparent dark scrim.

**`masonry-grid`** — the layout container for pin cards.
- Background `{colors.canvas}`, column gap and row gap both `{spacing.sm}` 8px. Variable column count driven by fixed-width column units rather than percentage fractions.

**`hero-band`** — the white split-layout hero with photo collage.
- Background `{colors.canvas}`, text `{colors.ink}`, padding `{spacing.4xl}` top + `{spacing.lg}` horizontal. Inside: headline in `{typography.display-xl}`, then CTA row with `button-pill-primary` + `button-pill-secondary`. Photo collage occupies the right column.

**`feature-band`** — the warm off-white editorial section below the hero.
- Background `{colors.canvas-soft}`, text `{colors.ink}`, padding `{spacing.section}` × `{spacing.lg}`. Inside: centred headline in `{typography.display-lg}`, body in `{typography.body-lg}`.

**`section-headline`** — the centred headline block within a feature band.
- Text `{colors.ink}`, typography `{typography.display-lg}`, padding `{spacing.xl}` × `{spacing.lg}`.

**`section-body`** — the supporting paragraph under a section headline.
- Text `{colors.body}`, typography `{typography.body-lg}`, padding `{spacing.sm}` × `{spacing.lg}`.

### Navigation

**`nav-bar`** — the top navigation bar.
- Background `{colors.nav-bg}` white, height 64px, padding `{spacing.sm}` × `{spacing.lg}`. Layout: Pinterest logo (red wordmark) + "Explore / Shop" links on the left, "About / Businesses / Create / News" in the centre-right, "Log in / Sign up" CTA cluster at the far right.

**`nav-link`** — individual navigation text link.
- Text `{colors.body}`, typography `{typography.nav-link}`, padding `{spacing.xs}` × `{spacing.md}`, shape `{rounded.pill}` (hover ghost state).

**`nav-cta-login`** — the red "Log in" pill in the nav.
- Background `{colors.primary}`, text `{colors.on-primary}`, typography `{typography.button-lg}`, shape `{rounded.pill}`.

**`nav-cta-signup`** — the ghost "Sign up" pill in the nav.
- Background `{colors.pill-ghost-bg}`, text `{colors.pill-ghost-text}`, typography `{typography.button-lg}`, shape `{rounded.pill}`.

### Inputs & Forms

**`form-input`** — the search or email input field.
- Background `{colors.canvas}`, text `{colors.body}`, border `1px solid {colors.hairline}`, typography `{typography.body-md}`, shape `{rounded.pill}` (search bar is pill-shaped), padding `{spacing.sm}` × `{spacing.lg}`, height 48px.

### Supplementary

**`badge`** — small metadata pill (notification count, "New" label).
- Background `{colors.primary}`, text `{colors.on-primary}`, typography `{typography.caption}`, shape `{rounded.pill}`, padding `{spacing.xxs}` × `{spacing.xs}`.

**`link-inline`** — body-copy inline links.
- Text `{colors.link}` (same red as primary), typography `{typography.body-md}`.

**`footer`** — the bottom navigation and legal band.
- Background `{colors.canvas}`, text `{colors.mute}`, typography `{typography.caption}`, padding `{spacing.xl}` × `{spacing.lg}`.

### Examples (illustrative)

**`ex-pricing-tier`** — Default tier card. Canvas-soft surface with hairline border.
- `backgroundColor: "{colors.canvas-soft}"`, `textColor: "{colors.ink}"`, `borderColor: "{colors.hairline}"`, `rounded: "{rounded.md}"`, `padding: "{spacing.xl}"`

**`ex-pricing-tier-featured`** — Featured tier — polarity-flipped to primary red with white text.
- `backgroundColor: "{colors.primary}"`, `textColor: "{colors.on-primary}"`, `rounded: "{rounded.md}"`, `padding: "{spacing.xl}"`

**`ex-product-selector`** — Feature summary card for vertical-specific content.
- `backgroundColor: "{colors.canvas-soft}"`, `rounded: "{rounded.md}"`, `padding: "{spacing.lg}"`

**`ex-cart-drawer`** — Subscription or saved-item summary panel.
- `backgroundColor: "{colors.canvas}"`, `rounded: "{rounded.md}"`, `padding: "{spacing.lg}"`, `item-divider: "{colors.hairline}"`

**`ex-app-shell-row`** — Sidebar nav row. Active state uses `{colors.primary}` as the left-edge indicator.
- `backgroundColor: "{colors.canvas}"`, `activeIndicator: "{colors.primary}"`, `rounded: "{rounded.sm}"`, `padding: "{spacing.xs} {spacing.sm}"`

**`ex-data-table-cell`** — Data table chrome. Header uses body-sm-strong; body uses body-sm.
- `headerBackground: "{colors.canvas-soft}"`, `headerTypography: "{typography.body-sm-strong}"`, `bodyTypography: "{typography.body-sm}"`, `cellPadding: "{spacing.xs} {spacing.sm}"`, `rowBorder: "{colors.hairline}"`

**`ex-auth-form-card`** — Sign-in / sign-up card. Canvas surface with pin-card chrome.
- `backgroundColor: "{colors.canvas}"`, `rounded: "{rounded.lg}"`, `padding: "{spacing.xl}"`

**`ex-modal-card`** — Modal dialog surface — flat canvas with Level 3 overlay shadow.
- `backgroundColor: "{colors.canvas}"`, `rounded: "{rounded.lg}"`, `padding: "{spacing.xl}"`

**`ex-empty-state-card`** — Empty-state frame on warm surface.
- `backgroundColor: "{colors.canvas-soft}"`, `rounded: "{rounded.lg}"`, `padding: "{spacing.2xl}"`, `captionTypography: "{typography.body-md}"`

**`ex-toast`** — Toast notification — flat card with soft drop shadow.
- `backgroundColor: "{colors.canvas}"`, `rounded: "{rounded.button}"`, `padding: "{spacing.sm} {spacing.md}"`, `typography: "{typography.body-sm}"`

## Do's and Don'ts

### Do
- Use `{colors.primary}` red exclusively as the single brand accent. It carries the logo, every CTA, every link state, and every interactive indicator — all from one token.
- Apply `{rounded.pill}` 999px to nav CTAs and marketing-scale calls to action. Apply `{rounded.button}` 16px to small utility buttons and form inputs. Both scales coexist; choose based on context.
- Set every headline in Pin Sans weight 700, sentence-case, with `-0.5px` letter-spacing. The slight negative tracking sharpens what would otherwise read as a soft, round face.
- Let the masonry photograph collage be the only decoration in the hero band. Do not add gradients, illustrations, or background patterns behind it.
- Use `{colors.canvas-soft}` as the alternating editorial section background. The warm parchment tone is the only surface step — do not introduce a cool gray or a third surface value.
- Use `{colors.pill-ghost-bg}` for every secondary / ghost button. The soft gray communicates "inactive" without competing with the primary red.

### Don't
- Don't introduce a second accent colour. Pinterest's identity is built on a single red; adding blue, purple, or teal breaks the system immediately.
- Don't render headlines in all-caps or track them positively. Sentence-case + slight negative tracking is the brand's typographic signature.
- Don't use a neutral geometric sans (Inter, Helvetica, Roboto) as a substitute without acknowledging the rounded-terminal warmth is lost. Note it as a fidelity trade-off.
- Don't apply `{rounded.pill}` to small utility buttons — those must stay at `{rounded.button}` 16px as measured. The two radius scales are semantically distinct.
- Don't crop the hero photo collage to a single image or replace it with a flat colour band. The staggered multi-image arrangement is the brand's hero decoration system.
- Don't introduce a monospaced typeface or a serif. Pin Sans is the sole voice; additional faces dilute the brand's warm-approachable clarity.
- Don't use a heavy drop shadow on pin cards at rest. Level 0 flat at rest, Level 2 soft drop on hover only — the imagery creates depth without persistent elevation.
