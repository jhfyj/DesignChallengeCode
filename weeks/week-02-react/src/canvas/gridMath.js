export const PAGE_SIZE_PX = {
  'Instagram Square (1x1)': { width: 540, height: 540 },
  'Instagram Story (9:16)': { width: 540, height: 960 },
  Banner: { width: 800, height: 450 },
}

export function getPageDimensions(pageSize, customWidth, customHeight) {
  if (pageSize === 'Custom') return { width: customWidth, height: customHeight }
  return PAGE_SIZE_PX[pageSize] || PAGE_SIZE_PX['Instagram Square (1x1)']
}

// Anchor tuned so the 540 square (half of the original 1080 default) at the
// default gap/margin (12/6) lands around a 6x6 grid — dense enough for
// varied multi-cell spans, coarse enough that individual cells stay legible
// at typical export sizes.
const BASE_CELL_PX = 80
const MIN_CELLS = 2
const MAX_CELLS = 16

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

// Keeps grid cells "as square as possible for the given canvas dimensions"
// (PRD Section 6) by deriving column/row count from the same target cell
// size on both axes, rather than a fixed column count — a tall Story page
// naturally gets more rows instead of just 3 wide columns.
export function computeGrid(pixelWidth, pixelHeight, gapPx, marginPx) {
  const usableWidth = Math.max(1, pixelWidth - 2 * marginPx)
  const usableHeight = Math.max(1, pixelHeight - 2 * marginPx)

  const cols = clamp(Math.round(usableWidth / (BASE_CELL_PX + gapPx)), MIN_CELLS, MAX_CELLS)
  const rows = clamp(Math.round(usableHeight / (BASE_CELL_PX + gapPx)), MIN_CELLS, MAX_CELLS)

  const cellWidth = (usableWidth - (cols - 1) * gapPx) / cols
  const cellHeight = (usableHeight - (rows - 1) * gapPx) / rows

  return { cols, rows, cellWidth, cellHeight, usableWidth, usableHeight, marginPx, gapPx, pixelWidth, pixelHeight }
}

// Extends the logical row count (keeping the existing cellHeight), used when
// the placement engine runs out of room for a new element.
export function growGridRows(grid, addRows) {
  const rows = grid.rows + addRows
  const pixelHeight = grid.marginPx * 2 + rows * grid.cellHeight + (rows - 1) * grid.gapPx
  return { ...grid, rows, pixelHeight }
}
