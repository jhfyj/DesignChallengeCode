import { useEffect, useMemo, useRef, useState } from 'react'
import { MASK, MASK_H, MASK_W } from './worldmask.js'

// The world as a dot grid, with a green dot for every place on the wall.
// The dots match the cards': same spacing, same size, so the map reads as
// one more card. Clicking a green dot takes you to its card.
//
// The grid is as coarse as it can be while still giving every place a dot of
// its own. When the places are close together (two cities a
// couple of degrees apart) that takes more dots than the box can show at
// card size, and the map becomes a canvas you drag around instead.

const NORTH = 84 // the map runs from here...
const SOUTH = -58 // ...to here, leaving Antarctica out
const SPAN = NORTH - SOUTH
const MAX_COLS = 360 // one dot per degree; finer than the land data

const bits = Uint8Array.from(atob(MASK), (ch) => ch.charCodeAt(0))
const landAt = (lat, lng) => {
  const r = Math.min(MASK_H - 1, Math.max(0, Math.floor(90 - lat)))
  const c = ((Math.floor(lng + 180) % MASK_W) + MASK_W) % MASK_W
  const i = r * MASK_W + c
  return (bits[i >> 3] >> (i & 7)) & 1
}

// The dot spacing of the cards on the wall, so the map matches them.
function cardPitch() {
  const dots = document.querySelector('.dots')
  const w = dots ? dots.getBoundingClientRect().width : 0
  return w > 0 ? w / 26 : 7.7
}

// A grid of `cols` dots across: its rows, and whether a dot is land -- if
// enough of its patch of the world is, sampled 3 x 3.
function grid(cols) {
  const rows = Math.round((cols * SPAN) / 360)
  const degX = 360 / cols
  const degY = SPAN / rows
  const isLand = (r, c) => {
    let hits = 0
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        hits += landAt(NORTH - (r + (a + 0.5) / 3) * degY, -180 + (c + (b + 0.5) / 3) * degX)
      }
    }
    return hits >= 3
  }
  const cellOf = (lat, lng) => [
    Math.min(rows - 1, Math.max(0, Math.floor((NORTH - lat) / degY))),
    Math.min(cols - 1, Math.max(0, Math.floor((lng + 180) / degX))),
  ]
  return { cols, rows, isLand, cellOf }
}

// Each place on the nearest land dot nobody else has, if there's one within
// a couple of dots; otherwise just where it falls.
function placePins(g, places) {
  const taken = new Map()
  const pins = []
  for (const p of places) {
    const [r0, c0] = g.cellOf(p.lat, p.lng)
    let best = null
    for (let d = 0; d <= 2 && !best; d++) {
      for (let dr = -d; dr <= d && !best; dr++) {
        for (let dc = -d; dc <= d; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== d) continue
          const r = r0 + dr, c = c0 + dc
          if (r < 0 || r >= g.rows || c < 0 || c >= g.cols || taken.has(`${r},${c}`)) continue
          if (g.isLand(r, c)) {
            best = [r, c]
            break
          }
        }
      }
    }
    const [r, c] = best ?? [r0, c0]
    const k = `${r},${c}`
    if (!taken.has(k)) {
      const pin = { r, c, places: [] }
      taken.set(k, pin)
      pins.push(pin)
    }
    taken.get(k).places.push(p)
  }
  return pins
}

const apart = (pins, gap) =>
  pins.every((a, i) => pins.every((b, j) => j <= i || Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c)) > gap))

// The coarsest grid, from `fit` dots across, where every place has its own
// dot -- with a dot of space between them if that's possible at all.
function chooseGrid(fit, places) {
  let distinct = null
  for (let cols = fit; cols <= MAX_COLS; cols++) {
    const g = grid(cols)
    const pins = placePins(g, places)
    if (pins.length < places.length) continue
    if (apart(pins, 1)) return { g, pins }
    distinct ??= { g, pins }
  }
  if (distinct) return distinct
  const g = grid(MAX_COLS)
  return { g, pins: placePins(g, places) }
}

export default function WorldMap({ places, onPick, fill = false, flare = null }) {
  const boxRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0, pitch: 7.7 })
  const [hover, setHover] = useState(null) // { name, x, y }
  const [pan, setPan] = useState(null) // top-left of the view, in map pixels
  const drag = useRef(null)

  useEffect(() => {
    const box = boxRef.current
    const measure = () => setSize({ width: box.clientWidth, height: box.clientHeight, pitch: cardPitch() })
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    // The cards may lay out after the map does.
    const right = document.querySelector('.right')
    if (right) ro.observe(right)
    measure()
    return () => ro.disconnect()
  }, [])

  const { width, height, pitch } = size
  const fit = Math.max(12, Math.floor(width / pitch))
  // Filling a box of set height: as many rows as fit in it.
  const fitRows = fill && height > 0 ? Math.max(6, Math.floor(height / pitch)) : null
  const { g, pins } = useMemo(() => chooseGrid(fit, places), [fit, places])
  const { cols, rows } = g

  // The box shows what fits at card size; the rest is panned to.
  const viewW = Math.min(cols, fit) * pitch
  const fullW = cols * pitch
  const fullH = rows * pitch
  const pannable = cols > fit || (fitRows !== null && rows > fitRows)
  // A whole world is wide and short; a window onto part of it can be taller.
  const viewH = Math.min(rows, fitRows ?? Math.round(fit * (cols > fit ? 0.6 : SPAN / 360))) * pitch

  const clamp = (p) => ({
    x: Math.min(Math.max(0, fullW - viewW), Math.max(0, p.x)),
    y: Math.min(Math.max(0, fullH - viewH), Math.max(0, p.y)),
  })
  // Until it's dragged, the view sits where it shows the most places, centred
  // on them.
  const centred = () => {
    if (!pins.length) return clamp({ x: (fullW - viewW) / 2, y: (fullH - viewH) / 2 })
    const pts = pins.map((p) => ({ x: (p.c + 0.5) * pitch, y: (p.r + 0.5) * pitch }))
    let best = null
    for (const a of pts) {
      const v = clamp({ x: a.x - viewW / 2, y: a.y - viewH / 2 })
      const inView = pts.filter((p) => p.x > v.x + pitch && p.x < v.x + viewW - pitch && p.y > v.y && p.y < v.y + viewH)
      if (!best || inView.length > best.length) best = inView
    }
    const mid = (v) => (Math.min(...v) + Math.max(...v)) / 2
    return clamp({ x: mid(best.map((p) => p.x)) - viewW / 2, y: mid(best.map((p) => p.y)) - viewH / 2 })
  }
  const view = pannable ? clamp(pan ?? centred()) : { x: 0, y: 0 }

  const onDown = (e) => {
    if (!pannable) return
    drag.current = { x: e.clientX, y: e.clientY, from: view, moved: false, id: e.pointerId }
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < 4) return // a click, so far
    if (!d.moved) {
      d.moved = true
      setHover(null)
      try {
        e.currentTarget.setPointerCapture(d.id)
      } catch {
        // A synthetic pointer can't be captured; dragging still works.
      }
    }
    setPan(clamp({ x: d.from.x - dx, y: d.from.y - dy }))
  }
  const onUp = () => {
    // Keep `moved` for the click that follows a drag, then let it go.
    setTimeout(() => {
      drag.current = null
    })
  }
  const dragged = () => drag.current?.moved

  // Only the dots in view are drawn.
  const c0 = Math.max(0, Math.floor(view.x / pitch) - 1)
  const c1 = Math.min(cols, Math.ceil((view.x + viewW) / pitch) + 1)
  const r0 = Math.max(0, Math.floor(view.y / pitch) - 1)
  const r1 = Math.min(rows, Math.ceil((view.y + viewH) / pitch) + 1)
  const pinned = new Set(pins.map((p) => `${p.r},${p.c}`))
  const land = []
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) if (!pinned.has(`${r},${c}`) && g.isLand(r, c)) land.push([r, c])
  }

  const at = (v) => (v + 0.5) * pitch
  const rad = pitch * 0.32

  return (
    <div className="map" ref={boxRef}>
      {width > 0 && (
        <div className={pannable ? 'map-inner is-pannable' : 'map-inner'} style={{ width: viewW, height: viewH }}>
          <svg
            className="map-dots"
            width={viewW}
            height={viewH}
            viewBox={`${view.x} ${view.y} ${viewW} ${viewH}`}
            role="group"
            aria-label={pannable ? 'Places on the world map; drag to look around' : 'Places on the world map'}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            {land.map(([r, c]) => (
              <circle key={`${r},${c}`} cx={at(c)} cy={at(r)} r={rad} className="land" />
            ))}
            {pins.map(({ r, c, places: here }) => {
              const name = here.map((p) => p.name).join(' · ')
              const show = () => !drag.current?.moved && setHover({ name, x: at(c) - view.x, y: at(r) - view.y })
              const go = () => !dragged() && onPick(here[0].key)
              // Re-keyed to replay the flare each time its card is jumped to.
              const flared = flare && here.some((p) => p.key === flare.key)
              return (
                <g
                  key={flared ? `${r},${c},${flare.n}` : `${r},${c}`}
                  className={flared ? 'pin is-flare' : 'pin'}
                  role="button"
                  tabIndex={0}
                  aria-label={`Go to ${name}`}
                  onClick={go}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onPick(here[0].key)
                    }
                  }}
                  onPointerEnter={show}
                  onPointerLeave={() => setHover(null)}
                  onFocus={(e) => {
                    // Bring a dot reached by keyboard into view.
                    if (pannable && e.currentTarget.matches(':focus-visible')) {
                      setPan(clamp({ x: at(c) - viewW / 2, y: at(r) - viewH / 2 }))
                    }
                    show()
                  }}
                  onBlur={() => setHover(null)}
                >
                  <circle cx={at(c)} cy={at(r)} r={pitch * 0.9} className="pin-hit" />
                  <circle cx={at(c)} cy={at(r)} r={pitch * 0.4} className="pin-dot" />
                </g>
              )
            })}
          </svg>
          {hover && (
            <span className="map-tip" style={{ left: hover.x, top: hover.y - pitch }}>
              {hover.name}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
