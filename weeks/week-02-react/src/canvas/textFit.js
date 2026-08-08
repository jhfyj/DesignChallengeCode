// Text-fit sizing math shared by usePlacementEngine.js (initial typing-driven
// placement) and shuffleEngine.js (full reroll) — both need the same "how
// many rows/columns does this actual text need" answer, not a role's generic
// span pool, so a filled box is sized to what's actually inside it instead of
// a random guess that may clip.
import { pickSpan, scanFirstFit, markOccupied, placeElement } from './placementEngine.js'
import { estimateTextBlockHeight, widestWordWidth } from './textMeasure.js'

// Cushion on top of the measured height — canvas measureText vs. real CSS
// layout metrics can drift meaningfully, especially right after a shuffle
// if a webfont (e.g. Fira Mono) hasn't finished loading yet and the
// measurement silently falls back to a narrower system font. A visibly
// clipped title is worse than a box with a little extra breathing room, so
// this errs generous.
const ROW_FIT_SAFETY_MARGIN = 1.3

export function rowsNeededForText(text, fontFamily, fontWeight, fontSize, colSpan, grid) {
  const boxWidthPx = colSpan * grid.cellWidth + (colSpan - 1) * grid.gapPx
  const requiredHeightPx = estimateTextBlockHeight({ text, fontFamily, fontWeight, fontSize, boxWidthPx }) * ROW_FIT_SAFETY_MARGIN
  const rowStep = grid.cellHeight + grid.gapPx
  return Math.max(1, Math.ceil((requiredHeightPx + grid.gapPx) / rowStep))
}

// A coarse Custom/Swiss grid (as few as 4 rows) plus a big Swiss display size
// (up to 128px) means rowsNeededForText can legitimately compute "this needs
// every row the grid has." Nothing stops that from succeeding — scanFirstFit
// happily hands out the whole grid to the very first thing placed into an
// empty occupancy set — so every field placed after it (subtitle, body, an
// asset) finds zero free cells and falls through to placeElement's forced
// "just put it at (0,0), overlap or not" last resort, which was meant to be
// an exceptionally rare escape hatch, not a routine outcome. Reserving
// headroom (when the grid has enough rows to spare) keeps a single text
// block from claiming most/all of the grid — a Swiss layout is typically
// title + subtitle + body/info + maybe an asset, so this reserves 2 rows
// (not just 1) once the grid is big enough to afford it, leaving room for
// more than one thing to land after whatever just got placed.
export function capRowSpanForHeadroom(rowSpan, grid) {
  if (grid.rows <= 1) return rowSpan
  const reserve = grid.rows >= 5 ? 2 : 1
  return Math.min(rowSpan, Math.max(1, grid.rows - reserve))
}

// Grows colSpan (never past the grid's own width) until the box is wide
// enough for the text's widest single word. A colSpan picked purely from the
// role's span pool (pickSpan) has no idea how wide the actual words are —
// a word never breaks mid-character, so a box narrower than its widest word
// always overflows it.
export function ensureColSpanFitsWidestWord(colSpan, grid, text, fontFamily, fontWeight, fontSize) {
  const wordPx = widestWordWidth(text, fontSize, fontFamily, fontWeight)
  let span = colSpan
  while (span < grid.cols && span * grid.cellWidth + (span - 1) * grid.gapPx < wordPx) {
    span += 1
  }
  return span
}

// Picks a width from the role's normal span pool (that's still where size
// variety comes from) but computes the row span from the field's actual
// text/font instead of the pool's random guess, so the box is tall enough to
// show the full content without clipping whenever the grid has room for it.
// Never grows the grid — shrinks the row span step by step until something
// fits, falling back to the general capped placer (guaranteed to find a spot
// without growing) as an absolute last resort.
export function placeTextFitted(occupancy, grid, role, text, fontFamily, fontWeight, fontSize) {
  const { colSpan: pickedColSpan } = pickSpan(role, grid.cols, grid.rows)
  const colSpan = ensureColSpanFitsWidestWord(pickedColSpan, grid, text, fontFamily, fontWeight, fontSize)
  let rowSpan = capRowSpanForHeadroom(Math.min(rowsNeededForText(text, fontFamily, fontWeight, fontSize, colSpan, grid), grid.rows), grid)

  while (rowSpan >= 1) {
    const spot = scanFirstFit(occupancy, grid, colSpan, rowSpan)
    if (spot) {
      markOccupied(occupancy, spot.row, spot.col, rowSpan, colSpan)
      return { row: spot.row, col: spot.col, colSpan, rowSpan, grid }
    }
    rowSpan -= 1
  }
  return placeElement(occupancy, grid, role, { allowGrow: false })
}
