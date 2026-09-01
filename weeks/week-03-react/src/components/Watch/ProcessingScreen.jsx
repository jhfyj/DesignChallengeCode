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
// How many points along a segment's own arc to animate the leading-tip cap
// through — enough for the round dot to visibly follow the curve rather
// than cutting corners across it.
const TIP_KEYFRAMES = 16

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
// The only two places a round cap actually belongs are the true start of
// the whole ring (rendered once by the parent, not per-segment) and the
// live leading edge of whichever segment is currently sweeping — that tip
// is animated here as its own circle, in lockstep with the stroke reveal,
// tracing the same arc rather than cutting a straight line across it.
function ArcSegment({ startDeg, endDeg, state, durationMs }) {
  const pathRef = useRef(null)
  const tipRef = useRef(null)
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

    const tipEl = tipRef.current
    const tipAnim = tipEl?.animate(
      Array.from({ length: TIP_KEYFRAMES + 1 }, (_, i) => {
        const t = i / TIP_KEYFRAMES
        const point = polar(startDeg + (endDeg - startDeg) * t)
        return { cx: point.x, cy: point.y }
      }),
      { duration: durationMs, easing: 'linear', fill: 'forwards' },
    )

    return () => {
      pathAnim.cancel()
      tipAnim?.cancel()
    }
  }, [state, durationMs, startDeg, endDeg])

  return (
    <>
      <path
        ref={pathRef}
        d={d}
        pathLength="1"
        strokeDasharray="1"
        strokeDashoffset={state === 'done' ? 0 : 1}
        className="processing-screen__arc"
      />
      {state === 'active' && (
        <circle
          ref={tipRef}
          cx={polar(startDeg).x}
          cy={polar(startDeg).y}
          r={CAP_RADIUS}
          className="processing-screen__arc-cap"
        />
      )}
    </>
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

        {/* Neumorphic groove: a soft dark blur blended in from each edge of
            the track (where it meets the outer white margin, and where it
            meets the inner glass disc) so the gray band reads as recessed
            rather than flat. Drawn on top of the flat track but under the
            black sweep, so wherever the sweep has already covered that
            stretch of the ring, it paints right over these and the groove
            simply isn't there anymore — same as the track itself. */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS + ARC_STROKE / 2 - 3}
          className="processing-screen__track-shadow"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS - ARC_STROKE / 2 + 3}
          className="processing-screen__track-shadow"
        />

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
