const S = 100
const DEPTH = 3.8
const CORNER = 4
const COUNT = 9
const FLARE = 1.05
const NECK_RATIO = 0.4
const RADIUS = 0.35

export const TILE_UNIT = S

export const PALETTE = [
  '#3F8DD0',
  '#60CE88',
  '#D27ACA',
  '#E85956',
  '#ECD037',
  '#FFAB50',
]

export const TILE_PX = 140
export const PEEK = 0.22

export function cellKey(col, row) {
  return `${col}:${row}`
}

export function computeGrid(width, height) {
  const cols = Math.ceil(width / TILE_PX) + 1
  const rows = Math.ceil(height / TILE_PX) + 1
  return { cols, rows, tile: TILE_PX }
}

export function chebyshev(col, row, originCol, originRow) {
  return Math.max(Math.abs(col - originCol), Math.abs(row - originRow))
}

export function pickColor(avoid = []) {
  const blocked = new Set(avoid.filter(Boolean))
  const pool = PALETTE.filter((color) => !blocked.has(color))
  const choices = pool.length ? pool : PALETTE
  return choices[Math.floor(Math.random() * choices.length)]
}

export function assignColors(cols, rows, locked = {}) {
  const assigned = { ...locked }
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let col = cols - 1; col >= 0; col -= 1) {
      if (assigned[cellKey(col, row)]) continue
      const used = new Set()
      for (const [nc, nr] of [
        [col + 1, row],
        [col, row + 1],
        [col - 1, row],
        [col, row - 1],
      ]) {
        const color = assigned[cellKey(nc, nr)]
        if (color) used.add(color)
      }
      const pool = PALETTE.filter((color) => !used.has(color))
      const choices = pool.length ? pool : PALETTE
      assigned[cellKey(col, row)] = choices[Math.floor(Math.random() * choices.length)]
    }
  }
  return assigned
}

function fmt(n) {
  return Number(n.toFixed(3))
}

function samePoint(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.05
}

function cornerArc(p0, p1, p2, radius) {
  const vIn = [p1[0] - p0[0], p1[1] - p0[1]]
  const vOut = [p2[0] - p1[0], p2[1] - p1[1]]
  const dIn = Math.hypot(vIn[0], vIn[1])
  const dOut = Math.hypot(vOut[0], vOut[1])
  if (dIn < 1e-6 || dOut < 1e-6) return { skip: true }
  const nIn = [vIn[0] / dIn, vIn[1] / dIn]
  const nOut = [vOut[0] / dOut, vOut[1] / dOut]
  const cross = nIn[0] * nOut[1] - nIn[1] * nOut[0]
  const dot = Math.max(-1, Math.min(1, nIn[0] * nOut[0] + nIn[1] * nOut[1]))
  const turn = Math.atan2(cross, dot)
  const half = Math.abs(turn) / 2
  if (half < 1e-4) return { skip: true }
  let trim = radius / Math.tan(half)
  let r = radius
  const maxTrim = Math.min(dIn, dOut) * 0.45
  if (trim > maxTrim) {
    trim = maxTrim
    r = trim * Math.tan(half)
  }
  const start = [p1[0] - nIn[0] * trim, p1[1] - nIn[1] * trim]
  const end = [p1[0] + nOut[0] * trim, p1[1] + nOut[1] * trim]
  const rot = cross > 0 ? [-nIn[1], nIn[0]] : [nIn[1], -nIn[0]]
  const center = [start[0] + rot[0] * r, start[1] + rot[1] * r]
  return { start, end, r, center, sweep: cross > 0 ? 1 : 0, skip: false }
}

function sampleArc(arc, steps = 4) {
  const a0 = Math.atan2(arc.start[1] - arc.center[1], arc.start[0] - arc.center[0])
  const a1 = Math.atan2(arc.end[1] - arc.center[1], arc.end[0] - arc.center[0])
  let delta = a1 - a0
  if (arc.sweep === 1) {
    if (delta < 0) delta += Math.PI * 2
  } else if (delta > 0) {
    delta -= Math.PI * 2
  }
  const pts = []
  for (let i = 0; i <= steps; i += 1) {
    const a = a0 + (delta * i) / steps
    pts.push([
      arc.center[0] + arc.r * Math.cos(a),
      arc.center[1] + arc.r * Math.sin(a),
    ])
  }
  return pts
}

function roundOpenPolyline(points, radius) {
  const out = [points[0]]
  for (let i = 1; i < points.length - 1; i += 1) {
    const arc = cornerArc(points[i - 1], points[i], points[i + 1], radius)
    if (arc.skip) {
      const last = out[out.length - 1]
      if (!last || !samePoint(last, points[i])) out.push(points[i])
      continue
    }
    sampleArc(arc).forEach((p) => {
      const last = out[out.length - 1]
      if (!last || !samePoint(last, p)) out.push(p)
    })
  }
  const end = points[points.length - 1]
  const last = out[out.length - 1]
  if (!last || !samePoint(last, end)) out.push(end)
  return out
}

function polygonPath(points) {
  return `M ${points.map((p) => `${fmt(p[0])} ${fmt(p[1])}`).join(' L ')} Z`
}

function knobRanges() {
  const usable = S - 2 * CORNER
  const slot = usable / COUNT
  const neck = slot * NECK_RATIO
  const ranges = []
  for (let i = 0; i < COUNT; i += 1) {
    const center = CORNER + slot * (i + 0.5)
    ranges.push([center - neck / 2, center + neck / 2])
  }
  return ranges
}

const KNOB_RANGES = knobRanges()

function pt(origin, along, out, t, d) {
  return [
    origin[0] + along[0] * t + out[0] * d,
    origin[1] + along[1] * t + out[1] * d,
  ]
}

function uniquePoints(points) {
  const pts = []
  for (const p of points) {
    const last = pts[pts.length - 1]
    if (last && samePoint(last, p)) continue
    pts.push(p)
  }
  return pts
}

function maleSeamLocal() {
  const pts = [[0, 0]]
  for (const [from, to] of KNOB_RANGES) {
    pts.push(
      [from, 0],
      [from - FLARE, DEPTH],
      [to + FLARE, DEPTH],
      [to, 0],
    )
  }
  pts.push([S, 0])
  return roundOpenPolyline(uniquePoints(pts), RADIUS)
}

const MALE_SEAM = maleSeamLocal()

function mapSeam(origin, along, out) {
  return MALE_SEAM.map(([t, d]) => pt(origin, along, out, t, d))
}

function skipFirst(points) {
  return points.slice(1)
}

function verticalSeam(col, row) {
  return mapSeam([(col + 1) * S, row * S], [0, 1], [1, 0])
}

function horizontalSeam(col, row) {
  return mapSeam([col * S, (row + 1) * S], [1, 0], [0, 1])
}

export function buildMatGeometry(cols, rows, colorMap = null) {
  const width = cols * S
  const height = rows * S
  const originCol = cols - 1
  const originRow = rows - 1
  const tiles = []

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = col * S
      const y = row * S
      const top = skipFirst(horizontalSeam(col, row - 1))
      const right = skipFirst(verticalSeam(col, row))
      const bottom = skipFirst([...horizontalSeam(col, row)].reverse())
      const left = skipFirst([...verticalSeam(col - 1, row)].reverse())
      const points = uniquePoints([[x, y], ...top, ...right, ...bottom, ...left])

      tiles.push({
        d: polygonPath(points),
        x,
        y,
        color: colorMap?.[cellKey(col, row)] ?? '#E85956',
        col,
        row,
        dist: chebyshev(col, row, originCol, originRow),
        key: cellKey(col, row),
      })
    }
  }

  return { width, height, tiles, originCol, originRow }
}
