// Swiss/Müller-Brockmann style mode's "optical alignment": a large display
// glyph's layout BOX can sit exactly on a grid line while its rendered INK
// still reads as offset, because the glyph carries a left side-bearing. This
// measures that bearing with the real, currently-loaded font (via a shared
// offscreen canvas, not a fresh one per call) so a caller can nudge the
// element's margin until the ink itself — not just its box — lands on the
// line. Only worth applying to large display text (titles/numerals); body
// text's side-bearing is imperceptible at small sizes.
let measureCanvas = null

export function measureInkBearing(text, fontFamily, fontWeight, fontSizePx) {
  const firstChar = (text || '').trim()[0]
  if (!firstChar) return 0
  if (!measureCanvas) measureCanvas = document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`
  ctx.textAlign = 'left'
  const metrics = ctx.measureText(firstChar)
  const bearing = metrics.actualBoundingBoxLeft
  return Number.isFinite(bearing) ? bearing : 0
}
