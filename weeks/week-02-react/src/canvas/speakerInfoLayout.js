function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

// Derives the speaker-info text block's grid position from its linked
// photo's CURRENT placement, fresh on every call — never stored, never
// separately dragged. This is what keeps the two "stay linked": moving or
// resizing the photo recomputes the info block's position on the very same
// render, with no sync effect (and no way for them to drift apart).
// Size (colSpan/rowSpan) is the one thing that IS user-adjustable (the
// panel's Width/Height sliders — see SpeakerInfoPanel.jsx) via
// colSpanOverride/rowSpanOverride: it defaults to matching the photo the
// same way it always has, but a user request is honored up to however much
// room actually exists at the anchor point, so a stale override from a
// smaller grid can't push the block off the artboard.
// Returns null when there's no room for it at all (e.g. Above on the top
// row) — the info block simply doesn't render rather than overlapping the photo.
export function computeSpeakerInfoGeometry(photo, captionPosition, grid, overrides = {}) {
  const { colSpanOverride, rowSpanOverride } = overrides
  switch (captionPosition) {
    case 'Above': {
      if (photo.row <= 0) return null
      const rowSpan = clamp(rowSpanOverride ?? 1, 1, photo.row)
      const colSpan = clamp(colSpanOverride ?? photo.colSpan, 1, grid.cols - photo.col)
      return { row: photo.row - rowSpan, col: photo.col, colSpan, rowSpan }
    }
    case 'Left': {
      if (photo.col <= 0) return null
      const colSpan = clamp(colSpanOverride ?? 1, 1, photo.col)
      const rowSpan = clamp(rowSpanOverride ?? photo.rowSpan, 1, grid.rows - photo.row)
      return { row: photo.row, col: photo.col - colSpan, colSpan, rowSpan }
    }
    case 'Right': {
      const col = photo.col + photo.colSpan
      if (col >= grid.cols) return null
      const colSpan = clamp(colSpanOverride ?? 1, 1, grid.cols - col)
      const rowSpan = clamp(rowSpanOverride ?? photo.rowSpan, 1, grid.rows - photo.row)
      return { row: photo.row, col, colSpan, rowSpan }
    }
    case 'Below':
    default: {
      const row = photo.row + photo.rowSpan
      if (row >= grid.rows) return null
      const rowSpan = clamp(rowSpanOverride ?? 1, 1, grid.rows - row)
      const colSpan = clamp(colSpanOverride ?? photo.colSpan, 1, grid.cols - photo.col)
      return { row, col: photo.col, colSpan, rowSpan }
    }
  }
}
