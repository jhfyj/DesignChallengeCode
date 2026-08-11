import { sumTrackRange } from './gridMath.js'

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

// A rotation only swaps a box's bounding footprint (width for height) at an
// odd multiple of 90° — every other angle's true rotated bounding box is
// neither the original W×H nor a clean swap of it (it needs real
// trigonometry: newW = W·|cosθ| + H·|sinθ|, etc.), so this deliberately only
// special-cases 90°/270°, the case the R-key rotate (Canvas.jsx) actually
// produces. Other angles keep the plain single-box rotate-in-place they
// already had.
export function isSwappedRotation(rotation) {
  const norm = ((Math.round(rotation || 0) % 180) + 180) % 180
  return norm === 90
}

// The grid cell a swapped-rotation box's CONTAINER should occupy so it
// actually bounds the rotated shape — centered on roughly the same point the
// un-rotated box was, clamped into the grid. Row/col/rowSpan/colSpan pass
// straight through when not swapped.
export function outerBoxForRotation({ row, col, rowSpan, colSpan, rotation }, grid) {
  if (!isSwappedRotation(rotation)) return { row, col, rowSpan, colSpan }
  const newRowSpan = clamp(colSpan, 1, grid.rows)
  const newColSpan = clamp(rowSpan, 1, grid.cols)
  const centerRow = row + rowSpan / 2
  const centerCol = col + colSpan / 2
  const newRow = clamp(Math.round(centerRow - newRowSpan / 2), 0, grid.rows - newRowSpan)
  const newCol = clamp(Math.round(centerCol - newColSpan / 2), 0, grid.cols - newColSpan)
  return { row: newRow, col: newCol, rowSpan: newRowSpan, colSpan: newColSpan }
}

// Style patch (gridRow/gridColumn/transform, plus width/height/justifySelf/
// alignSelf when swapped) for an element whose box needs to visually rotate
// WITHOUT its content reflowing to a different shape first. Swapping the
// container's own track span and letting the box fill it (the naive fix)
// doesn't work: the box would just re-lay-out square-in-place at the SWAPPED
// size and then rotating THAT brings its footprint right back to roughly the
// ORIGINAL orientation — the rotation cancels out instead of compounding.
// Instead the box keeps its pre-rotation pixel size explicit (from the
// grid's real track sizes, not swapped) and is centered inside the
// swapped-and-therefore-bigger-in-one-axis grid cell (outerBoxForRotation
// above), then rotated as a whole — so the CONTAINER ends up matching the
// rotated bounding box while the CONTENT inside keeps reading at its
// original, unrotated dimensions, same as tipping a physical card over.
export function rotatedBoxStyle(placement, grid) {
  const { row, col, rowSpan, colSpan, rotation } = placement
  const outer = outerBoxForRotation(placement, grid)
  const style = {
    gridRow: `${outer.row + 1} / span ${outer.rowSpan}`,
    gridColumn: `${outer.col + 1} / span ${outer.colSpan}`,
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
  }
  if (isSwappedRotation(rotation)) {
    style.width = sumTrackRange(grid.colSizes, col, colSpan, grid.gapPx)
    style.height = sumTrackRange(grid.rowSizes, row, rowSpan, grid.gapPx)
    style.justifySelf = 'center'
    style.alignSelf = 'center'
  }
  return style
}
