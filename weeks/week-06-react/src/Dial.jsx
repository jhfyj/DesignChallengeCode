import { useRef } from 'react'
import { localHour } from './dotfield.js'
import { HOME, time, useNow } from './time.js'

// The time control: a rim that turns under a fixed marker, like a dive
// watch's bezel, rather than a clock hand. One full turn is a day in New
// York; the tick under the marker is the time. Turning the rim clockwise
// runs time forward, which is why the ticks are laid out anticlockwise.

const SIZE = 220
const C = SIZE / 2
const R = 92 // the rim's outer edge
const INNER = 70 // the plain circle inside it
const STEP = 0.25 // keyboard step, in hours

const point = (deg, r) => {
  const a = (deg * Math.PI) / 180
  return [C + Math.sin(a) * r, C - Math.cos(a) * r]
}

// The pointer's angle around the centre, clockwise from the top, in degrees.
const angleOf = (e, el) => {
  const r = el.getBoundingClientRect()
  const dx = e.clientX - (r.left + r.width / 2)
  const dy = e.clientY - (r.top + r.height / 2)
  return (Math.atan2(dx, -dy) * 180) / Math.PI
}

const fmt = (d) =>
  d.toLocaleTimeString('en-GB', { timeZone: HOME, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })

// New York's time, as the rim has it -- for the bar along the top on a
// phone, where the rim is docked and has no room for it.
export function HomeTime() {
  const now = useNow()
  return (
    <header className="topbar">
      <span className="place">New York, USA</span>
      <time className="time">{fmt(now)}</time>
    </header>
  )
}

// Ticks are fixed in the rim; the rim itself rotates.
const TICKS = Array.from({ length: 48 }, (_, k) => {
  const h = k / 2
  const kind = h % 6 === 0 ? 'tick is-major' : Number.isInteger(h) ? 'tick' : 'tick is-minor'
  const len = h % 6 === 0 ? 10 : Number.isInteger(h) ? 6 : 3
  const [x1, y1] = point(-h * 15, R - 2)
  const [x2, y2] = point(-h * 15, R - 2 - len)
  return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} className={kind} />
})

export default function Dial() {
  const now = useNow()
  const svgRef = useRef(null)
  const drag = useRef(null) // { last angle, hour so far }
  const hour = localHour(HOME, now)
  const live = time.isLive()

  // Only the rim turns: a press on the plain middle does nothing.
  const onDown = (e) => {
    if (!e.target.classList.contains('grip')) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Not a real pointer (a synthetic event); the drag still works.
    }
    drag.current = { angle: angleOf(e, svgRef.current), hour }
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d) return
    const a = angleOf(e, svgRef.current)
    // Unwrap across the top so a turn past 180 degrees keeps going.
    let delta = a - d.angle
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    d.angle = a
    d.hour += delta / 15
    time.setLocalHour(((d.hour % 24) + 24) % 24)
  }
  const onUp = () => {
    drag.current = null
  }

  const onKey = (e) => {
    const step = { ArrowRight: STEP, ArrowUp: STEP, ArrowLeft: -STEP, ArrowDown: -STEP, PageUp: 1, PageDown: -1 }[e.key]
    if (step !== undefined) {
      e.preventDefault()
      time.setLocalHour((hour + step + 24) % 24)
    } else if (e.key === 'Home' || e.key === 'Escape') {
      e.preventDefault()
      time.backToNow()
    }
  }

  return (
    <div className="dial">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="dial-face"
        role="slider"
        tabIndex={0}
        aria-label="Time of day for every city: turn the rim"
        aria-valuemin={0}
        aria-valuemax={24}
        aria-valuenow={Math.round(hour * 100) / 100}
        aria-valuetext={fmt(now)}
        onKeyDown={onKey}
        onDoubleClick={() => time.backToNow()}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <path d={`M ${C - 6} 2 L ${C + 6} 2 L ${C} 11 Z`} className="marker" />
        <g transform={`rotate(${hour * 15} ${C} ${C})`}>
          <circle cx={C} cy={C} r={R} className="rim" />
          {TICKS}
        </g>
        <circle cx={C} cy={C} r={INNER} className="inner" />
        {/* The grip: the band between the inner circle and the rim's edge. */}
        <circle
          cx={C}
          cy={C}
          r={(R + INNER) / 2 + 2}
          className="grip"
          strokeWidth={R - INNER + 12}
        />
      </svg>
      {/* On a phone the caption's button moves into the middle of the rim,
          a target of its own clear of the band you turn. */}
      <button
        type="button"
        className={live ? 'dial-centre is-live' : 'dial-centre'}
        onClick={() => time.backToNow()}
        aria-disabled={live}
        tabIndex={live ? -1 : 0}
      >
        <span>back to now</span>
      </button>
      <div className="dial-caption">
        <span className="place">New York, USA</span>
        <time className="time">{fmt(now)}</time>
        <button
          type="button"
          className={live ? 'now is-hidden' : 'now'}
          onClick={() => time.backToNow()}
          tabIndex={live ? -1 : 0}
        >
          back to now
        </button>
      </div>
    </div>
  )
}
