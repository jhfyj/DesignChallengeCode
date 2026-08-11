import LockIcon from './LockIcon.jsx'
import { lineEndpointPx } from './lineGeometry.js'

// A Line's selection affordance — SelectionOverlay.jsx's box-corner/edge
// model doesn't apply (a line has no width/height box), so this renders two
// endpoint handles instead, one per end, each forwarding straight to
// useLineDrag.js's startEndpointDrag. Positioned in the same content-box-
// local space LineElement.jsx renders its <line> in.
export default function LineSelectionOverlay({ placement, grid, onStartEndpointDrag, onToggleLock }) {
  const { x1Idx, y1Idx, x2Idx, y2Idx, locked } = placement
  const p1 = lineEndpointPx(grid, x1Idx, y1Idx)
  const p2 = lineEndpointPx(grid, x2Idx, y2Idx)
  const midX = grid.marginPx + (p1.x + p2.x) / 2
  const midY = grid.marginPx + (p1.y + p2.y) / 2

  return (
    <>
      <button
        type="button"
        className="line-selection__lock"
        style={{ left: midX, top: midY }}
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault() }}
        onClick={(e) => { e.stopPropagation(); onToggleLock() }}
        aria-label={locked ? 'Unlock line' : 'Lock line'}
        aria-pressed={locked}
      >
        <LockIcon locked={locked} />
      </button>
      {!locked && (
        <>
          <button
            type="button"
            className="line-selection__handle"
            style={{ left: grid.marginPx + p1.x, top: grid.marginPx + p1.y }}
            onPointerDown={(e) => onStartEndpointDrag(e, placement, 'start')}
            aria-label="Drag line start"
          />
          <button
            type="button"
            className="line-selection__handle"
            style={{ left: grid.marginPx + p2.x, top: grid.marginPx + p2.y }}
            onPointerDown={(e) => onStartEndpointDrag(e, placement, 'end')}
            aria-label="Drag line end"
          />
        </>
      )}
    </>
  )
}
