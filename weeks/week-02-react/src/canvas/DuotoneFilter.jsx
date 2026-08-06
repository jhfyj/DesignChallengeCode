// Shared SVG duotone filter, referenced via CSS `filter: url(#duotone-filter)`
// by any image with Preserve Color off. Maps image luminance onto a two-
// color gradient between the brand palette's dark and light swatches — the
// standard feColorMatrix (desaturate) + feComponentTransfer (remap) duotone
// technique, so it always follows the current color system rather than a
// hardcoded pair.
import { resolveTriad } from './colorContrast.js'

function hexToRgb01(hex) {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16) / 255
  const g = parseInt(clean.substring(2, 4), 16) / 255
  const b = parseInt(clean.substring(4, 6), 16) / 255
  return [r, g, b]
}

export default function DuotoneFilter({ colors }) {
  const { light, dark } = resolveTriad(colors)
  const [dr, dg, db] = hexToRgb01(dark)
  const [lr, lg, lb] = hexToRgb01(light)

  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <filter id="duotone-filter">
          <feColorMatrix
            type="matrix"
            values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0"
          />
          <feComponentTransfer>
            <feFuncR type="table" tableValues={`${dr} ${lr}`} />
            <feFuncG type="table" tableValues={`${dg} ${lg}`} />
            <feFuncB type="table" tableValues={`${db} ${lb}`} />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  )
}
