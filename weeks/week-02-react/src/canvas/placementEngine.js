import { growGridRows } from './gridMath.js'

// Span pools per role, in grid cells (colSpan x rowSpan). Randomized choice
// within these pools is where "unexpected" placement variety comes from,
// while the pools themselves keep spans role-appropriate (PRD 8.5: weighted/
// rule-based, not naive-random).
const COL_SPAN_POOL = {
  title: [3, 4, 5],
  subtitle: [2, 3, 4],
  body: [3, 4, 5],
  accent: [1, 2],
  'image-hero': [3, 4, 5],
  'image-card': [1, 2],
  asset: [2, 3],
}
const ROW_SPAN_POOL = {
  title: [1],
  subtitle: [1],
  body: [2, 3],
  accent: [1],
  'image-hero': [3, 4, 5],
  'image-card': [1, 2],
  asset: [2, 3],
}

const SIZE_POOL = {
  title: [40],
  subtitle: [24],
  body: [16],
  accent: [14, 12],
}
export const READABLE_FLOOR = 10
export const DEFAULT_HEADER_CEILING = 24 // smallest PRD header preset, used when no header is placed yet

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}
function pickFrom(pool) {
  return pool[Math.floor(Math.random() * pool.length)]
}

export function pickSpan(role, cols, rows) {
  const colSpan = Math.min(pickFrom(COL_SPAN_POOL[role] || [1]), cols)
  const rowSpan = Math.min(pickFrom(ROW_SPAN_POOL[role] || [1]), rows)
  return { colSpan, rowSpan }
}

// Header-dominance enforcement: body/accent sizes are clamped below the
// smallest currently-placed title/subtitle size. Runs at placement time only
// — an already-placed element's stored size never changes retroactively.
export function pickSize(role, placedHeaderSizes) {
  let pool = SIZE_POOL[role] || [16]
  if (role === 'body' || role === 'accent') {
    const headerMin = placedHeaderSizes.length ? Math.min(...placedHeaderSizes) : DEFAULT_HEADER_CEILING
    const filtered = pool.filter((s) => s < headerMin)
    pool = filtered.length ? filtered : [Math.max(READABLE_FLOOR, headerMin - 4)]
  }
  return pickFrom(pool)
}

export function buildOccupancy(placements, grid) {
  const occ = new Set()
  for (const key in placements) {
    const p = placements[key]
    for (let r = p.row; r < p.row + p.rowSpan; r++) {
      for (let c = p.col; c < p.col + p.colSpan; c++) {
        occ.add(`${r}:${c}`)
      }
    }
  }
  return occ
}

export function regionFree(occupancy, row, col, rowSpan, colSpan) {
  for (let r = row; r < row + rowSpan; r++) {
    for (let c = col; c < col + colSpan; c++) {
      if (occupancy.has(`${r}:${c}`)) return false
    }
  }
  return true
}

export function markOccupied(occupancy, row, col, rowSpan, colSpan) {
  for (let r = row; r < row + rowSpan; r++) {
    for (let c = col; c < col + colSpan; c++) {
      occupancy.add(`${r}:${c}`)
    }
  }
}

// Randomized-start first-fit scan for one span size, extracted out of
// placeElement so shuffleEngine.js can reuse the exact same scan (e.g. to try
// a spot before falling back to its own stacked-overlap pairing) without
// duplicating the wrapping-index math.
export function scanFirstFit(occupancy, grid, colSpan, rowSpan) {
  const startRow = randInt(0, grid.rows - 1)
  const startCol = randInt(0, grid.cols - 1)
  const total = grid.rows * grid.cols
  for (let i = 0; i < total; i++) {
    const cellIndex = startCol + i
    const row = (startRow + Math.floor(cellIndex / grid.cols)) % grid.rows
    const col = cellIndex % grid.cols
    if (row + rowSpan > grid.rows || col + colSpan > grid.cols) continue
    if (regionFree(occupancy, row, col, rowSpan, colSpan)) {
      return { row, col }
    }
  }
  return null
}

// First-fit scan from a randomized start point — structurally guarantees no
// overlap without needing "smart" collision math. If no free region fits at
// the chosen span, shrinks the span and retries; if still nothing fits, grows
// the grid downward (more rows) and retries once more.
// `allowGrow: false` (shuffleEngine.js — shuffle must never change the
// canvas/template size) keeps shrinking all the way down to a 1x1 footprint
// instead of growing, and as an absolute last resort places at (0,0) even if
// that means overlapping something — only reachable on a grid so full there
// isn't a single free cell left, which should be exceptionally rare.
export function placeElement(occupancy, grid, role, { allowGrow = true, span } = {}) {
  let { colSpan, rowSpan } = span
    ? { colSpan: Math.min(span.colSpan, grid.cols), rowSpan: Math.min(span.rowSpan, grid.rows) }
    : pickSpan(role, grid.cols, grid.rows)

  for (let attempt = 0; attempt < 2; attempt++) {
    const spot = scanFirstFit(occupancy, grid, colSpan, rowSpan)
    if (spot) {
      markOccupied(occupancy, spot.row, spot.col, rowSpan, colSpan)
      return { row: spot.row, col: spot.col, colSpan, rowSpan, grid }
    }
    colSpan = Math.max(1, colSpan - 1)
    rowSpan = Math.max(1, rowSpan - 1)
  }

  if (!allowGrow) {
    while (colSpan > 1 || rowSpan > 1) {
      colSpan = Math.max(1, colSpan - 1)
      rowSpan = Math.max(1, rowSpan - 1)
      const spot = scanFirstFit(occupancy, grid, colSpan, rowSpan)
      if (spot) {
        markOccupied(occupancy, spot.row, spot.col, rowSpan, colSpan)
        return { row: spot.row, col: spot.col, colSpan, rowSpan, grid }
      }
    }
    markOccupied(occupancy, 0, 0, 1, 1)
    return { row: 0, col: 0, colSpan: 1, rowSpan: 1, grid }
  }

  const grownGrid = growGridRows(grid, 2)
  return placeElement(occupancy, grownGrid, role, { allowGrow, span })
}

// Places a new member of an autolayout group (date/time/location) directly
// beneath the group's existing members, reusing their exact column band
// (col + colSpan) instead of picking a fresh spot — this is what makes the
// group read as one stacked block rather than independently scattered
// elements. Grows the grid downward if the stack runs off the bottom edge.
// Returns null (never grid-grows past a couple retries) if the column band
// is unexpectedly occupied by something else, so the caller can fall back
// to placing this field independently instead.
// `rowSpan` defaults to 1 (every existing caller's original assumption —
// short single-line accent text) but shuffleEngine.js passes a computed
// value for members whose actual text needs more than one row to avoid
// clipping. `allowGrow: false` returns null instead of growing if the stack
// would run off the bottom edge, so the caller's existing "fall back to
// independent placement" path handles it — same contract as the existing
// "column band unexpectedly occupied" null case.
export function placeGroupMember(occupancy, grid, col, colSpan, nextRow, rowSpan = 1, { allowGrow = true } = {}) {
  let g = grid
  const row = nextRow
  if (row + rowSpan > g.rows) {
    if (!allowGrow) return null
    g = growGridRows(g, row + rowSpan - g.rows)
  }
  if (!regionFree(occupancy, row, col, rowSpan, colSpan)) return null
  markOccupied(occupancy, row, col, rowSpan, colSpan)
  return { row, col, colSpan, rowSpan, grid: g }
}
