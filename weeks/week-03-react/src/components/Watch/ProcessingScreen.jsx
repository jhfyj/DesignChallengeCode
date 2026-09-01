import { useEffect, useRef, useState } from 'react'
import { Search, Location, Compare, Filter, CheckmarkOutline } from '@carbon/icons-react'
import gradientDisc from '../../assets/figma/processing/gradient-disc-mono.svg'
import pencilIcon from '../../assets/figma/processing/pencil-icon.svg'
import './ProcessingScreen.css'

// The pencil ("Edit 3") was the only icon in the Figma file — it's kept as
// the fallback, but each task now gets an icon matching what it's actually
// doing instead of showing a pencil for every step.
const TASK_ICONS = {
  Researching: Search,
  Locating: Location,
  Comparing: Compare,
  Filtering: Filter,
  Confirming: CheckmarkOutline,
}

const CENTER = 150
const RADIUS = 128
// Fills the full 84px band from the Figma frame (radius 501 down to 417,
// i.e. between the outer white margin and the inner glass disc) edge to
// edge — 84 Figma px / 3.5733 (viewBox-unit-to-Figma-px ratio, see
// ProcessingScreen.css) — rather than a thin line with visible padding on
// both sides.
const ARC_STROKE = 23.5
const CAP_RADIUS = ARC_STROKE / 2
// Figma's checkpoint circles are a fixed 32px diameter (16px radius)
// regardless of the (much thicker) band width, so this isn't derived from
// ARC_STROKE: 16 Figma px / 3.5733.
const CHECKPOINT_RADIUS = 4.5

// Same 0deg-at-12-o'clock, clockwise-positive convention as WatchFace.jsx.
function polar(deg, center = CENTER) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: center + RADIUS * Math.cos(rad), y: center + RADIUS * Math.sin(rad) }
}

// One fixed arc per checkpoint, not one circle that resets every task —
// this is what makes the whole thing read as a single continuous sweep
// around the full ring instead of restarting from empty at each label
// change. Each segment's start/end angle never changes once computed; only
// its own reveal animates.
function describeSegment(startDeg, endDeg) {
  const start = polar(startDeg)
  const end = polar(endDeg)
  const span = Math.abs(endDeg - startDeg)
  const largeArc = span > 180 ? 1 : 0
  return `M${start.x.toFixed(2)},${start.y.toFixed(2)} A${RADIUS},${RADIUS} 0 ${largeArc} 1 ${end.x.toFixed(2)},${end.y.toFixed(2)}`
}

// "done" segments are held at a plain static attribute, not by however far
// their own animation happened to get — cancelling a Web Animation reverts
// it to whatever the underlying attribute says regardless of playState, so
// relying on the animation's own clock to have reached 'finished' by the
// moment `active` goes false is a race: this component's task-duration
// timer and the browser's animation clock are independent, and the
// animation losing that race even by a few ms means .cancel() undoes the
// held fill and the segment snaps back to hidden. React sets the "0"
// attribute itself the instant `state` becomes 'done' (before the effect
// cleanup even runs), so the animation is only ever responsible for the
// live sweep while a segment is actually the active one.
//
// Caps stay flat (butt) at every internal checkpoint join — a round cap on
// all five segments is what caused the little dots/bumps fixed earlier.
// Only the segment currently sweeping gets round caps, which is what puts a
// rounded tip on the live leading edge; its round *start* cap extends back
// over the previous segment, which is already drawn solid black there, so
// it lands black-on-black and never reads as a bump. Once a segment is
// done it goes back to butt, so the join it now forms with the next one
// stays flush.
//
// This used to be a separate <circle> tip whose cx/cy were animated via the
// Web Animations API. Safari doesn't support cx/cy as animatable CSS
// properties, so on iOS that animation silently did nothing and the tip sat
// frozen at the segment's start — leaving the sweeping edge looking flat.
// Letting the stroke's own linecap do the work needs no scripting at all
// and renders the same everywhere.
function ArcSegment({ startDeg, endDeg, state, durationMs }) {
  const pathRef = useRef(null)
  const d = describeSegment(startDeg, endDeg)

  useEffect(() => {
    if (state !== 'active') return
    const pathEl = pathRef.current
    if (!pathEl) return
    const pathAnim = pathEl.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: durationMs,
      easing: 'linear',
      fill: 'forwards',
    })
    return () => pathAnim.cancel()
  }, [state, durationMs])

  return (
    <path
      ref={pathRef}
      d={d}
      pathLength="1"
      strokeDasharray="1"
      strokeDashoffset={state === 'done' ? 0 : 1}
      className={`processing-screen__arc${state === 'active' ? ' processing-screen__arc--active' : ''}`}
    />
  )
}

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const ICON_LABEL_FADE_MS = 220

export default function ProcessingScreen({ visible, tasks, checkpointIndex, cycleId, elapsedSeconds }) {
  const activeTask = checkpointIndex >= 0 ? tasks[checkpointIndex] : tasks[0]

  // The icon + label fade out, swap, then fade back in on their own instead
  // of snapping straight to the next task — `displayedTask` intentionally
  // lags one step behind `activeTask` for the length of the fade-out half.
  const [displayedTask, setDisplayedTask] = useState(activeTask)
  const [fading, setFading] = useState(false)
  useEffect(() => {
    if (activeTask.label === displayedTask.label) return undefined
    setFading(true)
    const id = setTimeout(() => {
      setDisplayedTask(activeTask)
      setFading(false)
    }, ICON_LABEL_FADE_MS)
    return () => clearTimeout(id)
  }, [activeTask, displayedTask])

  const Icon = TASK_ICONS[displayedTask.label]
  const fadeClass = fading ? ' processing-screen__fade--out' : ''

  return (
    <div className={`processing-screen${visible ? ' processing-screen--visible' : ''}`}>
      <img className="processing-screen__gradient" src={gradientDisc} alt="" />
      <div className="processing-screen__disc" />

      {/* Real progress indicator — one continuous ring split into as many
          even segments as there are tasks. Each stops fully drawn at its
          checkpoint and stays there while the next segment takes its turn,
          at whatever speed that task takes (blockers run slower). Keyed on
          cycleId so a fresh request starts the whole ring empty again
          instead of still showing the previous cycle's arc complete. */}
      <svg key={cycleId} className="processing-screen__arc-svg" viewBox="0 0 300 300" aria-hidden="true">
        {/* Flat light-gray track for the full ring, sitting under the black
            sweep — this is what "pending" looks like now instead of letting
            the (grayscale) gradient disc peek through. */}
        <circle cx={CENTER} cy={CENTER} r={RADIUS} className="processing-screen__track" />

        {/* The neumorphic groove that used to sit here (two blurred strokes
            hugging the track's inner and outer edges, making the gray band
            read as recessed) is gone — it never rendered on mobile, so the
            recessed look it was carrying only ever existed on desktop. The
            track is a flat gray band on every platform now. */}

        {/* The one edge that's never anyone's internal join — the true
            start of the whole ring, fixed at the top. Rendered once here
            rather than per-segment. */}
        <circle
          cx={polar(0).x}
          cy={polar(0).y}
          r={CAP_RADIUS}
          className="processing-screen__arc-cap"
        />
        {tasks.map((task, i) => {
          const startDeg = (360 * i) / tasks.length
          const endDeg = (360 * (i + 1)) / tasks.length
          const state = checkpointIndex > i ? 'done' : checkpointIndex === i ? 'active' : 'pending'
          return (
            <ArcSegment
              key={task.label}
              startDeg={startDeg}
              endDeg={endDeg}
              state={state}
              durationMs={task.durationMs}
            />
          )
        })}

        {/* One checkpoint per task, evenly spaced around the ring at the
            END of each task's own segment — i.e. exactly where the next
            task's label takes over — rather than at the segment's midpoint.
            That's what keeps a checkpoint's color flip in sync with the
            label change instead of firing partway through a still-active
            task. Plain white circles blended with `mix-blend-mode:
            difference` against whatever's directly beneath them (gray
            track or black sweep) — that's what makes each dot invert the
            instant the black line's live sweep crosses it, with no extra
            state to track here. */}
        {tasks.map((task, i) => {
          const boundaryDeg = (360 * (i + 1)) / tasks.length
          const point = polar(boundaryDeg)
          return (
            <circle
              key={`checkpoint-${task.label}`}
              cx={point.x}
              cy={point.y}
              r={CHECKPOINT_RADIUS}
              className="processing-screen__checkpoint"
            />
          )
        })}
      </svg>

      <div className="processing-screen__content">
        {Icon ? (
          <Icon size={32} className={`processing-screen__icon processing-screen__icon--carbon${fadeClass}`} />
        ) : (
          <img className={`processing-screen__icon${fadeClass}`} src={pencilIcon} alt="" />
        )}
        <div className="processing-screen__text">
          <p className={`processing-screen__label${fadeClass}`}>{displayedTask.label}</p>
          <p className="processing-screen__timer">{formatTimer(elapsedSeconds)}</p>
        </div>
      </div>
    </div>
  )
}
