import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
// Caps stay flat (butt) on every segment — a round cap on the stroke itself
// is what caused the little dots/bumps at the five checkpoint joins, since
// it extends past its own mathematical endpoint by half the stroke width
// and each segment casts its own drop-shadow around that bulge.
//
// The rounded leading edge is therefore a separate circle riding the live
// tip, not a linecap. Briefly it *was* a linecap on the active segment, and
// that is what made checkpoints flash: the round cap overshot the boundary
// by half a stroke width (~5.3deg of arc, against a checkpoint dot only
// ~2deg wide), then retracted the instant the segment flipped to butt on
// becoming done. The incoming segment should have covered that spot, but at
// strokeDashoffset=1 its dash has zero length and browsers don't reliably
// draw round caps on a zero-length dash, so the boundary dropped back to
// gray track for a frame. The checkpoint dot there is mix-blend-mode:
// difference white, which renders white over black and dark over gray, so
// that one-frame gap read as a flash. A tip circle has no such gap: this
// segment's tip finishes at exactly the coordinates where the next
// segment's tip starts, so the handoff is continuous.
//
// The tip moves by animating `transform: translate(...)`, not cx/cy. Safari
// doesn't support cx/cy as animatable CSS properties, so animating those
// silently did nothing on iOS and left the tip frozen at the segment's
// start, making the sweeping edge look flat. A pure translate is
// origin-independent, so it needs no transform-box/transform-origin setup
// and behaves the same in every engine.
function ArcSegment({ startDeg, endDeg, state, durationMs }) {
  const pathRef = useRef(null)
  const tipRef = useRef(null)
  const d = describeSegment(startDeg, endDeg)
  const tipOrigin = polar(startDeg)

  // useLayoutEffect, not useEffect, and that difference is the whole reason
  // the sweep used to stall at every checkpoint. A newly-active segment
  // renders with strokeDashoffset=1, i.e. nothing drawn yet. useEffect runs
  // *after* the browser paints, so the checkpoint frame was painted with the
  // finished segment full and the new one still empty, and only then did the
  // animation start — a guaranteed dead frame at every boundary, and a long
  // one here because that same frame is the most expensive one to paint (two
  // drop-shadowed paths changing, plus the tip cap unmounting and
  // remounting). Reading it back: the line arrives at a
  // checkpoint, hangs, then resumes. useLayoutEffect runs after the DOM
  // update but before paint, so the animation is already running by the time
  // that frame reaches the screen and one segment hands off to the next
  // without a gap.
  useLayoutEffect(() => {
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
        return {
          transform: `translate(${(point.x - tipOrigin.x).toFixed(3)}px, ${(point.y - tipOrigin.y).toFixed(3)}px)`,
        }
      }),
      { duration: durationMs, easing: 'linear', fill: 'forwards' },
    )

    return () => {
      pathAnim.cancel()
      tipAnim?.cancel()
    }
  }, [state, durationMs, startDeg, endDeg, tipOrigin.x, tipOrigin.y])

  return (
    <>
      {/* Pending segments aren't rendered at all rather than drawn and then
          hidden by the dash. Hiding them still left a sub-pixel sliver of
          stroke at each one's end point, which the drop-shadow blurred into
          a visible hairline — and since a segment ends exactly where a
          checkpoint dot sits, that put a little radial tick across every
          dot. Not drawing them also spares four filtered paths per frame. */}
      {state !== 'pending' && (
        <path
          ref={pathRef}
          d={d}
          pathLength="1"
          /* "1 2", not "1". A single value means "1 on, 1 off" — a pattern
             2 long — so hiding the segment with strokeDashoffset=1 maps the
             path onto pattern 1..2, and 2 wraps to 0 where the next "on"
             starts, landing that boundary exactly on the path's end point.
             Rounding there is what produced the sliver above. Making the
             gap 2 pushes the next "on" out to pattern 3, i.e. path position
             2 — well past the end — so no boundary ever falls on the path.
             Every offset in 0..1 still maps to the same drawn fraction, so
             the sweep animation is unchanged. */
          strokeDasharray="1 2"
          strokeDashoffset={state === 'done' ? 0 : 1}
          className="processing-screen__arc"
        />
      )}
      {state === 'active' && (
        <circle
          ref={tipRef}
          cx={tipOrigin.x}
          cy={tipOrigin.y}
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
