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

  // colSizes/rowSizes: the per-track pixel width/height array every consumer
  // (Artboard's CSS grid-template, sumTrackRange below) actually renders
  // from. Flat-filled from the single cellWidth/cellHeight scalar here so a
  // uniform grid is just the degenerate case of the same data shape a
  // Custom (non-uniform) grid uses — see applyCustomTrackSizes.
  return {
    cols, rows, cellWidth, cellHeight, usableWidth, usableHeight, marginPx, gapPx, pixelWidth, pixelHeight,
    colSizes: Array(cols).fill(cellWidth),
    rowSizes: Array(rows).fill(cellHeight),
  }
}

// Sum of `span` consecutive track sizes starting at `startIndex`, plus the
// gaps between them — the non-uniform replacement for the old
// `span * cellWidth + (span-1) * gapPx` scalar math, for call sites that
// already know which specific tracks a placement occupies (as opposed to a
// pre-placement estimate that doesn't know the start index yet).
export function sumTrackRange(sizes, startIndex, span, gapPx) {
  let total = 0
  for (let i = startIndex; i < startIndex + span; i++) total += sizes[i]
  return total + (span - 1) * gapPx
}

// Layers custom (non-uniform) track sizes onto an existing grid object — a
// drop-in replacement for a uniform baseGrid anywhere one is consumed.
// cols/rows are recomputed from the array lengths (a Custom grid genuinely
// has FEWER, BIGGER cells than the uniform grid it's layered over — a
// handful of structural divisions, not the same dense lattice just resized —
// so cols/rows must match colSizes.length/rowSizes.length or placement math
// elsewhere would still scan/bound-check against the old uniform count and
// try to use cells that don't actually exist in the CSS grid-template).
// cellWidth/cellHeight (the "average track size" reference used by
// pre-placement text-fit estimates) are recomputed too, for the same reason.
export function applyCustomTrackSizes(grid, colSizes, rowSizes) {
  const cellWidth = colSizes.reduce((a, b) => a + b, 0) / colSizes.length
  const cellHeight = rowSizes.reduce((a, b) => a + b, 0) / rowSizes.length
  return { ...grid, colSizes, rowSizes, cols: colSizes.length, rows: rowSizes.length, cellWidth, cellHeight }
}

// Extends the logical row count, used when the placement engine runs out of
// room for a new element. Appends one row per addRows sized to the AVERAGE
// of the existing rowSizes — in a uniform grid that average is exactly
// cellHeight (unchanged behavior); in a custom grid it's a reasonable
// default for a freshly-grown row that didn't come from the line generator.
export function growGridRows(grid, addRows) {
  const rows = grid.rows + addRows
  const avgRowSize = grid.rowSizes.reduce((a, b) => a + b, 0) / grid.rowSizes.length
  const rowSizes = [...grid.rowSizes, ...Array(addRows).fill(avgRowSize)]
  const pixelHeight = grid.marginPx * 2 + rowSizes.reduce((a, b) => a + b, 0) + (rows - 1) * grid.gapPx
  return { ...grid, rows, rowSizes, pixelHeight }
}
