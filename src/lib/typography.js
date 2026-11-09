// Typography system — web port of the mobile app's single source of truth
// (mobile/src/lib/typography.js). The STRING KEYS (fontFamily / fontSize /
// lineSpacing / columnWidth) are identical across platforms so a reading
// preference set on one device carries to the other via user.prefs.typography.
//
// The concrete mappings differ per client — the app maps to RN px/padding, the
// web maps to CSS font stacks, rem sizes, unitless line-heights, and a max-width
// "measure" (a centered padding doesn't translate to a centered web column, so
// column width becomes the reading measure instead). Per the app's design note,
// "the client owns the mapping; the server only stores the keys."

// ---- Fonts -----------------------------------------------------------------
// `key` matches the mobile FONTS keys exactly. `stack` is the CSS font-family.
// All fonts are self-hosted (no third-party requests): Inter, Lora, Atkinson
// and Merriweather via exact-pinned @fontsource packages imported in
// src/fonts.js (the variable builds register as "Inter Variable"/"Lora
// Variable"); OpenDyslexic via @font-face in index.css.
export const FONTS = [
  { key: 'inter',        label: 'Inter',                classification: 'sans',          stack: '"Inter Variable", "Inter", system-ui, sans-serif' },
  { key: 'atkinson',     label: 'Atkinson Hyperlegible', classification: 'sans',         stack: '"Atkinson Hyperlegible", system-ui, sans-serif' },
  { key: 'lora',         label: 'Lora',                 classification: 'serif',         stack: '"Lora Variable", "Lora", Georgia, serif' },
  { key: 'merriweather', label: 'Merriweather',         classification: 'serif',         stack: '"Merriweather", Georgia, serif' },
  { key: 'opendyslexic', label: 'OpenDyslexic',         classification: 'accessibility', stack: '"OpenDyslexic", sans-serif' },
]

// ---- Stepped scales --------------------------------------------------------
// Match the mobile app's px scale exactly (mobile FONT_SIZES = 10/14/16/18/21).
// On a phone browser, 1 CSS px and 1 app dp map to the same physical pixels, so
// equal values read at the same size — the web previously ran larger and no
// longer matches the app, which is the reference (kept as rem for zoom support).
export const FONT_SIZES = { xs: '0.625rem', s: '0.875rem', m: '1rem', l: '1.125rem', xl: '1.3125rem' }
export const FONT_SIZE_ORDER = ['xs', 's', 'm', 'l', 'xl']
export const FONT_SIZE_LABELS = { xs: 'XS', s: 'S', m: 'M', l: 'L', xl: 'XL' }

// Unitless line-height — match the app's multipliers exactly (was 1.5/1.75/2.0).
export const LINE_SPACINGS = { compact: 1.25, normal: 1.5, relaxed: 1.8 }
export const LINE_SPACING_ORDER = ['compact', 'normal', 'relaxed']
export const LINE_SPACING_LABELS = { compact: 'Compact', normal: 'Normal', relaxed: 'Relaxed' }

// Reading measure (max-width of the body text column). Larger key = wider line.
export const COLUMN_MEASURES = { narrow: '34rem', normal: '42rem', wide: '52rem' }
export const COLUMN_WIDTH_ORDER = ['narrow', 'normal', 'wide']
export const COLUMN_WIDTH_LABELS = { narrow: 'Narrow', normal: 'Normal', wide: 'Wide' }

export const DEFAULT_TYPOGRAPHY = {
  fontFamily: 'inter',
  fontSize: 'm',
  lineSpacing: 'normal',
  columnWidth: 'normal',
}

// ---- Resolver --------------------------------------------------------------

// Normalize a possibly-partial / possibly-absent prefs object into a complete,
// valid typography preference object.
export function normalizeTypography(prefs) {
  const p = prefs && typeof prefs === 'object' ? prefs : {}
  const has = (val, table) => typeof val === 'string' && val in table
  const fontTable = Object.fromEntries(FONTS.map((f) => [f.key, true]))
  return {
    fontFamily: has(p.fontFamily, fontTable) ? p.fontFamily : DEFAULT_TYPOGRAPHY.fontFamily,
    fontSize: has(p.fontSize, FONT_SIZES) ? p.fontSize : DEFAULT_TYPOGRAPHY.fontSize,
    lineSpacing: has(p.lineSpacing, LINE_SPACINGS) ? p.lineSpacing : DEFAULT_TYPOGRAPHY.lineSpacing,
    columnWidth: has(p.columnWidth, COLUMN_MEASURES) ? p.columnWidth : DEFAULT_TYPOGRAPHY.columnWidth,
  }
}

// Turn a preference object into concrete CSS values.
export function resolveTypography(prefs) {
  const t = normalizeTypography(prefs)
  const font = FONTS.find((f) => f.key === t.fontFamily) ?? FONTS[0]
  return {
    ...t,
    fontStack: font.stack,
    fontSize: FONT_SIZES[t.fontSize],
    lineHeight: LINE_SPACINGS[t.lineSpacing],
    measure: COLUMN_MEASURES[t.columnWidth],
  }
}

// The CSS custom properties the reading surfaces consume. Applied to the
// document root by the TypographyProvider.
export function typographyCssVars(prefs) {
  const r = resolveTypography(prefs)
  return {
    '--reading-font': r.fontStack,
    '--reading-size': r.fontSize,
    '--reading-leading': String(r.lineHeight),
    '--reading-measure': r.measure,
  }
}
