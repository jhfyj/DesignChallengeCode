import { withDragListeners } from './dragListeners.js'

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

// Which axes a handle drags, and which edge of the box stays put — same
// mapping as useElementDrag.js's HANDLE_CONFIG. The info block never sets
// its own row/col directly though (see speakerInfoLayout.js): its anchor
// point is always derived from the linked photo + caption position, so
// resizing only ever needs to change colSpan/rowSpan — computeSpeakerInfoGeometry
// takes care of growing the box in the right direction (e.g. "Above" grows
// upward, "Left" grows leftward) from those alone.
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

// Real on-canvas resize/rotate for the speaker info block — same drag feel
// as useElementDrag.js's startResize/startRotate, but writing to the speaker
// content object (infoColSpanOverride/infoRowSpanOverride/infoRotation) via
// updateSpeaker instead of updatePlacement, since the info block isn't a
// placement. No startMove: the block's anchor position is never independently
// draggable, only its size and rotation (see speakerInfoLayout.js).
export function useSpeakerInfoDrag({ grid, scale, updateSpeaker }) {
  const stepX = grid.cellWidth + grid.gapPx
  const stepY = grid.cellHeight + grid.gapPx

  function startResize(e, index, geometry, handle = 'se') {
    e.stopPropagation()
    e.preventDefault()
    const cfg = HANDLE_CONFIG[handle]
    const startX = e.clientX
    const startY = e.clientY
    const { row: startRow, col: startCol, colSpan: startColSpan, rowSpan: startRowSpan } = geometry

    withDragListeners((ev) => {
      const dx = (ev.clientX - startX) / scale
      const dy = (ev.clientY - startY) / scale
      const deltaCol = Math.round(dx / stepX) * (cfg.fromLeft ? -1 : 1)
      const deltaRow = Math.round(dy / stepY) * (cfg.fromTop ? -1 : 1)

      const patch = {}
      if (cfg.x) {
        const maxColSpan = Math.max(1, cfg.fromLeft ? startCol + startColSpan : grid.cols - startCol)
        patch.infoColSpanOverride = clamp(startColSpan + deltaCol, 1, maxColSpan)
      }
      if (cfg.y) {
        const maxRowSpan = Math.max(1, cfg.fromTop ? startRow + startRowSpan : grid.rows - startRow)
        patch.infoRowSpanOverride = clamp(startRowSpan + deltaRow, 1, maxRowSpan)
      }
      updateSpeaker(index, patch)
    })
  }

  function startRotate(e, index, rotation, boxEl) {
    e.stopPropagation()
    e.preventDefault()
    const rect = boxEl.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const startAngle = (Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180) / Math.PI
    const startRotation = rotation || 0

    withDragListeners((ev) => {
      const angle = (Math.atan2(ev.clientY - centerY, ev.clientX - centerX) * 180) / Math.PI
      let nextRotation = startRotation + (angle - startAngle)
      if (!ev.shiftKey) nextRotation = Math.round(nextRotation / 15) * 15
      updateSpeaker(index, { infoRotation: nextRotation })
    })
  }

  return { startResize, startRotate }
}
