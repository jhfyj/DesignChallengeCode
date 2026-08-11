// Pixel geometry for the Line element's two endpoints. Unlike every other
// placement (positioned by CSS grid row/col cell), a Line's endpoints are
// stored as grid CORNER boundary indices — x1Idx/y1Idx/x2Idx/y2Idx, where an
// x index of 0..cols picks one of the cols+1 vertical track boundaries and a
// y index of 0..rows picks one of the rows+1 horizontal ones. Storing the
// corner index (not a pixel or fraction) means a Line stays snapped to a
// real grid corner even as gap/margin/page-size change the grid underneath
// it, same as how row/col already survive those changes for every other
// element.

// Track-boundary positions along one axis, content-box-local (0 at the
// margin edge). Internal boundaries sit at the middle of the gutter between
// two tracks — the same "center of the gap" convention customGrid.js's
// computeLineOffsets already uses to render a Custom grid line, so a
// snapped Line endpoint lines up with what's visually drawn there. Works
// identically for a Uniform grid too, since colSizes/rowSizes already hold
// real per-track pixel sizes either way (see gridMath.js's computeGrid).
function axisBoundaries(sizes, gapPx, usablePx) {
  const boundaries = [0]
  let cum = 0
  for (let i = 0; i < sizes.length; i++) {
    cum += sizes[i]
    if (i < sizes.length - 1) {
      boundaries.push(cum + gapPx / 2)
      cum += gapPx
    }
  }
  boundaries.push(usablePx)
  return boundaries
}

export function computeGridCorners(grid) {
  return {
    xs: axisBoundaries(grid.colSizes, grid.gapPx, grid.usableWidth),
    ys: axisBoundaries(grid.rowSizes, grid.gapPx, grid.usableHeight),
  }
}

// A grid-shape change (page size, gap, Uniform<->Custom) can leave a
// previously-valid index past the end of the new boundary list — clamped
// here rather than reconciled up front, so a Line just lands on whatever's
// now the nearest surviving corner instead of needing its own gridChanged
// effect (see usePlacementEngine.js for the equivalent for row/col placements).
function clampIndex(i, length) {
  return Math.min(Math.max(i, 0), length - 1)
}

// Content-box-local pixel position (relative to the grid's own top-left,
// i.e. add grid.marginPx to place it on the artboard) of one endpoint.
export function lineEndpointPx(grid, colIdx, rowIdx) {
  const { xs, ys } = computeGridCorners(grid)
  return { x: xs[clampIndex(colIdx, xs.length)], y: ys[clampIndex(rowIdx, ys.length)] }
}

// Nearest grid corner (row AND col boundary at once) to a raw content-box
// pixel point — this is what lets a Line's endpoint snap DIAGONALLY to any
// corner in the grid, unlike every other drag (useElementDrag.js), which
// only ever quantizes one axis at a time to a whole grid-cell step. Since
// the boundaries form an axis-aligned lattice, minimizing the x and y
// distance independently is exact for 2D nearest-corner too (distance²
// separates additively across the two axes).
export function nearestGridCornerIndex(grid, x, y) {
  const { xs, ys } = computeGridCorners(grid)
  let colIdx = 0
  let bestColDist = Infinity
  xs.forEach((gx, i) => {
    const d = Math.abs(x - gx)
    if (d < bestColDist) { bestColDist = d; colIdx = i }
  })
  let rowIdx = 0
  let bestRowDist = Infinity
  ys.forEach((gy, i) => {
    const d = Math.abs(y - gy)
    if (d < bestRowDist) { bestRowDist = d; rowIdx = i }
  })
  return { colIdx, rowIdx }
}
