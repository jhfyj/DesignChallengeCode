import { resolveTriad } from '../../canvas/colorContrast.js'

// The fanned stack always shows exactly 3 swatches — the light/mid/dark triad
// resolveTriad derives from Custom (see colorContrast.js) — regardless of how
// many colors are actually in Custom. Those 3 are the ones literally driving
// the canvas (title/body/background), so they're the "most prominent" ones
// to preview here even when Custom holds a longer or shorter list.
export default function ColorRow({ label, colors, onOpen }) {
  const { light, mid, dark } = resolveTriad(colors)
  return (
    <div className="field-row color-row">
      <span className="field-row__label">{label}</span>
      <button type="button" className="color-row__stack" onClick={onOpen} aria-label={`Open ${label.toLowerCase()} library`}>
        {[light, mid, dark].map((color, i) => (
          <span key={i} className="color-row__swatch" style={{ background: color }} />
        ))}
      </button>
    </div>
  )
}
