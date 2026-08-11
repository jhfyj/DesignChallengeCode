import { resolveTriad, relativeLuminance, hexToRgba } from '../colorContrast.js'
import { rotatedBoxStyle } from '../rotationLayout.js'

// The name/company/role text block that sits next to a speaker photo — a
// genuinely separate element from the photo (own grid cell, own selection
// outline), linked to it only by position (see speakerInfoLayout.js). It's
// never stored in `placements` or independently dragged: its position is
// computed fresh from the photo every render, so the two can never drift out
// of alignment. Its own size/rotation/alignment and each line's font/color
// ARE user-adjustable (see SpeakerInfoPanel.jsx) — those live on the speaker
// content object (info.*) rather than on a placement, same reasoning.
const JUSTIFY_BY_ALIGN_V = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }
const ITEMS_BY_ALIGN_H = { left: 'flex-start', center: 'center', right: 'flex-end' }
const DEFAULT_TEXT_FONT = 'Figtree'

function textStyle(override, { fontWeight, fontSize, color, textAlign }) {
  return {
    fontFamily: override?.fontFamily || DEFAULT_TEXT_FONT,
    fontWeight: override?.fontWeight || fontWeight,
    fontSize: override?.fontSizeOverride || fontSize,
    color: override?.colorOverride || color,
    textAlign,
  }
}

export default function SpeakerInfoElement({ geometry, grid, info, colors, canvasColor, selected, onPointerDown }) {
  const { light, mid, dark } = resolveTriad(colors)
  const canvasIsDark = relativeLuminance(canvasColor || '#ffffff') < 0.5
  const alignH = info.alignH || 'left'
  const alignV = info.alignV || 'middle'
  const style = {
    ...rotatedBoxStyle({ ...geometry, rotation: info.rotation }, grid),
    justifyContent: JUSTIFY_BY_ALIGN_V[alignV],
    alignItems: ITEMS_BY_ALIGN_H[alignH],
  }

  return (
    <div
      className={`canvas-element canvas-element--speaker-info${selected ? ' is-selected' : ''}`}
      style={style}
      onPointerDown={onPointerDown}
    >
      {/* Name > company > role hierarchy: each step down in weight, size,
          and color intensity by default — all three overridable per-line. */}
      {info.name && (
        <div
          className="canvas-element__info-name"
          style={textStyle(info.nameStyle, { fontWeight: 700, fontSize: 12, color: canvasIsDark ? light : dark, textAlign: alignH })}
        >
          {info.name}
        </div>
      )}
      {info.company && (
        <div
          className="canvas-element__info-company"
          style={textStyle(info.companyStyle, { fontWeight: 600, fontSize: 10.5, color: mid, textAlign: alignH })}
        >
          {info.company}
        </div>
      )}
      {info.role && (
        <div
          className="canvas-element__info-role"
          style={textStyle(info.roleStyle, { fontWeight: 400, fontSize: 9.5, color: hexToRgba(mid, 0.65), textAlign: alignH })}
        >
          {info.role}
        </div>
      )}
    </div>
  )
}
