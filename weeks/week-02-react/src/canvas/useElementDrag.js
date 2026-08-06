function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

// Pointer-driven move/resize/rotate for the selected canvas element. Screen
// pixel deltas are converted to grid-cell deltas using the current
// fit-to-view scale + cell step (cellSize + gap), so dragging feels 1:1
// regardless of how zoomed-out the artboard currently is.
export function useElementDrag({ grid, scale, updatePlacement, onSelect }) {
  const stepX = grid.cellWidth + grid.gapPx
  const stepY = grid.cellHeight + grid.gapPx

  function withDragListeners(onMove, onUp) {
    function handleMove(ev) {
      onMove(ev)
    }
    function handleUp(ev) {
      onUp?.(ev)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  function startMove(e, placement) {
    e.stopPropagation()
    e.preventDefault()
    onSelect?.(placement.fieldKey)
    const startX = e.clientX
    const startY = e.clientY
    const { row: startRow, col: startCol, colSpan, rowSpan } = placement

    withDragListeners((ev) => {
      const dx = (ev.clientX - startX) / scale
      const dy = (ev.clientY - startY) / scale
      const deltaCol = Math.round(dx / stepX)
      const deltaRow = Math.round(dy / stepY)
      const col = clamp(startCol + deltaCol, 0, grid.cols - colSpan)
      const row = clamp(startRow + deltaRow, 0, grid.rows - rowSpan)
      updatePlacement(placement.fieldKey, { col, row })
    })
  }

  // Which axes a handle drags, and which edge of the box stays put (the
  // opposite edge/corner is the anchor — e.g. dragging "w" keeps the right
  // edge fixed and grows the box leftward instead of the default top-left
  // anchor every handle used before there was more than one of them).
  const HANDLE_CONFIG = {
    n: { x: false, y: true, fromLeft: false, fromTop: true },
    s: { x: false, y: true, fromLeft: false, fromTop: false },
    e: { x: true, y: false, fromLeft: false, fromTop: false },
    w: { x: true, y: false, fromLeft: true, fromTop: false },
    ne: { x: true, y: true, fromLeft: false, fromTop: true },
    nw: { x: true, y: true, fromLeft: true, fromTop: true },
    se: { x: true, y: true, fromLeft: false, fromTop: false },
    sw: { x: true, y: true, fromLeft: true, fromTop: false },
  }

  // A corner handle (drags both axes at once) scales the box AND the font
  // together, proportionally — the box keeps hugging the text at its new
  // size, same as dragging a text object's corner in a design tool. An edge
  // handle (one axis only) stretches just that dimension of the box; font
  // size is untouched and the text simply re-wraps/re-fills the new width
  // or height, same as the old single-handle behavior.
  function startResize(e, placement, handle = 'se') {
    e.stopPropagation()
    e.preventDefault()
    const cfg = HANDLE_CONFIG[handle]
    const isCorner = cfg.x && cfg.y
    const startX = e.clientX
    const startY = e.clientY
    const { row: startRow, col: startCol, colSpan: startColSpan, rowSpan: startRowSpan } = placement
    const startFontSize = placement.fontSizeOverride ?? placement.fontSize
    const startWidthPx = startColSpan * grid.cellWidth + (startColSpan - 1) * grid.gapPx
    const startHeightPx = startRowSpan * grid.cellHeight + (startRowSpan - 1) * grid.gapPx

    withDragListeners((ev) => {
      const dx = (ev.clientX - startX) / scale
      const dy = (ev.clientY - startY) / scale
      const deltaCol = Math.round(dx / stepX) * (cfg.fromLeft ? -1 : 1)
      const deltaRow = Math.round(dy / stepY) * (cfg.fromTop ? -1 : 1)

      let col = startCol
      let colSpan = startColSpan
      if (cfg.x) {
        if (cfg.fromLeft) {
          const rightEdge = startCol + startColSpan
          colSpan = clamp(startColSpan + deltaCol, 1, rightEdge)
          col = rightEdge - colSpan
        } else {
          colSpan = clamp(startColSpan + deltaCol, 1, grid.cols - startCol)
        }
      }

      let row = startRow
      let rowSpan = startRowSpan
      if (cfg.y) {
        if (cfg.fromTop) {
          const bottomEdge = startRow + startRowSpan
          rowSpan = clamp(startRowSpan + deltaRow, 1, bottomEdge)
          row = bottomEdge - rowSpan
        } else {
          rowSpan = clamp(startRowSpan + deltaRow, 1, grid.rows - startRow)
        }
      }

      const patch = { row, col, colSpan, rowSpan }

      if (isCorner && typeof startFontSize === 'number') {
        const newWidthPx = colSpan * grid.cellWidth + (colSpan - 1) * grid.gapPx
        const newHeightPx = rowSpan * grid.cellHeight + (rowSpan - 1) * grid.gapPx
        const scaleFactor = (newWidthPx / startWidthPx + newHeightPx / startHeightPx) / 2
        patch.fontSizeOverride = clamp(Math.round(startFontSize * scaleFactor), 8, 300)
      }

      updatePlacement(placement.fieldKey, patch)
    })
  }

  function startRotate(e, placement, boxEl) {
    e.stopPropagation()
    e.preventDefault()
    const rect = boxEl.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const startAngle = (Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180) / Math.PI
    const startRotation = placement.rotation || 0

    withDragListeners((ev) => {
      const angle = (Math.atan2(ev.clientY - centerY, ev.clientX - centerX) * 180) / Math.PI
      let rotation = startRotation + (angle - startAngle)
      // Default: snap to 15° increments, matching the panel's Rotation
      // slider/step. Hold Shift for free rotation.
      if (!ev.shiftKey) rotation = Math.round(rotation / 15) * 15
      updatePlacement(placement.fieldKey, { rotation })
    })
  }

  return { startMove, startResize, startRotate }
}
