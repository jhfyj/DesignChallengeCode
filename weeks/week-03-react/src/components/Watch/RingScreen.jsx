import { useEffect, useRef, useState } from 'react'
import { RING_RADIUS, RING_SPIN_SPAN_DEG } from './waveMath.js'
import './RingScreen.css'

const CENTER = 150
// Same radius, stroke width, and color as ProcessingScreen's own arc
// (RADIUS/ARC_STROKE in ProcessingScreen.jsx) — the whole point of this
// screen is to be indistinguishable from where the real arc picks up, so
// every one of those values has to match exactly, not just approximate.
const RADIUS = RING_RADIUS
const STROKE_WIDTH = 23.5
const CAP_RADIUS = STROKE_WIDTH / 2
// Same fixed 32px-diameter checkpoint dots as ProcessingScreen's own
// .processing-screen__checkpoint (see CHECKPOINT_RADIUS there).
const CHECKPOINT_RADIUS = 4.5

// How much of the ring the spinner covers while just "please wait"
// spinning. Not a chosen fraction: ListeningScreen's morph lays its wave
// line onto the ring without ever changing the line's length, so the arc it
// hands over is exactly as long as that line — see RING_SPIN_SPAN_DEG in
// waveMath.js, imported rather than duplicated because the two have to
// agree exactly or the shape visibly changes at the crossfade.
const SPIN_SPAN_DEG = RING_SPIN_SPAN_DEG
// Degrees per ms — kept the same speed as the old ring-screen-spin CSS
// animation (a full lap every 1.5s).
const SPIN_LAP_MS = 1500
// Where the morph leaves the arc, in this component's own 12-o'clock-based
// degrees convention (see polar() below). The morph's head starts at the
// circle's own rightmost point (90deg here) and sweeps SPIN_SPAN_DEG around
// from there, so `lead` (its forward/clockwise-most edge) sits a full span
// past 90deg. Starting the spin anywhere else would make the arc visibly
// jump the instant the two screens crossfade.
const SPIN_START_LEAD = 90 + SPIN_SPAN_DEG
// The spin has to run for at least this many full laps before it's allowed
// to land on the top and collapse — without this, a starting lead that's
// already most of the way around (as SPIN_START_LEAD often is) would only
// spin a fraction of one lap before stopping, reading as "barely spun at
// all" instead of an actual loading beat.
const MIN_SPIN_LAPS = 2
// However long it takes to cover MIN_SPIN_LAPS full laps plus whatever's
// left over to land exactly on the next multiple of 360deg (i.e. back at
// the top) — the "plus leftover" part is what keeps this starting from
// SPIN_START_LEAD instead of 0deg without ever landing off-angle.
const SPIN_MS = MIN_SPIN_LAPS * SPIN_LAP_MS + ((360 - (SPIN_START_LEAD % 360)) / 360) * SPIN_LAP_MS

// "The right edge stays put, and the left edge should keep going in until
// they become one black dot" — the leading edge freezes at the top the
// instant the spin completes its lap there; the trailing edge just keeps
// moving forward, same direction and motion it was already spinning in, no
// reversal — closing the gap directly rather than first sweeping backward
// to grow into a full circle. Traveling at the exact same constant angular
// speed as the spin (360deg / SPIN_LAP_MS), not a separately-tuned duration
// with its own easing — the trailing edge shouldn't visibly change pace the
// moment the leading edge stops.
const COLLAPSE_MS = (SPIN_SPAN_DEG / 360) * SPIN_LAP_MS
// The five checkpoint dots appearing one by one before the process starts —
// DOT_SETTLE_MS matches the dot's own pop-in animation duration (see
// ring-screen-dot-in in RingScreen.css) so the last dot fully finishes
// appearing and nothing more, no extra pause tacked on before handing off.
const DOT_STAGGER_MS = 130
const DOT_SETTLE_MS = 240

// Same 0deg-at-12-o'clock, clockwise-positive convention as
// ProcessingScreen.jsx's own polar()/describeSegment() — kept as a local
// copy (like the wing path duplicated in ListeningScreen.jsx) rather than a
// shared import, so this file doesn't reach into ProcessingScreen.jsx while
// another session may be actively editing it.
function polar(deg) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: CENTER + RADIUS * Math.cos(rad), y: CENTER + RADIUS * Math.sin(rad) }
}

// Describes the arc swept clockwise from startDeg to endDeg. Only valid for
// a span strictly greater than 0 — a single arc command can't describe a
// zero-length arc, so the caller swaps to the bare cap dot at that extreme
// instead (see renderArc in the effect below). The span here never
// approaches a full 360 (it only ever shrinks, from SPIN_SPAN_DEG down to
// 0), so there's no full-circle case to special-case.
function describeArc(startDeg, endDeg) {
  const start = polar(startDeg)
  const end = polar(endDeg)
  const span = Math.abs(endDeg - startDeg)
  const largeArc = span > 180 ? 1 : 0
  return `M${start.x.toFixed(2)},${start.y.toFixed(2)} A${RADIUS},${RADIUS} 0 ${largeArc} 1 ${end.x.toFixed(2)},${end.y.toFixed(2)}`
}

// A brief, content-free "please wait" beat between the listening screen's
// wave-to-ring morph and the real, task-labeled progress screen. Plays a
// fixed sequence once `visible` turns true: spin -> collapse to a single
// dot at the top -> the task checkpoints pop in one by one ->
// onSequenceDone, which the parent uses to hand off to ProcessingScreen.
// The spin itself starts from the exact position/span ListeningScreen's own
// morph freezes at (see SPIN_START_LEAD) rather than resetting to some
// other starting point, so the arc doesn't visibly jump or reload the
// instant this screen takes over — it just keeps moving. ProcessingScreen's
// own ring starts from that same fixed top point with those same
// checkpoint positions already in place, so the arc/dot/checkpoints
// themselves don't jump at the hand-off — the one deliberate exception is
// the gray track, which this screen never shows (see the note on
// .ring-screen__svg's children below) and which ProcessingScreen draws from
// its very first frame, so the loading beat reads as "just the bare mark,"
// with the track only appearing once the real process starts.
export default function RingScreen({ visible, taskCount, onSequenceDone }) {
  const [stage, setStage] = useState('spin') // 'spin' | 'collapse' | 'dots'
  const pathRef = useRef(null)
  const capRef = useRef(null)
  const rafRef = useRef(null)
  const timeoutsRef = useRef([])

  useEffect(() => {
    if (!visible) {
      setStage('spin')
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      timeoutsRef.current.forEach(clearTimeout)
      timeoutsRef.current = []
      if (capRef.current) capRef.current.style.opacity = '0'
      return undefined
    }

    // Swaps between two ways of drawing the ring: a partial <path> arc
    // while there's still a real span to sweep, and the fixed cap dot once
    // it's collapsed to nothing (a 0-length arc has no direction to draw a
    // stroke in at all).
    function renderArc(trail, lead) {
      const span = lead - trail
      const pathEl = pathRef.current
      if (!pathEl) return
      if (span <= 0.7) {
        pathEl.style.opacity = '0'
        if (capRef.current) capRef.current.style.opacity = '1'
      } else {
        pathEl.style.opacity = '1'
        pathEl.setAttribute('d', describeArc(trail, lead))
      }
    }

    let cancelled = false

    function runSpin() {
      const start = performance.now()
      function tick(now) {
        if (cancelled) return
        const t = now - start
        const lead = SPIN_START_LEAD + t * (360 / SPIN_LAP_MS)
        renderArc(lead - SPIN_SPAN_DEG, lead)
        if (t < SPIN_MS) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          // By construction (see SPIN_MS above) this always lands on a
          // clean multiple of 360 — passing 360 itself is fine even though
          // the true lead by now is further around (SPIN_START_LEAD plus
          // MIN_SPIN_LAPS full laps), since polar()/describeArc only ever
          // care about the angle modulo 360.
          runCollapse(360)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    // lead is fixed for the rest of the sequence from here — chosen to land
    // exactly on a multiple of 360 (i.e. exactly at the top) by
    // construction, not by observation. trail keeps moving the same
    // direction it was already spinning in (forward/clockwise), closing
    // the gap directly instead of reversing to sweep backward first.
    function runCollapse(lead) {
      setStage('collapse')
      const trailStart = lead - SPIN_SPAN_DEG
      const start = performance.now()
      function tick(now) {
        if (cancelled) return
        const u = Math.min(1, (now - start) / COLLAPSE_MS)
        // Linear, not eased — same constant speed the spin was already
        // moving at, just continuing straight through instead of easing
        // into a different pace.
        const trail = trailStart + (lead - trailStart) * u
        renderArc(trail, lead)
        if (u < 1) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          renderArc(lead, lead)
          runDots()
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    function runDots() {
      setStage('dots')
      const count = Math.max(taskCount, 0)
      const totalMs = count > 0 ? (count - 1) * DOT_STAGGER_MS + DOT_SETTLE_MS : DOT_SETTLE_MS
      const id = setTimeout(() => onSequenceDone?.(), totalMs)
      timeoutsRef.current.push(id)
    }

    runSpin()

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      timeoutsRef.current.forEach(clearTimeout)
      timeoutsRef.current = []
    }
  }, [visible, taskCount, onSequenceDone])

  const top = polar(0)

  return (
    <div className={`ring-screen${visible ? ' ring-screen--visible' : ''}`}>
      {/* Deliberately no gradient-disc backdrop image here (unlike
          ProcessingScreen's own .processing-screen__gradient) — same reason
          as the missing gray track above: this screen's whole background is
          meant to stay plain white through the loading beat, with only the
          bare arc/dot/checkpoints on top, not the dark radial gradient that
          gives the real process ring its shading. */}
      <div className="ring-screen__disc" />
      <svg className="ring-screen__svg" viewBox="0 0 300 300" aria-hidden="true">
        {/* Deliberately no gray track underneath here, unlike
            ProcessingScreen's own .processing-screen__track — the gray
            "still loading" backdrop is meant to read as appearing once the
            real, task-labeled process actually starts, not during this
            screen's own generic "please wait" beat. Just the bare black
            arc/dot/checkpoints float on white for the whole sequence; the
            track appears for the first time on ProcessingScreen's own first
            frame, right at the hand-off. */}
        <path ref={pathRef} className="ring-screen__ring" strokeWidth={STROKE_WIDTH} style={{ opacity: 0 }} />
        {/* The point the whole sequence collapses into, and the exact same
            fixed start-cap position ProcessingScreen's own ring is drawn
            from — see the fixed cap circle in ProcessingScreen.jsx. */}
        <circle
          ref={capRef}
          cx={top.x}
          cy={top.y}
          r={CAP_RADIUS}
          className="ring-screen__cap"
          style={{ opacity: 0 }}
        />
        {stage === 'dots' &&
          taskCount > 0 &&
          Array.from({ length: taskCount }, (_, i) => {
            const boundaryDeg = (360 * (i + 1)) / taskCount
            const point = polar(boundaryDeg)
            return (
              <circle
                key={i}
                cx={point.x}
                cy={point.y}
                r={CHECKPOINT_RADIUS}
                className="ring-screen__checkpoint"
                style={{ animationDelay: `${i * DOT_STAGGER_MS}ms` }}
              />
            )
          })}
      </svg>
    </div>
  )
}
