# Wesup Design System — Swiss Industrial Print (brutalist)

> One system, one substrate, one accent. This document is the source of truth for
> every page in the product — landing, auth, marketplace, UMKM workspace, supplier
> dashboard, and admin. It was distilled from the implemented landing page
> (`components/landing/**`, `app/page.tsx`) and extended to cover operational
> surfaces. If a rule in this document contradicts a page, the page is wrong.

## 0. Identity

The interface is **Swiss Industrial Print (light) / industrial brutalism**: 1960s
corporate identity systems, heavy-machinery blueprints, and technical manuals.
We do not build *soft structuralism* — no rounded corners, no soft shadows, no
glass translucency, no gradients, no pastel palette. The design communicates
"raw functionality, mechanical precision, high data density."

**Etymology of the look, so future contributors don't drift:**

| We are | We are NOT |
| --- | --- |
| Hard 90° edges, hairline rules, grid compartments | Rounded cards, pills, blobs |
| Paper substrate + carbon ink + one aviation red | Ivory/white, multi-tone palettes |
| Macro display type + mono metadata | Soft display fonts, thin weights |
| Data rendered as tables, manifests, spec sheets | Icon-led marketing cards |
| Red = alert / active / vital data, nothing else | Red as one of many brand colors |
| Film grain, technical marks, registration symbols | Glow, blur, glassmorphism |

The **only** sanctioned archetype. Do not introduce a dark "tactical telemetry"
mode anywhere. Single substrate, single accent, app-wide.

## 1. Tokens

### 1.1 Color (from `app/globals.css` → `@theme inline`)

| Token | Value | Role |
| --- | --- | --- |
| `--color-wesup-paper` | `#F4F4F0` | Default page/surface substrate. Matte, unbleached paper. |
| `--color-wesup-paper-sub` | `#EAE8E3` | Alternating panels, raised frames, hover fills. |
| `--color-wesup-void` | `#050505` | **Forbidden on the landing shell** (contract-pinned); reserved for inverted bands. |
| `--color-wesup-ink` | `#050505` | Primary text, solid hairlines, primary button fill, footer band. |
| `--color-wesup-ink-sub` | `#111111` | Secondary/label text, body copy, metadata. |
| `--color-wesup-red` | `#E61919` | **The only accent.** Hairs, active states, alerts, live data, stage rail. |
| `--color-wesup-red-bright` | `#FF2A2A` | Only on inverted/void surfaces (e.g. footer icon). |
| `--color-wesup-kraft` | `#d9c7a4` | Deprecated — never use. |
| `--hero-wash` | `244 244 240` | Readability band behind hero copy. **Must equal** the WebGL cove `COVE_COLOR = 0xF4F4F0`. |

### 1.2 Deprecated tokens

The following still exist in `:root` but are **removed from any new or redesigned
markup** — they belong to the old blue/zinc theme:

`--background #f8fafc`, `--foreground #0f172a`, `--wesup-page`, `--wesup-surface`,
`--wesup-surface-muted`, `--wesup-border`, `--wesup-muted`, `--wesup-brand #2563eb`,
`--wesup-success #059669`, `--wesup-warning #d97706`, `--wesup-danger #dc2626`.

Also banned as utility classes app-wide: `slate-*`, `blue-*`, `gray-*`,
`zinc-*`, `white`, `emerald-*`, `amber-*`, `green-*`, `yellow-*`.

### 1.3 Typography (from `app/layout.tsx`)

| Role | Font | Variable | Weight / notes |
| --- | --- | --- | --- |
| UI / body | Geist | `--font-geist-sans` | Default |
| Macro display | Archivo Black | `--font-landing-display` | **400 only** (`Archivo_Black` has a single weight). Structural headers. |
| Micro / metadata | JetBrains Mono | `--font-jetbrains-mono` | Uppercase, tabular when numeric |
| Legacy body mono | Geist Mono | `--font-geist-mono` | Replace with JetBrains Mono over time |

Global defaults: `font-optical-sizing: auto`, `text-rendering: optimizeLegibility`,
`min-width: 320px`, tap-highlight transparent on controls, controls `min-height: 2.75rem`.

## 2. Typography architecture

Typography is the primary structural and decorative device. Imagery is secondary.

### 2.1 Macro type (headlines)

Archivo Black, exclusively uppercase. Tight / compressed blocks.

```
/* Shared section title recipe (components/landing/section-style.ts) */
"font-landing-display text-3xl leading-[0.95] tracking-[0.08em] uppercase text-balance sm:text-5xl md:text-6xl"
```

- Scale ladder for sections: `text-3xl` → `sm:text-5xl` → `md:text-6xl`.
- Hero headline: `font-landing-display text-[1.75rem] leading-[1.07] tracking-[-0.03em] text-wesup-ink text-balance sm:text-[2.5rem] sm:leading-[1.06] md:text-[3.5rem] md:leading-[1.03] md:tracking-[-0.035em] lg:text-[4rem] xl:text-[4.5rem] xl:leading-[1.02]`. The hero working column is `max-width: min(36rem, 38vw)` and centres its beat+CTA group vertically (`justify-content: safe center`) so the flagship type fills the left panel without dead space.
- Tracked caps (`tracking-[0.08em]`) for long statements; tight negative tracking
  (`-0.03em` to `-0.035em`) for massive hero type so glyphs form solid blocks.
- Numeric values use `tabular-nums` + `tracking-tight`.

### 2.2 Micro type (metadata, labels, data)

JetBrains Mono, uppercase, generous tracking — reads like terminal/typewriter
metadata. **All** eyebrows, kickers, labels, table headers, footers, badges.

```
Eyebrow pattern:  inline-flex items-center gap-2 font-mono text-[0.6875rem] font-medium uppercase
                  tracking-[0.24em] text-wesup-ink-sub
                  + red hairline: inline-block h-px w-6 bg-wesup-red
```

- Tracking bands: `0.18em` (stat labels, table headers), `0.20em` (step labels,
  spec rows), `0.24em` (eyebrows). Use one consistent value per context, never mixed.
- `tabular-nums` whenever rendering amounts, quotas, prices, timestamps.

### 2.3 Body type

Geist `0.9375rem–1rem`, `leading-[1.65]–[1.7]`, `text-wesup-ink-sub`,
`text-pretty`. Desktop sections may use `sm:text-lg`. Never bold-heavy; emphasis
via `<strong className="font-semibold text-wesup-ink">`.

## 3. Shape, depth, texture

- **All corners 90°.** Zero `border-radius` anywhere (contract enforced).
- **No shadows, no gradients, no translucency** (`mix-blend-mode` allowed only
  for the grain overlay and imagery).
- **Frame-panel cards** (`components/landing/CardFrame.tsx`): outer surface
  padded by `frameRem` (default `0.375rem`, closing CTA `0.5rem`) around an
  inner panel. Outer gets `bg-wesup-paper-sub`, inner `bg-wesup-paper`,
  surround with `border border-wesup-ink/10`.
- **Razor dividers**: `grid gap-px bg-wesup-ink/10` with each cell
  `bg-wesup-paper` — mathematically perfect 1px rules (stat manifests,
  step tables).
- **Hairlines**: `border-wesup-ink/10` (section separators), `/15` (spec rows,
  tables), `/20` (icon boxes, inputs), `/30` (decorative underlines).
- **2px red lines** are emphasis: hero wash divider, stage-rail underline.
- **Film grain** (`.wesup-grain`): fixed full-viewport overlay, `opacity: 0.06`,
  `mix-blend-mode: multiply`, 180px SVG turbulence tile, `pointer-events: none`,
  `z-index: 40` (above content, below fixed header). Use on marketing pages;
  optional on dense app pages.

## 4. Color semantics

The rule: **red is not for "branding", it is for signal.** Everything neutral is
ink/ink-sub; everything urgent/active/vital is red.

| Meaning | Expression |
| --- | --- |
| Default text / borders | `text-wesup-ink`, `border-wesup-ink/10–/20` |
| Secondary / labels / body | `text-wesup-ink-sub` |
| Raised / alternating surface | `bg-wesup-paper-sub` |
| Primary action (inverted) | `bg-wesup-ink text-wesup-paper` |
| Emphasized band | `bg-wesup-ink` + paper text (footer, primary buttons) |
| Alert / danger / active | `text-wesup-red`, `bg-wesup-red`, `border-wesup-red` |
| Live / filled / selected data | red rule, red fill, red underline |

**Status signals (app-wide, including operational surfaces):** encode status with
mono labels in ink/ink-sub; use **red only for alert/danger/active/expired**.
There is no success green, no info blue, no warning amber. A "paid/confirmed"
state is a flush mono label (`bg-wesup-paper-sub` or plain ink text), *never*
a colored pill.

```
Status chip (replaces <StatusBadge rounded-full …>):
  <span className="bg-wesup-paper-sub px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink">Lunas</span>
Alert chip:
  <span className="bg-wesup-red px-2 py-1 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-wesup-paper">Batal</span>
```

## 5. Layout system

### 5.1 Container & rhythm

- Page gutter: `px-4 sm:px-6 lg:px-8`, centered via `container mx-auto`.
- Wide app pages: `max-w-7xl` (see `PageContainer`); editorial pages `max-w-6xl`
  or narrower.
- Section rhythm: `border-t border-wesup-ink/10 py-24 sm:py-28 sm:py-32`,
  `scroll-mt-24` on anchored sections.
- Section header block: `Eyebrow` (optional) → macro `h2` (mt-5) → body copy
  (mt-5, `max-w-xl`).

### 5.2 Blueprint grid / compartments

- Elements anchor to grid tracks, they do not float. Prefer
  `grid` with explicit tracks over flex for structured content.
- **Spec sheet** row (features, any key/value data):
  `grid grid-cols-2 sm:grid-cols-[14rem_1fr]`, label cell mono uppercase, value
  cell split by `border-l border-wesup-ink/15`, rows joined by the parent's
  `divide-y divide-wesup-ink/15` inside `border border-wesup-ink/15`.
- **Stat manifest** (`dl.dl`): `grid grid-cols-2 gap-px bg-wesup-ink/10 lg:grid-cols-4`,
  each cell a column with `dt` (mono label) below `dd` (display numeral) via
  `order`, plus a red hairline `mb-4 block h-px w-8 bg-wesup-red` above the value.
- **Step table** (how-it-works): outer `border border-wesup-ink/10` grid, each
  cell `border-r border-b`, frame-panel interior, corner block with mono
  "Langkah 0N" + bordered icon box, footer readout row (`border-t` + faint
  display numeral + red rule).
- **FAQ / accordion**: `dl` with `border-t border-b` outer, item `border-b border-wesup-ink/10`,
  question in macro type, red chevron, answer `max-w-2xl` body.

## 6. Component recipes

These are canonical. Copy them verbatim; adjust width/padding only.

### 6.1 Buttons

```
Primary (ink):   inline-flex min-h-12 items-center justify-center gap-3 border border-wesup-ink
                 bg-wesup-ink px-7 py-3 text-[0.9375rem] font-semibold tracking-[-0.01em] text-wesup-paper
                 transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red
                 hover:translate-x-0.5 focus-visible:outline focus-visible:outline-2
                 focus-visible:outline-offset-2 focus-visible:outline-wesup-red
Secondary:       inline-flex min-h-12 items-center justify-center border border-wesup-ink/20
                 bg-wesup-paper px-8 text-[0.9375rem] font-semibold text-wesup-ink
                 transition-colors duration-500 hover:bg-wesup-paper-sub
Text link:       inline-flex min-h-12 items-center justify-center text-[0.9375rem] font-semibold
                 text-wesup-ink underline decoration-wesup-ink/30 underline-offset-[6px]
                 transition-colors duration-300 hover:decoration-wesup-red
```

- Arrow discs ride in primary CTAs (`group` + `group-hover:translate-x-0.5` + `ArrowRight strokeWidth={1.5}`).
- `wesup-ease` for all geometric motion; `duration-500` chrome, `duration-300` inline micro.

### 6.2 Header (`.SiteHeader` pattern)

- Fixed full-width strip, `pointer-events-none` shell, centered content, `pt-4`.
- Floating **pill**: `border border-wesup-ink/20 bg-wesup-paper py-1.5 pl-3 pr-2`, `max-w-4xl`.
- Logo: bordered square `h-8 w-8` (paper + `border-wesup-ink/20`) with red
  lucide glyph `strokeWidth={1.5}`, followed by `font-landing-display text-xl tracking-[-0.02em]`.
- Nav links: ink-sub → ink on hover with red underline that draws itself
  (`origin-left scale-x-0 → scale-x-100`, `wesup-ease`, `-mt-px h-px bg-wesup-red`).
- Mobile: bordered `h-10 w-10` hamburger (`md:hidden`); overlay is a
  paper-fullscreen panel, menu items staggered via `.wesup-menu-item` (`--i`),
  each item a bordered macro-type block, CTA as inverted ink block.
- All focus states: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red`.

### 6.3 Footer

Inverted band: `border-t border-wesup-ink bg-wesup-ink py-12 pb-16`, logo in
paper with `text-wesup-red-bright` glyph, mono copyright line
`font-mono text-xs uppercase tracking-[0.18em] text-wesup-paper/60`.

### 6.4 Forms

```
Label:       font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub
Input/Select: w-full border border-wesup-ink/20 bg-wesup-paper px-4 text-sm text-wesup-ink
              placeholder:text-wesup-ink-sub/50 focus-visible:outline focus-visible:outline-2
              focus-visible:outline-offset-2 focus-visible:outline-wesup-red
Error:        text-sm text-wesup-red  (+ red left rule or border-wesup-red on the field)
Hint:         text-xs leading-5 text-wesup-ink-sub
```

Replace `FormField`'s old slate/blue styles with the above. Field containers on
auth pages are the **paper plate**: `border border-wesup-ink/15 bg-wesup-paper`
(replaces `rounded-3xl bg-white shadow-xl`).

### 6.5 Tables & readouts

- Wrapper: `border border-wesup-ink/15 bg-wesup-paper`, header row mono
  `text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub`, rows
  `border-t border-wesup-ink/10`, numeric cells `tabular-nums`.
- Empty state: paper block with hairline, mono crosshair/`+` glyph, macro
  `h3`, body copy (replaces gray-circle SVG + soft heading).

### 6.6 Progress

Track: `h-px w-full bg-wesup-ink/20`; fill: `h-[3px] -translate-y-px bg-wesup-red`
(see hero volume meter). Thin, precise, red — never a rounded bar.

### 6.7 PageHeader (app pages, replaces `components/layout/PageHeader.tsx`)

```
<div flex flex-col gap-2>
  <p font-mono text-[0.6875rem] uppercase tracking-[0.24em] text-wesup-ink-sub>
    <span inline-block h-px w-6 bg-wesup-red /> {eyebrow}
  </p>
  <h1 font-landing-display text-3xl sm:text-4xl md:text-5xl tracking-[0.06em] uppercase text-wesup-ink>
  {description → text-wesup-ink-sub max-w-2xl}
</div>
```

Drop the blue icon chip; use a bordered `h-10 w-10` box + red glyph if an icon is required.

### 6.8 Shells (workspaces / admin / chrome)

Replace `bg-slate-50`/white/blue chrome with paper + hairline:

- App shell: `flex min-h-screen flex-col bg-wesup-paper text-wesup-ink`, main `bg-wesup-paper`.
- Sidebars (AdminSidebar, supplier/UMKM workspace nav): paper column, hairline
  `border-r border-wesup-ink/10`, links ink-sub → ink, active item = red left
  rule or `bg-wesup-paper-sub`, mono labels.
- Skip-link: `bg-wesup-ink text-wesup-paper` on focus (no rounded).

## 7. Motion

| Token | Value | Usage |
| --- | --- | --- |
| `--wesup-ease` (interact) | `cubic-bezier(0.32, 0.72, 0, 1)` | Pills, underlines, arrow discs, translate hovers |
| 3D-scene ease | `cubic-bezier(0.22, 1, 0.36, 1)` | Reveal, beat entrances, rail underline |
| Reveal | 850ms, translateY(2rem)+blur(6px) → 0 | `Reveal` scroll entrance; one-shot, transform/opacity/filter only |
| Beat stagger | `--i * 40–60ms` | Hero words (-40ms) & blocks (-60ms) |
| Menu stagger | `--i * 70ms` | Mobile overlay items |
| Rail underline | 420ms translateX + step scaleX 1.6 | Hero stage rail |

Rules:

- **transform/opacity/filter only.** Never animate layout properties
  (top/left/width/height) per frame.
- `prefers-reduced-motion: reduce` → durations ~0.01ms and reveals fail-open to
  shown (see `.wesup-reveal` `@media (scripting: enabled)` guard).
- The hero scene has a single kill switch `data-webgl="on|off"`; when off the
  beats render as a static readable stack with **nothing** half-animated.

## 8. Accessibility baseline

- Focus: `focus-visible:outline-2 outline-wesup-red outline-offset-2` everywhere
  (replaces the global blue `#2563eb` focus outline).
- Hit targets ≥ `2.75rem` min-height on all interactive controls
  (checkbox/radio exempt).
- Red (`#E61919`) on paper is below AA for small text — use red only for
  hairlines, marks, large numerals, filled chips with paper text, and
  small bold uppercase chips. Never set running body copy in red.
- Semantics: real `dl` (dt/dd ordering via flex `order`), `button` for
  disclosure/accordion with `aria-expanded`/`aria-controls`, `role="progressbar"`
  for meters, `sr-only` H1 behind visual headlines.
- Grain overlay must stay `pointer-events: none`.

## 9. Landing flagship (special case)

The scroll-scrubbed **3D hero** (`app/page.tsx` → `HeroScene` + `renderer.ts`) is
the one bespoke experience and is **not to be cloned** onto other pages:

- Tall scroll track (`--scene-length-mobile: 380vh`, `--scene-length: 560vh`),
  sticky viewport, WebGL dock → shutter → departure choreography scrubbed to scroll.
- Copy reads on a hard-edged paper wash (`clip-path` bottom band mobile,
  52vw left column + 2px red divider desktop), never a gradient fade.
- `data-webgl="off"` fallback (no WebGL / reduced-motion / data-saver) = static
  editorial stack, no animation.
- Other pages may reuse the *system* (tokens, headers, type) but not a second
  WebGL viewport.

## 10. Application map (rollout per page group)

| Surface | Recipe |
| --- | --- |
| Landing (`/`) | Reference implementation — untouched |
| Auth: `/login`, `/register`, `/register/umkm`, `/admin/login` | Centered paper plate (`border border-wesup-ink/15`) on paper bg, macro title, mono eyebrow, brutalist form fields, text links under plate |
| Marketplace `/marketplace`, `/marketplace/[id]` | `PageContainer` + brutalist `PageHeader`; offer lists/cells as bordered spec rows & frame panels; badges → mono chips |
| UMKM: `/beranda-umkm`, `/umkm/**`, order flows (`/pesanan/**`, bayar, serah-terima, komplain, sengketa, nilai, refund/rekening) | `UmkmWorkspaceShell` restyled to paper + hairline; steps as mono manifest cells; statuses red/ink only; fee & escrow readouts as `tabular-nums` display rows |
| Supplier: `/supplier/**`, dashboards, catalog, batches, keuangan, recurring, akun* | Same shell recipe; tables → hairline spec sheets; tone status cards → framed mono panels |
| Admin: `/admin/**`, `AdminSidebar`/`AdminHeader` | Same shell recipe; dispute/refund queues as bordered tables, decisions as ink primary + red alert chips |
| Utility: `/bantuan`, `/docs`, `/demo/leaflet` | Editorial container, macro titles, spec rows for data |

### 10.1 Migration delta (old → new)

| Old pattern | Replacement |
| --- | --- |
| `bg-slate-50` / `bg-white` shells | `bg-wesup-paper` |
| `rounded-2xl` / `rounded-3xl` / `rounded-full` cards & badges | `CardFrame` / bordered panels / mono chips, 0 radius |
| `shadow-sm` / `shadow-xl` / `shadow-blue-*/5` | removed (no shadows) |
| `bg-blue-600 text-white rounded-xl` buttons | ink-primary button |
| `text-slate-900` / `text-slate-600` / `text-gray-*` | `text-wesup-ink` / `text-wesup-ink-sub` |
| `bg-blue-100 text-blue-700` icon chip / eyebrow | bordered `h-10 w-10` box + red glyph / mono eyebrow w/ red rule |
| `rounded-full` `StatusBadge` (emerald/amber/blue) | mono chip, ink or red fill |
| `bg-white/95 backdrop-blur border-white/80` plates | `bg-wesup-paper border-wesup-ink/15` |
| `border-slate-200` / `border-gray-200` | `border-wesup-ink/10–/15` |
| `text-emerald-700` / `text-amber-800` success/warning | ink-sub mono chip; danger → red |
| Global blue focus outline `#2563eb` | `outline-wesup-red` 2px + 2px offset |

## 11. Enforcement ("definition of done")

The brutalist contract test (`tests/unit/landing-brutalist-contract.test.ts`) pins
the core rules (Archivo Black display, `--color-wesup-paper: #F4F4F0`,
`--color-wesup-red: #E61919`, hero-wash ≡ cove, no `rounded-*`/gradients in landing
scope). When redesigning a page beyond the landing:

1. **No** `rounded-*`, `bg-gradient-to-*`, `radial-gradient`, `shadow-*`, `bg-white`,
   `slate-*`, `blue-*`, `gray-*`, `zinc-*`, `emerald-*`, `amber-*` in the page or
   its components.
2. **Yes** paper/paper-sub/ink/ink-sub/red tokens, Archivo Black macro headings,
   JetBrains Mono metadata, hairline compartments.
3. Layout keeps its data: tables instead of icon cards, spec rows instead of
   feature grids, tabular numerals for all money/volume.
4. Extend the contract test's `LANDING_COMPONENTS` list to cover the redesigned
   pages; the suite must run green before merge.
5. Update **this document** when the system gains a sanctioned token or recipe.