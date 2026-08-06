// WCAG 2.x relative luminance / contrast ratio math, used by shuffleEngine.js
// to rank the brand palette by legibility against whatever background color
// a shuffle picks — no existing utility for this anywhere in the codebase.

function srgbChannelToLinear(c) {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const num = parseInt(full, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

// Used by Artboard.jsx to apply a user-chosen color to the Dots/Grid Lines/
// Gradient Overlay patterns, which need an alpha channel a plain hex can't
// carry on its own.
export function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex)
  const R = srgbChannelToLinear(r)
  const G = srgbChannelToLinear(g)
  const B = srgbChannelToLinear(b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

export function contrastRatio(hexA, hexB) {
  const L1 = relativeLuminance(hexA)
  const L2 = relativeLuminance(hexB)
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

// Returns indices into `colors`, descending by contrast against `backgroundHex`
// — e.g. [2, 0, 1] means colors[2] has the highest contrast, colors[1] the least.
export function rankSwatchesByContrast(colors, backgroundHex) {
  return colors
    .map((hex, index) => ({ index, ratio: contrastRatio(hex, backgroundHex) }))
    .sort((a, b) => b.ratio - a.ratio)
    .map((entry) => entry.index)
}

// The Custom section of the Color Library (ColorLibrary.jsx) starts empty and
// is entirely user-managed, so shuffle/canvas rendering needs something to
// fall back to whenever it's empty rather than breaking.
export const DEFAULT_COLORS = ['#f4f4f5', '#c6c6c6', '#6f6f6f']

export function ensureColors(colors) {
  return colors && colors.length ? colors : DEFAULT_COLORS
}

// Derives a light/mid/dark triad from an arbitrary-length color list (sorted
// by luminance, so a 1- or 2-color custom set still resolves sensibly instead
// of indexing past the end of the array) — used anywhere that used to assume
// a fixed 3-slot [light, mid, dark] palette (DuotoneFilter, ImageElement,
// colorForRole).
export function resolveTriad(colors) {
  const sorted = [...ensureColors(colors)].sort((a, b) => relativeLuminance(b) - relativeLuminance(a))
  return {
    light: sorted[0],
    mid: sorted[Math.floor((sorted.length - 1) / 2)],
    dark: sorted[sorted.length - 1],
  }
}

// Vite inlines small SVGs as `data:image/svg+xml,...` URIs instead of a
// `.svg`-suffixed file path, so a plain extension check misses them — used by
// ImageElement.jsx (to mask-and-tint locked-asset marks) and
// SelectedElementPanel.jsx (to decide whether to show a Color control for one).
export function isSvgUrl(url) {
  return typeof url === 'string' && (/\.svg(\?|$)/i.test(url) || /^data:image\/svg\+xml/i.test(url))
}
