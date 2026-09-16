import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  PEEK,
  TILE_UNIT,
  assignColors,
  buildMatGeometry,
  cellKey,
  chebyshev,
  computeGrid,
  pickColor,
} from './puzzleEdge'
import { LIFT_MS, RING_MS } from './foamLayout'

const DORMANT_FILL = '#FFFFFF'

function seedGrid(nextGrid) {
  const nextStatus = {}
  const nextColors = {}
  const originKey = cellKey(nextGrid.cols - 1, nextGrid.rows - 1)
  for (let row = 0; row < nextGrid.rows; row += 1) {
    for (let col = 0; col < nextGrid.cols; col += 1) {
      const key = cellKey(col, row)
      if (key === originKey) {
        nextStatus[key] = 'active'
        nextColors[key] = '#E85956'
      } else {
        nextStatus[key] = 'dormant'
        nextColors[key] = DORMANT_FILL
      }
    }
  }
  return { nextStatus, nextColors }
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function useViewport() {
  const [vp, setVp] = useState(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }))

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return vp
}

function clientToCell(svg, clientX, clientY, cols, rows) {
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const loc = pt.matrixTransform(ctm.inverse())
  const col = Math.floor(loc.x / TILE_UNIT)
  const row = Math.floor(loc.y / TILE_UNIT)
  if (col < 0 || row < 0 || col >= cols || row >= rows) return null
  return { col, row }
}

export default function FoamPocket({ phase, onPhaseChange, onLiftPlan, onTypeMask }) {
  const uid = useId().replace(/:/g, '')
  const vp = useViewport()
  const timers = useRef([])
  const grid = useMemo(() => computeGrid(vp.w, vp.h), [vp])
  const [colors, setColors] = useState(
    () => seedGrid(computeGrid(window.innerWidth, window.innerHeight)).nextColors,
  )
  const [status, setStatus] = useState(
    () => seedGrid(computeGrid(window.innerWidth, window.innerHeight)).nextStatus,
  )
  const colorsRef = useRef(colors)
  colorsRef.current = colors
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const rippleKind = useRef('reveal')
  const [peekHot, setPeekHot] = useState(false)
  const [fromPeek, setFromPeek] = useState(false)

  const foamId = `${uid}-foam`
  const sheenId = `${uid}-sheen`

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }, [])

  const later = useCallback((fn, ms) => {
    const id = window.setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }, [])

  const seedVisible = useCallback((nextGrid) => {
    const { nextStatus, nextColors } = seedGrid(nextGrid)
    setStatus(nextStatus)
    setColors(nextColors)
  }, [])

  useEffect(() => {
    if (phase !== 'idle') return
    seedVisible(grid)
  }, [grid, phase, seedVisible])

  useEffect(() => () => clearTimers(), [clearTimers])

  const geometry = useMemo(
    () => buildMatGeometry(grid.cols, grid.rows),
    [grid],
  )

  const settleTiles = useCallback((keys) => {
    setStatus((prev) => {
      const copy = { ...prev }
      keys.forEach((key) => {
        copy[key] = 'active'
      })
      return copy
    })
  }, [])

  const scheduleLift = useCallback(
    (keys, nextColors, delay, { lift = true } = {}) => {
      const reduced = prefersReducedMotion() || !lift
      const settleAt = reduced ? 0 : LIFT_MS

      later(() => {
        setStatus((prev) => {
          const copy = { ...prev }
          keys.forEach((key) => {
            copy[key] = reduced ? 'active' : 'lifting'
          })
          return copy
        })
        setColors((prev) => {
          const copy = { ...prev }
          keys.forEach((key) => {
            if (nextColors[key]) copy[key] = nextColors[key]
          })
          return copy
        })
      }, delay)

      if (!reduced) {
        later(() => settleTiles(keys), delay + settleAt)
      }
    },
    [later, settleTiles],
  )

  const tilePx = grid.tile
  const svgW = grid.cols * tilePx
  const svgH = grid.rows * tilePx
  const cut = tilePx * (1 - PEEK)

  useEffect(() => {
    if (!onTypeMask) return
    if (phase === 'idle') {
      onTypeMask(null)
      return
    }
    const paths = geometry.tiles
      .filter((tile) => (colors[tile.key] ?? tile.color) === DORMANT_FILL)
      .map((tile) => tile.d)
    onTypeMask({
      paths,
      viewBox: `0 0 ${geometry.width} ${geometry.height}`,
      width: svgW,
      height: svgH,
      cut,
    })
  }, [colors, cut, geometry, onTypeMask, phase, svgH, svgW])

  const startRipple = useCallback(() => {
    if (phase === 'rippling') return

    clearTimers()
    rippleKind.current = 'reveal'
    const originKey = cellKey(geometry.originCol, geometry.originRow)
    const nextColors = assignColors(grid.cols, grid.rows, {
      [originKey]: '#E85956',
    })
    settleTiles([originKey])
    onPhaseChange('rippling')

    const rings = new Map()
    geometry.tiles.forEach((tile) => {
      if (tile.key === originKey) return
      const list = rings.get(tile.dist) ?? []
      list.push(tile.key)
      rings.set(tile.dist, list)
    })

    const distances = [...rings.keys()].sort((a, b) => a - b)
    let maxDelay = 0
    distances.forEach((dist) => {
      const delay = dist * RING_MS
      maxDelay = Math.max(maxDelay, delay)
      scheduleLift(rings.get(dist), nextColors, delay)
    })

    onLiftPlan?.(
      geometry.tiles.map((tile) => ({
        key: tile.key,
        col: tile.col,
        row: tile.row,
        delay: tile.key === originKey ? 0 : tile.dist * RING_MS,
      })),
    )

    later(() => onPhaseChange('done'), maxDelay + LIFT_MS + 40)
  }, [
    clearTimers,
    geometry.originCol,
    geometry.originRow,
    geometry.tiles,
    grid.cols,
    grid.rows,
    later,
    onLiftPlan,
    onPhaseChange,
    phase,
    scheduleLift,
    settleTiles,
  ])

  const startColorRipple = useCallback(
    (originCol, originRow) => {
      const current = phaseRef.current
      if (current === 'idle') return
      if (current === 'rippling' && rippleKind.current === 'reveal') return

      clearTimers()
      rippleKind.current = 'recolor'
      onPhaseChange('rippling')

      const originKey = cellKey(originCol, originRow)
      const nextColors = assignColors(grid.cols, grid.rows, {
        [originKey]: pickColor([colorsRef.current[originKey]]),
      })

      settleTiles(geometry.tiles.map((tile) => tile.key))

      const rings = new Map()
      geometry.tiles.forEach((tile) => {
        const dist = chebyshev(tile.col, tile.row, originCol, originRow)
        const list = rings.get(dist) ?? []
        list.push(tile.key)
        rings.set(dist, list)
      })

      const distances = [...rings.keys()].sort((a, b) => a - b)
      let maxDelay = 0
      distances.forEach((dist) => {
        const delay = dist * RING_MS
        maxDelay = Math.max(maxDelay, delay)
        scheduleLift(rings.get(dist), nextColors, delay)
      })

      onLiftPlan?.(
        geometry.tiles.map((tile) => ({
          key: tile.key,
          col: tile.col,
          row: tile.row,
          delay: chebyshev(tile.col, tile.row, originCol, originRow) * RING_MS,
        })),
      )

      later(() => onPhaseChange('done'), maxDelay + LIFT_MS + 40)
    },
    [clearTimers, geometry.tiles, grid.cols, grid.rows, later, onLiftPlan, onPhaseChange, scheduleLift, settleTiles],
  )

  const onFloorClick = useCallback(
    (event) => {
      const cell = clientToCell(
        event.currentTarget,
        event.clientX,
        event.clientY,
        grid.cols,
        grid.rows,
      )
      if (!cell) return
      startColorRipple(cell.col, cell.row)
    },
    [grid.cols, grid.rows, startColorRipple],
  )

  return (
    <div
      className={`foam-stage is-${phase}`}
      style={{ '--tile': `${tilePx}px`, '--peek': PEEK }}
    >
      <svg
        className="foam-pocket"
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        xmlns="http://www.w3.org/2000/svg"
        width={svgW}
        height={svgH}
        preserveAspectRatio="xMaxYMax meet"
        overflow="visible"
        aria-hidden={phase === 'idle'}
        onClick={onFloorClick}
        style={{ right: -cut, bottom: -cut }}
      >
        <defs>
          <linearGradient id={sheenId} x1="0" y1="0" x2="0.15" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
            <stop offset="48%" stopColor="#fff" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.12" />
          </linearGradient>
          <pattern
            id={foamId}
            width="2.2"
            height="2.2"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="0.45" cy="0.5" r="0.28" fill="rgba(0,0,0,0.14)" />
            <circle cx="1.55" cy="0.35" r="0.2" fill="rgba(255,255,255,0.18)" />
            <circle cx="1.15" cy="1.55" r="0.24" fill="rgba(0,0,0,0.1)" />
            <circle cx="0.3" cy="1.7" r="0.16" fill="rgba(255,255,255,0.12)" />
          </pattern>
        </defs>

        {geometry.tiles.map((tile) => {
          const tileStatus = status[tile.key] ?? 'dormant'
          if (phase === 'idle' && tileStatus !== 'active') return null
          const fill = colors[tile.key] ?? tile.color
          const textured = fill !== DORMANT_FILL
          return (
            <g
              key={tile.key}
              className={`foam-tile is-${tileStatus}`}
              style={{ '--tile-fill': fill }}
            >
              {textured && (
                <g className="foam-thickness" aria-hidden="true">
                  <path className="foam-body" d={tile.d} />
                </g>
              )}
              <path className="foam-body" d={tile.d} />
              {textured && (
                <>
                  <path d={tile.d} fill={`url(#${sheenId})`} />
                  <path d={tile.d} fill={`url(#${foamId})`} />
                </>
              )}
            </g>
          )
        })}
      </svg>

      {phase === 'idle' && (
        <button
          type="button"
          className="foam-trigger"
          aria-label="Trigger foam tile ripple"
          onClick={startRipple}
        />
      )}
    </div>
  )
}
