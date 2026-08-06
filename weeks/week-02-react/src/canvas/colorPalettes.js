// Named palettes browsable from the Color Library (ColorLibrary.jsx). Each
// palette is the full token system it was authored with (see
// editorial-color-tokens.json), grouped into the same categories as the
// source doc so the library can render "everything, separated by category"
// instead of collapsing it down to 3 slots.
//
// Only hex entries are meaningful as flat swatch colors a text/background
// element can use — `overlay` (rgba) and `gradient` (multi-stop CSS) entries
// aren't single colors, so ColorLibrary treats those two categories as
// copy-to-clipboard reference swatches rather than "add to Custom" targets.
const EDITORIAL_TOKENS = {
  Foundation: {
    black100: '#000000',
    black90: '#111111',
    gray900: '#1F1F1F',
    gray700: '#4A4A4A',
    gray500: '#8A8A8A',
    gray300: '#CFCFCF',
    gray100: '#F3F3F3',
    white: '#FFFFFF',
  },
  Text: {
    primary: '#000000',
    secondary: '#4A4A4A',
    tertiary: '#7C7C7C',
    disabled: '#B8B8B8',
    inverse: '#FFFFFF',
    primaryDark: '#FFFFFF',
    secondaryDark: '#D0D0D0',
    tertiaryDark: '#A5A5A5',
    disabledDark: '#666666',
  },
  Surface: {
    primary: '#FFFFFF',
    secondary: '#F4F4F4',
    tertiary: '#ECECEC',
    inverse: '#000000',
    elevatedDark: '#111111',
  },
  Border: {
    strong: '#000000',
    default: '#CFCFCF',
    subtle: '#E9E9E9',
    dark: '#3A3A3A',
  },
  Accent: {
    primary: '#7C89FF',
    hover: '#6B78F2',
    light: '#C7D0FF',
    subtle: '#EEF1FF',
  },
  Overlay: {
    dark100: 'rgba(0,0,0,0.75)',
    dark80: 'rgba(0,0,0,0.55)',
    dark60: 'rgba(0,0,0,0.35)',
    light: 'rgba(255,255,255,0.70)',
    accent: 'rgba(124,137,255,0.18)',
    noise: 'rgba(255,255,255,0.05)',
  },
  Interactive: {
    focusRing: '#7C89FF',
    selection: '#DCE2FF',
    link: '#7C89FF',
    linkHover: '#5F6CF0',
  },
  Gradient: {
    halo: 'radial-gradient(circle,#FFFFFF 0%,#EEF1FF 35%,#A9B5FF 60%,rgba(124,137,255,0.35) 78%,transparent 100%)',
    editorialFade: 'linear-gradient(180deg,rgba(255,255,255,0),rgba(0,0,0,0.72))',
  },
}

// "gray900" -> "Gray 900", "primaryDark" -> "Primary Dark", "focusRing" -> "Focus Ring".
function humanize(key) {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
}

// rgba (Overlay) and multi-stop CSS (Gradient) entries aren't flat colors —
// clicking them copies the value instead of adding it to Custom.
const NON_ADDABLE_CATEGORIES = new Set(['Overlay', 'Gradient'])

function buildPalette(name, tokens) {
  const categories = Object.entries(tokens).map(([categoryName, entries]) => ({
    name: categoryName,
    addable: !NON_ADDABLE_CATEGORIES.has(categoryName),
    // `key` (the raw token name, e.g. "blue") is kept alongside the
    // human-readable `label` ("Blue") so a per-palette color edit (see
    // applyPaletteOverrides) can target the exact token instead of matching
    // on the display label.
    entries: Object.entries(entries).map(([key, value]) => ({ key, label: humanize(key), value })),
  }))
  // The palette's "voice" — its accent plus its two main text shades — blended
  // into shuffle's color pool (see shuffleEngine.js) alongside whatever the
  // user has added to Custom, so shuffling still carries the palette's
  // character even after Custom is no longer empty. Picked from named tokens
  // rather than an arbitrary first-N-hex sample so it's the accent color, not
  // three near-identical grays off the top of Foundation.
  const signatureColors = [tokens.Accent?.primary, tokens.Text?.secondary, tokens.Text?.primary].filter(Boolean)
  return { name, categories, signatureColors }
}

// Swiss/Müller-Brockmann style mode's restrained palette: white/near-black
// paper+ink plus exactly one accent — our brand accent blue (the same one
// used throughout EDITORIAL_TOKENS.Accent) rather than the discipline's
// canonical Swiss red, since this is our own brand's take on the system.
// Browsable/copyable here like any other palette, but deliberately excluded
// from allSignatureColors() below so it never bleeds into Free-mode
// shuffles just by existing.
const SWISS_TOKENS = {
  Foundation: { white: '#FFFFFF', black: '#111111' },
  Accent: { blue: '#7C89FF' },
}

export const PALETTES = [buildPalette('Editorial', EDITORIAL_TOKENS), buildPalette('Swiss', SWISS_TOKENS)]

export function paletteByName(name) {
  return PALETTES.find((p) => p.name === name)
}

// Palettes are otherwise static token tables — this lets a user's edit (via
// double-clicking a swatch in ColorLibrary.jsx) override one entry's value
// without mutating the shared PALETTES constant. `overridesForPalette` is
// keyed by category name -> entry key -> hex value (the shape stored in
// DesignContext's `paletteOverrides` state).
export function applyPaletteOverrides(palette, overridesForPalette) {
  if (!overridesForPalette) return palette
  return {
    ...palette,
    categories: palette.categories.map((category) => {
      const categoryOverrides = overridesForPalette[category.name]
      if (!categoryOverrides) return category
      return {
        ...category,
        entries: category.entries.map((entry) =>
          categoryOverrides[entry.key] != null ? { ...entry, value: categoryOverrides[entry.key] } : entry
        ),
      }
    }),
  }
}

// Small light/mid/dark-ish preview for a palette's collapsed row — first few
// hex swatches encountered across its categories, in category order.
export function previewSwatches(palette, count = 4) {
  const hexValues = palette.categories.flatMap((c) => c.entries.map((e) => e.value)).filter((v) => v.startsWith('#'))
  return hexValues.slice(0, count)
}

// Every addable (flat-hex) swatch across a palette's categories, flattened —
// unlike ColorLibrary.jsx's full per-category browsing, SingleColorRow's
// Brand tab just needs "here are this palette's pickable colors" as one grid.
export function addableHexSwatches(palette) {
  return palette.categories.filter((c) => c.addable).flatMap((c) => c.entries.map((e) => e.value))
}

// Every palette's signature colors, deduped — merged into Custom by
// shuffleEngine.js so shuffle always has some palette flavor to draw from.
// Swiss is excluded: its whole point is restraint, so it shouldn't leak its
// accent into ordinary Free-mode shuffles just by being registered here —
// shuffleEngine.js reads it directly (via paletteByName) only when Swiss
// mode is actually active.
export function allSignatureColors() {
  return [...new Set(PALETTES.filter((p) => p.name !== 'Swiss').flatMap((p) => p.signatureColors))]
}
