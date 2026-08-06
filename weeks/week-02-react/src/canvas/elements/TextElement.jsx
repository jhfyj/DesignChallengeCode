import { FONT_BY_ROLE, FONT_WEIGHT_BY_ROLE, SWISS_FONT_BY_ROLE, colorForRole } from '../fieldSelectors.js'
import { useFontsReady } from '../useFontsReady.js'
import { snapToBaseline, BASELINE_PX } from '../baseline.js'
import { measureInkBearing } from '../opticalAlign.js'

const JUSTIFY_BY_ALIGN_H = { left: 'flex-start', center: 'center', right: 'flex-end' }
const ITEMS_BY_ALIGN_V = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }
// Body text's side-bearing offset is imperceptible at small sizes and not
// worth a canvas measurement every render — optical alignment only applies
// to the role(s) that actually read as "display type" in this app.
const OPTICAL_ALIGN_ROLES = new Set(['title'])

export default function TextElement({ placement, text, colors, canvasColor, styleMode, selected, onPointerDown }) {
  const fontsReady = useFontsReady() // forces one re-render once the real webfont has actually loaded
  const { row, col, colSpan, rowSpan, role, rotation } = placement
  const isSwiss = styleMode === 'Swiss'
  const fontByRole = isSwiss ? SWISS_FONT_BY_ROLE : FONT_BY_ROLE
  const fontFamily = placement.fontFamily || fontByRole[role]
  const fontWeight = placement.fontWeight || FONT_WEIGHT_BY_ROLE[role]
  const color = placement.colorOverride || colorForRole(role, colors, canvasColor)

  // Font size is a fixed value (the role's default or an explicit override
  // from the Size dropdown) — it never recomputes from the current text, so
  // typing more text doesn't shrink it. Text that no longer fits the box's
  // width wraps onto additional lines instead (see .canvas-element's
  // white-space/overflow-wrap rules in Canvas.css).
  const fontSize = placement.fontSizeOverride ?? placement.fontSize

  // Swiss mode locks vertical rhythm to a baseline unit; Free mode keeps the
  // flat 1.15 line-height from Canvas.css (leave undefined so that CSS rule
  // still applies). Rendered as a px STRING, not a bare number — React treats
  // a numeric line-height as a unitless multiplier of font-size, not pixels.
  const lineHeightPx = isSwiss ? snapToBaseline(fontSize * 1.15) : null
  const lineHeight = lineHeightPx ? `${lineHeightPx}px` : undefined

  // Optical alignment: a title's layout box can be exactly on the grid while
  // its rendered ink still reads as offset, because the glyph carries a left
  // side-bearing — only measurable once the real webfont (not a fallback) has
  // loaded, so this stays 0 until `fontsReady` flips true.
  const inkBearing =
    isSwiss && OPTICAL_ALIGN_ROLES.has(role) && fontsReady
      ? measureInkBearing(text, fontFamily, fontWeight, fontSize)
      : 0

  // Dev-only verification, in place of a committed Puppeteer harness (this
  // app is a live editor with constantly-changing content, not a static
  // generated page — see the plan's reasoning): flag it loudly in the
  // console if either Swiss-mode guarantee is ever violated, since both are
  // supposed to be true by construction.
  if (import.meta.env.DEV && isSwiss) {
    if (lineHeightPx % BASELINE_PX !== 0) {
      console.warn(`[Swiss mode] "${placement.fieldKey}" line-height ${lineHeightPx}px isn't a ${BASELINE_PX}px baseline multiple`)
    }
    if (OPTICAL_ALIGN_ROLES.has(role) && fontsReady && text?.trim() && inkBearing === 0) {
      console.warn(`[Swiss mode] "${placement.fieldKey}" optical alignment measured 0px ink bearing — measurement likely failed`)
    }
  }

  const style = {
    gridRow: `${row + 1} / span ${rowSpan}`,
    gridColumn: `${col + 1} / span ${colSpan}`,
    fontFamily,
    fontWeight,
    fontSize,
    lineHeight,
    // actualBoundingBoxLeft is negative for a normal inset side-bearing (ink
    // starts right of the box edge) — shifting the box left by that same
    // amount pulls the ink back onto the line, so this is NOT negated (see
    // opticalAlign.js).
    marginLeft: inkBearing ? inkBearing : undefined,
    color,
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
    display: 'flex',
    justifyContent: JUSTIFY_BY_ALIGN_H[placement.alignH || 'left'],
    alignItems: ITEMS_BY_ALIGN_V[placement.alignV || 'top'],
    textAlign: placement.alignH || 'left',
  }
  const className = `canvas-element canvas-element--${role}${isSwiss ? ' is-swiss' : ''}${selected ? ' is-selected' : ''}`

  return (
    <div className={className} style={style} onPointerDown={onPointerDown}>
      {text}
    </div>
  )
}
