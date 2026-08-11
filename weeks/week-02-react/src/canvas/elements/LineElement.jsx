import { resolveTriad, relativeLuminance } from '../colorContrast.js'
import { lineEndpointPx } from '../lineGeometry.js'

// Wider than the visible stroke so it's actually grabbable at thin stroke
// widths — same "invisible hit strip around a thin visible bar" trick
// CustomGridOverlay.jsx uses for its divider lines.
const HIT_STROKE_WIDTH = 14

export default function LineElement({ placement, grid, colors, canvasColor, selected, onPointerDown }) {
  const { x1Idx, y1Idx, x2Idx, y2Idx, locked } = placement
  const strokeWidth = placement.strokeWidth ?? 2
  const strokeStyle = placement.strokeStyle || 'Solid'
  const p1 = lineEndpointPx(grid, x1Idx, y1Idx)
  const p2 = lineEndpointPx(grid, x2Idx, y2Idx)
  const { light, dark } = resolveTriad(colors)
  const canvasIsDark = relativeLuminance(canvasColor || '#ffffff') < 0.5
  const strokeColor = placement.colorOverride || (canvasIsDark ? light : dark)
  const dashArray = strokeStyle === 'Dashed' ? `${strokeWidth * 3} ${strokeWidth * 2}` : undefined

  return (
    <svg
      className={`canvas-line${locked ? ' is-locked' : ''}`}
      style={{ left: grid.marginPx, top: grid.marginPx, width: grid.usableWidth, height: grid.usableHeight }}
    >
      {selected && (
        <line
          className="canvas-line__halo"
          x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
          strokeWidth={strokeWidth + 6}
        />
      )}
      {/* The only child that actually catches pointer events (see .canvas-line's
          pointer-events: none in Canvas.css) — otherwise the plain <svg> root
          would hit-test across its whole rectangular bounding box instead of
          just the line itself, blocking clicks on anything underneath a
          diagonal line's much larger bounding box. */}
      <line
        className="canvas-line__hit"
        x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
        strokeWidth={HIT_STROKE_WIDTH}
        onPointerDown={onPointerDown}
      />
      <line
        className="canvas-line__stroke"
        x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={dashArray}
      />
    </svg>
  )
}
