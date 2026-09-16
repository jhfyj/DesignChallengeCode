import { PEEK, TILE_PX, cellKey, computeGrid } from './puzzleEdge'

export const RING_MS = 90
export const LIFT_MS = 720
export const LIFT_COLOR_AT = 220

export function foamScreenMetrics(width, height) {
  const grid = computeGrid(width, height)
  const tile = grid.tile ?? TILE_PX
  const cut = tile * (1 - PEEK)
  const svgW = grid.cols * tile
  const svgH = grid.rows * tile
  return {
    cols: grid.cols,
    rows: grid.rows,
    tile,
    cut,
    svgLeft: width + cut - svgW,
    svgTop: height + cut - svgH,
  }
}

export function pointToCell(x, y, metrics) {
  const col = Math.floor((x - metrics.svgLeft) / metrics.tile)
  const row = Math.floor((y - metrics.svgTop) / metrics.tile)
  if (col < 0 || row < 0 || col >= metrics.cols || row >= metrics.rows) return null
  return { col, row, key: cellKey(col, row) }
}

export function itemToCell(item, metrics) {
  const cx = item.x + item.width / 2
  const cy = item.y + item.glyph / 2
  return pointToCell(cx, cy, metrics)
}
