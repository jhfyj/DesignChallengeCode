// Generates and resizes the divider lines behind the "Custom" (Swiss-style
// asymmetric) grid — see gridMath.js for how a line list turns into actual
// per-track pixel sizes for the artboard's CSS grid-template.
//
// A line: { id, axis: 'col' | 'row', position, locked }. `position` is a
// 0..1 fraction of usable width (col) / height (row), not a pixel value —
// fraction-based so a line's relative position survives a page-size change
// without any rescaling logic, the same way placements' row/col indices
// already do.

// No column/row ever gets narrower than this, whether from the generator's
// own spacing or a user's manual drag (see useGridLineDrag.js).
export const MIN_TRACK_PX = 40

// A floor of 1 line/axis (2x2 = 4 cells) turned out to be too sparse even
// for a near-empty canvas: most role span pools (placementEngine.js) request
// at least 3 columns, which clamps to "full width" the instant cols <= 3, so
// a 2x2 grid left almost nothing to stack multiple elements into without
// vertically overlapping. 3x3 and 4x4 both still routinely left title+
// subtitle+body fighting over the same handful of rows — a big Swiss
// display size alone can span 2-3 rows, leaving nothing for what comes
// after it. 4 lines/axis (5x5 = 25 cells) is the floor that actually holds
// a typical title+subtitle+body Swiss layout without forcing placeElement's
// last-resort "just put it at (0,0)" overlap fallback.
const MIN_LINES_PER_AXIS = 4
const MAX_LINES_PER_AXIS = 8
// Roughly one more divider line (across both axes combined) per this many
// filled elements — tuned to land a typical single-field canvas at the
// floor (3 lines/axis) and a busy multi-field canvas (e.g. title + subtitle +
// description + info group + images) near the ceiling well before it runs
// out of room to place everything without cramming.
const ELEMENTS_PER_LINE = 1

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

function nextLineId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `line-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Single source of truth for creating a new line object — the manual
// "double-click to add a line" path (Canvas.jsx) and the algorithmic
// generator below both produce the same shape.
export function createGridLine(axis, position, locked = false) {
  return { id: nextLineId(), axis, position, locked }
}

// Which axis a point "belongs to", by nearest edge-PAIR (not nearest single
// edge): a point closer to the left/right edges than to the top/bottom ones
// is nearer where a 'row' (horizontal) line's two ends live (they terminate
// on the left and right border), so it reads as belonging to a row line —
// and vice versa for 'col'. Used both for double-click placement (Canvas.jsx)
// and for the drag-an-end-around-the-corner axis flip (useGridLineDrag.js),
// so both interactions agree on the same "which axis does this point suggest"
// rule.
export function axisFromPoint(x, y, usableWidth, usableHeight) {
  const distToVerticalEdges = Math.min(x, usableWidth - x) // left/right border distance
  const distToHorizontalEdges = Math.min(y, usableHeight - y) // top/bottom border distance
  return distToVerticalEdges < distToHorizontalEdges ? 'row' : 'col'
}

// Clamps a freshly-chosen fraction so it can't collapse a track below
// MIN_TRACK_PX against the canvas edges or any existing line on the same
// axis — shared by double-click-to-add and the endpoint drag's axis flip
// (both are "place a line at roughly this spot" operations, unlike
// useGridLineDrag's ordinary reposition drag, which is already bounded by
// its own fixed pair of immediate neighbors).
export function clampLinePosition(fraction, usablePx, existingLines = []) {
  const minFraction = MIN_TRACK_PX / usablePx
  let pos = clamp(fraction, minFraction, 1 - minFraction)
  const others = existingLines.map((l) => l.position).sort((a, b) => a - b)
  for (const p of others) {
    if (Math.abs(pos - p) < minFraction) {
      pos = pos < p ? p - minFraction : p + minFraction
    }
  }
  return clamp(pos, minFraction, 1 - minFraction)
}

// How many internal lines to generate per axis for a given element count,
// split roughly proportional to the underlying uniform grid's col/row ratio
// — same "as square as possible" spirit as gridMath.js's own cols/rows
// derivation, so a tall Story canvas biases toward more row-lines instead of
// splitting evenly regardless of aspect ratio.
function lineCountsForAxes(elementCount, baseUniformGrid) {
  const totalLines = clamp(1 + Math.floor(elementCount / ELEMENTS_PER_LINE), 2, MAX_LINES_PER_AXIS * 2)
  const ratio = baseUniformGrid.cols / (baseUniformGrid.cols + baseUniformGrid.rows)
  const colLines = clamp(Math.round(totalLines * ratio), MIN_LINES_PER_AXIS, MAX_LINES_PER_AXIS)
  const rowLines = clamp(totalLines - colLines, MIN_LINES_PER_AXIS, MAX_LINES_PER_AXIS)
  return { colLines, rowLines }
}

// Which line(s), if any, currently sit on the boundary of a placed element's
// cell range — used to auto-lock the lines bounding a newly-locked element
// (see DesignContext.jsx's toggleElementLock) so "lock the element" also
// keeps its cell's actual pixel bounds from shifting under it on the next
// regenerate/shuffle, not just its row/col indices. A boundary at the
// canvas edge (index 0 or totalTracks) has no line object to lock — the
// canvas edge itself never moves.
export function boundingLineIds(lines, axis, startIndex, span, totalTracks) {
  const sorted = lines.filter((l) => l.axis === axis).sort((a, b) => a.position - b.position)
  const ids = []
  if (startIndex > 0 && sorted[startIndex - 1]) ids.push(sorted[startIndex - 1].id)
  const endIndex = startIndex + span
  if (endIndex < totalTracks && sorted[endIndex - 1]) ids.push(sorted[endIndex - 1].id)
  return ids
}

// Generates `count` sorted, asymmetric (deliberately NOT evenly-spaced)
// fractional positions in (0,1), each kept at least `minFraction` away from
// its neighbors and from the 0/1 edges — so no resulting track can collapse
// below MIN_TRACK_PX. `fixedPositions` (this axis's already-locked lines)
// are treated as immovable neighbors the new points must also respect.
function sampleAsymmetricPositions(count, minFraction, fixedPositions) {
  if (count <= 0) return []
  const ATTEMPTS = 30
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const candidates = []
    for (let i = 0; i < count; i++) {
      // Jitter around (not exactly at) the evenly-spaced point for slot i,
      // biased within its own slot band — spreads lines across the canvas
      // while keeping the result visibly asymmetric rather than a uniform grid.
      const evenSlot = (i + 1) / (count + 1)
      const bandWidth = 1 / (count + 1)
      const jitter = (Math.random() - 0.5) * bandWidth * 0.7
      candidates.push(clamp(evenSlot + jitter, minFraction, 1 - minFraction))
    }
    const all = [...candidates, ...fixedPositions].sort((a, b) => a - b)
    const spacingOk = all.every((p, i) => i === 0 || p - all[i - 1] >= minFraction)
    if (spacingOk) return candidates.sort((a, b) => a - b)
  }
  // Fallback: deterministic even spacing — only reachable with a
  // pathologically small canvas / large line-count combination.
  return Array.from({ length: count }, (_, i) => (i + 1) / (count + 1))
}

// Pure. Produces a fresh set of custom grid lines for both axes.
// `existingLines` lets locked lines survive a regenerate untouched — this
// one function serves both "switch to Custom fresh" (existingLines=[]) and
// "Shuffle/manual regenerate" (existingLines=current array): every locked
// line keeps its exact position, only unlocked lines get resampled (around
// the fixed locked ones, never on top of them).
export function generateCustomGridLines(elementCount, baseUniformGrid, existingLines = []) {
  const { colLines, rowLines } = lineCountsForAxes(elementCount, baseUniformGrid)

  function regenerateAxis(axis, targetCount, usablePx) {
    const locked = existingLines.filter((l) => l.axis === axis && l.locked)
    const minFraction = MIN_TRACK_PX / usablePx
    const unlockedCount = Math.max(0, targetCount - locked.length)
    const fresh = sampleAsymmetricPositions(unlockedCount, minFraction, locked.map((l) => l.position))
    const freshLines = fresh.map((position) => ({ id: nextLineId(), axis, position, locked: false }))
    return [...locked, ...freshLines]
  }

  return [
    ...regenerateAxis('col', colLines, baseUniformGrid.usableWidth),
    ...regenerateAxis('row', rowLines, baseUniformGrid.usableHeight),
  ]
}

// Converts one axis's sorted divider positions into actual per-track pixel
// sizes — the array Artboard.jsx's CSS grid-template renders from directly.
// `lines` should already be filtered to a single axis.
export function linesToTrackSizes(lines, usablePx, minTrackPx = MIN_TRACK_PX) {
  const positions = lines.map((l) => l.position).sort((a, b) => a - b)
  const boundaries = [0, ...positions, 1]
  const sizes = []
  for (let i = 0; i < boundaries.length - 1; i++) {
    sizes.push(Math.max(minTrackPx, (boundaries[i + 1] - boundaries[i]) * usablePx))
  }
  return sizes
}

// Same boundary math as linesToTrackSizes, but returns each line (sorted,
// single axis) paired with its actual rendered pixel offset — the middle of
// the gutter it sits in, content-box-relative (caller adds marginPx). Used
// by CustomGridOverlay.jsx so a draggable line's on-screen position exactly
// matches the CSS grid track boundary it represents, rather than drifting
// from a naive `position * usablePx` in the rare case linesToTrackSizes'
// minTrackPx floor actually kicks in.
export function computeLineOffsets(lines, usablePx, gapPx, minTrackPx = MIN_TRACK_PX) {
  const sorted = [...lines].sort((a, b) => a.position - b.position)
  let cumulativeTrackPx = 0
  return sorted.map((line, i) => {
    const prevPosition = i === 0 ? 0 : sorted[i - 1].position
    const trackSize = Math.max(minTrackPx, (line.position - prevPosition) * usablePx)
    cumulativeTrackPx += trackSize
    return { ...line, offsetPx: cumulativeTrackPx + i * gapPx + gapPx / 2 }
  })
}
