import { withDragListeners } from './dragListeners.js'
import { MIN_TRACK_PX, axisFromPoint, clampLinePosition } from './customGrid.js'

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

// Pointer-driven drag-to-reposition for a single Custom grid divider line.
// Converts screen-px delta into a change in the line's 0..1 fractional
// position (see customGrid.js), clamped against its immediate neighbors on
// the same axis (locked or not — a locked neighbor is just as immovable a
// boundary as the canvas edge) so tracks can never invert or collapse below
// MIN_TRACK_PX. "Resizing the two adjacent tracks inversely" falls out for
// free from this — moving one line's position only ever changes the size of
// the two tracks it directly borders, recomputed fresh by linesToTrackSizes.
export function useGridLineDrag({ grid, scale, customGridLines, updateGridLine, artboardRef, pushHistory }) {
  function startDrag(e, line) {
    e.stopPropagation()
    e.preventDefault()
    if (line.locked) return
    pushHistory()

    const usablePx = line.axis === 'col' ? grid.usableWidth : grid.usableHeight
    const startClient = line.axis === 'col' ? e.clientX : e.clientY
    const startPosition = line.position
    const minFraction = MIN_TRACK_PX / usablePx

    const neighbors = customGridLines.filter((l) => l.axis === line.axis && l.id !== line.id).map((l) => l.position)
    const nearestLower = neighbors.filter((p) => p < startPosition).reduce((max, p) => Math.max(max, p), 0)
    const nearestUpper = neighbors.filter((p) => p > startPosition).reduce((min, p) => Math.min(min, p), 1)
    const lowerBound = nearestLower + minFraction
    const upperBound = nearestUpper - minFraction

    withDragListeners((ev) => {
      const deltaClient = ((line.axis === 'col' ? ev.clientX : ev.clientY) - startClient) / scale
      const deltaFraction = deltaClient / usablePx
      updateGridLine(line.id, { position: clamp(startPosition + deltaFraction, lowerBound, upperBound) })
    })
  }

  // Dragging one of a line's two end handles (CustomGridOverlay.jsx) — unlike
  // startDrag above (which only ever slides the line along its own axis),
  // this tracks the pointer's absolute position against all four canvas
  // edges every move. Whichever edge-pair (see axisFromPoint) the pointer
  // currently reads as nearer decides the line's axis for that frame, so
  // dragging an end far enough "around the corner" of the canvas converts a
  // horizontal divider into a vertical one (or back), landing at whatever
  // fraction the pointer represents on the new axis.
  function startEndDrag(e, line) {
    e.stopPropagation()
    e.preventDefault()
    if (line.locked) return
    pushHistory()

    withDragListeners((ev) => {
      const rect = artboardRef.current.getBoundingClientRect()
      // rect is the already-scaled on-screen box (scale/zoom + fit-to-view
      // are just CSS transforms on ancestors) — dividing the real grid pixel
      // size by it recovers the scale factor without needing it passed in.
      const localX = (ev.clientX - rect.left) * (grid.pixelWidth / rect.width)
      const localY = (ev.clientY - rect.top) * (grid.pixelHeight / rect.height)
      const usableX = clamp(localX - grid.marginPx, 0, grid.usableWidth)
      const usableY = clamp(localY - grid.marginPx, 0, grid.usableHeight)

      const axis = axisFromPoint(usableX, usableY, grid.usableWidth, grid.usableHeight)
      const usablePxForAxis = axis === 'col' ? grid.usableWidth : grid.usableHeight
      const rawFraction = axis === 'col' ? usableX / grid.usableWidth : usableY / grid.usableHeight
      const neighbors = customGridLines.filter((l) => l.axis === axis && l.id !== line.id)
      const position = clampLinePosition(rawFraction, usablePxForAxis, neighbors)

      updateGridLine(line.id, { axis, position })
    })
  }

  return { startDrag, startEndDrag }
}
