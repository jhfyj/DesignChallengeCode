import { withDragListeners } from './dragListeners.js'
import { nearestGridCornerIndex } from './lineGeometry.js'

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

// Pointer-driven move + endpoint-drag for a Line placement. startEndpointDrag
// is the one drag in the whole canvas that snaps to a full 2D grid corner
// (row AND col boundary together) instead of one grid-cell step along a
// single axis at a time (useElementDrag.js's startMove/startResize) — see
// lineGeometry.js's nearestGridCornerIndex — which is what lets a Line run
// diagonally between any two corners instead of only ever staying axis-
// aligned to the cell lattice.
export function useLineDrag({ grid, scale, updatePlacement, artboardRef, onSelect, pushHistory }) {
  const stepX = grid.cellWidth + grid.gapPx
  const stepY = grid.cellHeight + grid.gapPx
  const maxColIdx = grid.colSizes.length
  const maxRowIdx = grid.rowSizes.length

  // Dragging the line's body (not an endpoint) translates both ends
  // together by the same whole-cell delta, same quantization feel as moving
  // any other element — clamped so neither end can be pushed past the grid
  // edge (the line's length/angle never changes from a move-drag, only from
  // dragging one of its own endpoints).
  function startMove(e, placement) {
    e.stopPropagation()
    e.preventDefault()
    onSelect?.(placement.fieldKey)
    if (placement.locked) return
    pushHistory()
    const startX = e.clientX
    const startY = e.clientY
    const { x1Idx, y1Idx, x2Idx, y2Idx } = placement

    withDragListeners((ev) => {
      const dx = (ev.clientX - startX) / scale
      const dy = (ev.clientY - startY) / scale
      const deltaCol = clamp(Math.round(dx / stepX), -Math.min(x1Idx, x2Idx), maxColIdx - Math.max(x1Idx, x2Idx))
      const deltaRow = clamp(Math.round(dy / stepY), -Math.min(y1Idx, y2Idx), maxRowIdx - Math.max(y1Idx, y2Idx))
      updatePlacement(placement.fieldKey, {
        x1Idx: x1Idx + deltaCol, y1Idx: y1Idx + deltaRow,
        x2Idx: x2Idx + deltaCol, y2Idx: y2Idx + deltaRow,
      })
    })
  }

  function startEndpointDrag(e, placement, which) {
    e.stopPropagation()
    e.preventDefault()
    onSelect?.(placement.fieldKey)
    if (placement.locked) return
    pushHistory()

    withDragListeners((ev) => {
      const rect = artboardRef.current.getBoundingClientRect()
      // rect is the already-scaled on-screen box (scale/zoom + fit-to-view
      // are just CSS transforms on ancestors) — same pixel-recovery pattern
      // as useGridLineDrag.js's startEndDrag.
      const localX = (ev.clientX - rect.left) * (grid.pixelWidth / rect.width)
      const localY = (ev.clientY - rect.top) * (grid.pixelHeight / rect.height)
      const usableX = localX - grid.marginPx
      const usableY = localY - grid.marginPx
      const { colIdx, rowIdx } = nearestGridCornerIndex(grid, usableX, usableY)
      const patch = which === 'start' ? { x1Idx: colIdx, y1Idx: rowIdx } : { x2Idx: colIdx, y2Idx: rowIdx }
      updatePlacement(placement.fieldKey, patch)
    })
  }

  return { startMove, startEndpointDrag }
}
