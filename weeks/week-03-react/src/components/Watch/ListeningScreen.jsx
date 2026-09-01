import { useEffect, useRef, useState } from 'react'
import { MicrophoneFilled, PauseFilled } from '@carbon/icons-react'
import useMicAnalyser from '../../hooks/useMicAnalyser.js'
import { MIN_COHERENT_HOLD_MS } from '../../hooks/useAssistantFlow.js'
import DigitalClockFace from './DigitalClockFace.jsx'
import { gaussian, smoothPath, buildMorphTrack, LINE_LENGTH, LINE_MARGIN } from './waveMath.js'
import { MIC_WING_D, MIC_WING_TRANSFORM, RIM_CENTER, RIM_RADIUS } from './rimShape.js'
import micWing from '../../assets/figma/listening/mic-wing-solid.svg'
import './ListeningScreen.css'

const SIZE = 300
const SAMPLE_COUNT = Math.floor(SIZE / 6) + 1

// How long the wave-to-ring morph takes once the mic is clicked to stop —
// only played when the hold was long enough to actually count as a real
// request (see MIN_COHERENT_HOLD_MS), since there's no point dissolving
// into a loading ring right before landing on "didn't catch that."
const MORPH_MS = 650

// Same ARC_STROKE as ProcessingScreen.jsx, and the same black — the morph's
// whole job is to end up looking exactly like where RingScreen's (and
// eventually ProcessingScreen's) ring picks up, not an approximation of it.
// (RING_RADIUS and the arc's own span live in waveMath.js, since RingScreen
// has to agree with them exactly too.)
const RING_STROKE_WIDTH = 23.5

// How many points the morph samples the line at — independent of
// SAMPLE_COUNT (the live waveform's own resolution), just enough for a
// smooth curve.
const MORPH_POINT_COUNT = 32

// The route the line's right end travels, and how far it goes. Built once:
// it's fixed geometry, not per-morph state.
const MORPH_TRACK = buildMorphTrack()

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

// The line at a given point in the morph, as MORPH_POINT_COUNT points from
// the tail (left end) to the head (right end).
//
// The line is treated as a fixed-length rope threaded onto MORPH_TRACK (see
// waveMath.js): the head sits `headDistance` along the track, and every
// other point sits at its own fixed distance behind it — so the body goes
// exactly where the head has already been, nothing is ever interpolated
// toward a target position, and the length is constant by construction
// rather than corrected after the fact. Track distances below 0 are still
// the original flat line, which is what keeps the part the head hasn't
// pulled around yet perfectly straight instead of bending early.
function buildMorphPoints(headDistance) {
  const points = []
  for (let i = MORPH_POINT_COUNT - 1; i >= 0; i--) {
    const behind = (i / (MORPH_POINT_COUNT - 1)) * LINE_LENGTH
    points.push(MORPH_TRACK.pointAt(headDistance - behind))
  }
  return points
}

// The wing path and its on-screen transform come from rimShape.js, which
// owns this rim and both of its states — this screen's single protrusion
// and DirectionCard's two — so the morph between them on decline has one
// definition to work from rather than each screen's own copy. Cutting that
// same path out of the dial (rather than laying the wing image over a
// plain circle) is what keeps the dial's edge and the wing's curve one
// boundary instead of two shapes crossing at an angle.
const WING_PATH_D = MIC_WING_D
const WING_TRANSFORM = MIC_WING_TRANSFORM
const WING_BOX = { left: 12.8 * 10.72, top: 75.18 * 10.72, width: 74.41 * 10.72, height: 26.08 * 10.72 }

// Bottom-center of the wing's own box, in the same 1072-unit space — the
// mask's cutout is wrapped in a <g> that plays the exact same boot
// animation as .listening-screen__mic-boot (same keyframes, same timing),
// anchored here so the hole grows in lockstep with the visible wing image
// instead of appearing as a full-size cutout from frame one. Without this,
// the mask exposes the entire final wing shape immediately — since that
// exposed area and the wing image are both white, the growing image reads
// as already fully grown from the very first frame.
const WING_ORIGIN = `${(WING_BOX.left + WING_BOX.width / 2).toFixed(3)}px ${(WING_BOX.top + WING_BOX.height).toFixed(3)}px`

// The dial (.listening-screen__glow-box) itself: 35px inset from the
// 1072px Figma frame, i.e. a circle centered on the frame's own center —
// the same rim rimShape.js traces the protrusions against.
const DIAL_CENTER = RIM_CENTER
const DIAL_RADIUS = RIM_RADIUS

// Waveform bumps for the canned fallback shapes only (played when the mic
// is unavailable or permission is denied) — the live renderer traces the
// mic's actual waveform instead, see buildWaveformPoints below.
const LINE_BUMPS = [
  { center: 150, height: 46, width: 16 },
  { center: 106, height: 27, width: 12 },
  { center: 194, height: 27, width: 12 },
  { center: 64, height: 13, width: 10 },
  { center: 236, height: 13, width: 10 },
]

// x runs the same padded range the morph's own flat line sits at (see
// LINE_MARGIN in waveMath.js) — not the full 0..SIZE viewBox width — so the
// idle/live line already has the same edge margin the morph hands off from,
// and clicking stop mid-line doesn't jump the line outward before it starts
// sweeping.
function buildPhasePoints(scale, phaseSign) {
  const points = []
  for (let x = LINE_MARGIN; x <= SIZE - LINE_MARGIN; x += 6) {
    let y = 150
    if (phaseSign !== 0) {
      LINE_BUMPS.forEach((bump, i) => {
        const sign = i % 2 === 0 ? phaseSign : -phaseSign
        y += sign * gaussian(x, bump.center, bump.height * scale, bump.width)
      })
    }
    points.push([x, y])
  }
  return points
}

// A light moving average — used to make lines B/C read as softer, wider
// echoes of line A's real shape rather than independent noise, same
// layered look the three lines always had.
function smoothSamples(raw, windowSize) {
  if (windowSize <= 1) return raw
  const half = Math.floor(windowSize / 2)
  return raw.map((_, i) => {
    let sum = 0
    let count = 0
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < raw.length) {
        sum += raw[j]
        count += 1
      }
    }
    return sum / count
  })
}

const WAVE_AMPLITUDE = 130 // px — bumped up (was 62, then 90) so movement actually reads as movement

// How much each new raw sample nudges the displayed (eased) value per
// frame — low means slow, calm motion; 1 would be no easing at all (raw
// jitter, frame to frame). Tuned down from an unsmoothed raw trace, which
// changed direction too rapidly to read as calm.
const TEMPORAL_SMOOTHING = 0.08

// raw: pointCount samples in -1..1 straight off the mic's live time-domain
// buffer (see useMicAnalyser's sampleWaveform) — the actual waveform, so it
// already swings both above and below 0 on its own; volume is how far it
// swings, pitch is how fast it swings back and forth. No synthetic
// up/down heuristic needed, unlike deriving direction from (non-negative)
// frequency-magnitude data.
//
// Normal speaking volume only occupies a small slice of that -1..1 range
// (roughly ±0.05 to ±0.2, not anywhere near ±1) — a flat multiplier alone
// only makes loud peaks bigger, quiet/normal speech stays basically
// invisible. sqrt(|s|) lifts small values much more than large ones
// (0.05 -> 0.22, a ~4x boost; 1.0 -> 1.0, no boost at full scale), so
// ordinary talking volume actually shows up as real motion instead of a
// near-flat line.
function buildWaveformPoints(raw, ampScale, smoothWindow) {
  const smoothed = smoothSamples(raw, smoothWindow)
  // Same padded range as buildPhasePoints above, for the same reason.
  const step = (SIZE - 2 * LINE_MARGIN) / (smoothed.length - 1)
  return smoothed.map((s, i) => {
    const boosted = Math.sign(s) * Math.sqrt(Math.abs(s))
    return [LINE_MARGIN + i * step, 150 - boosted * WAVE_AMPLITUDE * ampScale]
  })
}

const LINE_A_FLAT = smoothPath(buildPhasePoints(1, 0))
const LINE_A_UP = smoothPath(buildPhasePoints(1, 1))
const LINE_A_DOWN = smoothPath(buildPhasePoints(1, -1))
const LINE_B_FLAT = smoothPath(buildPhasePoints(0.72, 0))
const LINE_B_UP = smoothPath(buildPhasePoints(0.72, 1))
const LINE_B_DOWN = smoothPath(buildPhasePoints(0.72, -1))
const LINE_C_FLAT = smoothPath(buildPhasePoints(0.48, 0))
const LINE_C_UP = smoothPath(buildPhasePoints(0.48, 1))
const LINE_C_DOWN = smoothPath(buildPhasePoints(0.48, -1))

// `wingHidden` is true only while RimMorph is merging DirectionCard's two
// protrusions into this screen's one. This screen's own wing has to be out
// of the way for that: it's the merge's end state, so leaving it drawn
// would show the finished shape underneath the one still arriving at it.
export default function ListeningScreen({ visible, onStart, onStop, micBootId, wingHidden }) {
  // micBootId starts at 0 and is only ever bumped by a decline (see
  // useAssistantFlow.js), so 0 reliably means "the app's true first mount"
  // and anything past that means "replaying after a decline collapse" —
  // the two need different animation timing, see ListeningScreen.css.
  const bootVariant = micBootId === 0 ? 'first' : 'replay'
  const pressedRef = useRef(false)
  const pressStartRef = useRef(0)
  const [pressed, setPressed] = useState(false)

  // True for the brief window after the mic is clicked to stop, while the
  // three wave lines are morphing into a ring instead of just cutting to
  // the processing screen. Kept separate from `pressed` — the mic itself
  // (and the audio it's pulling levels from) stops right away, but the
  // wave/flood/dim visuals need to stay "active" a beat longer for the
  // morph to actually be visible.
  const [morphing, setMorphing] = useState(false)
  const morphTimeoutRef = useRef(null)
  const morphAnimsRef = useRef([])

  // 'idle' | 'connecting' | 'live' | 'unavailable'. Distinguishing
  // "connecting" from "confirmed unavailable" matters: getUserMedia +
  // AudioContext startup can take a couple of seconds on a real device,
  // and the canned SMIL fallback animation should only ever be the
  // stand-in for a genuinely unavailable mic, not for "haven't heard back
  // yet" — otherwise it plays during that startup gap and then gets
  // replaced by a flat live line once real (near-silent) data arrives,
  // which reads as "random movement, then suddenly flat."
  const [audioState, setAudioState] = useState('idle')
  const smoothedRawRef = useRef(null)
  const { start, stop, sampleWaveform } = useMicAnalyser()
  const rafRef = useRef(null)
  const lineARef = useRef(null)
  const lineBRef = useRef(null)
  const lineCRef = useRef(null)
  const lineAMorphRafRef = useRef(null)

  useEffect(() => {
    if (!visible) {
      setPressed(false)
      setMorphing(false)
      if (morphTimeoutRef.current) clearTimeout(morphTimeoutRef.current)
      // Deliberately NOT canceling morphAnimsRef's animations here. `visible`
      // goes false the instant the morph completes (onStop flips the parent
      // phase to 'ring' in the same tick morphing ends), which is exactly
      // when the ring's fill:'forwards' end state — full thickness, fully
      // revealed — needs to stay frozen through the crossfade into
      // RingScreen. Canceling here stripped that frozen state and snapped
      // the ring back to its non-animated defaults (1.5px width, dashoffset
      // 0) right as the two screens crossfaded, which is what actually
      // caused the "no morphing, just one solid circle" glitch — a stale
      // frozen animation was never the problem. Fresh presses already
      // cancel any leftover morph animations themselves, in the "starting
      // fresh" branch of handleMicClick below.
    }
  }, [visible])

  // While actively held, pull live mic levels/pitch and redraw the three
  // wave lines directly (bypassing React state) for smooth per-frame
  // motion. Falls back to a canned SMIL animation below only once the mic
  // is confirmed unavailable or permission is denied — while still
  // connecting, the lines just stay at their flat baseline (their static
  // JSX `d`, untouched) rather than showing the canned animation early.
  useEffect(() => {
    if (!pressed) {
      stop()
      setAudioState('idle')
      return undefined
    }

    let cancelled = false
    setAudioState('connecting')
    smoothedRawRef.current = null

    start().then((ok) => {
      if (cancelled) return
      setAudioState(ok ? 'live' : 'unavailable')
      if (!ok) return

      const tick = () => {
        const raw = sampleWaveform(SAMPLE_COUNT)
        if (raw) {
          // Eases toward each new raw sample instead of jumping straight
          // to it — real time-domain data changes a lot frame to frame,
          // and easing is what turns that into a calmer, slower-moving
          // line instead of constant rapid jitter.
          if (!smoothedRawRef.current) {
            smoothedRawRef.current = raw.slice()
          } else {
            const smoothed = smoothedRawRef.current
            for (let i = 0; i < raw.length; i++) {
              smoothed[i] += (raw[i] - smoothed[i]) * TEMPORAL_SMOOTHING
            }
          }
          const eased = smoothedRawRef.current
          lineARef.current?.setAttribute('d', smoothPath(buildWaveformPoints(eased, 1, 3)))
          lineBRef.current?.setAttribute('d', smoothPath(buildWaveformPoints(eased, 0.85, 5)))
          lineCRef.current?.setAttribute('d', smoothPath(buildWaveformPoints(eased, 0.7, 7)))
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    })

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      stop()
    }
  }, [pressed, start, stop, sampleWaveform])

  const useFallbackAnimation = pressed && audioState === 'unavailable'

  // Pulls the primary wave line's flat resting shape around onto the arc
  // RingScreen picks up from, led by its right end — not by interpolating
  // the live `d` into the arc's `d`. Letting the browser interpolate between
  // two arbitrary path strings goes per-vertex with no regard for which
  // point corresponds to which, which for two very different curves doesn't
  // read as one continuous deformation — it reads as a jump partway through.
  // Interpolating each point toward a target by hand has its own problems:
  // points moving at different rates stretch and thin the curve between
  // them, and points whose targets are already curved start bending before
  // the head ever reaches them. So instead every frame's `d` is built by
  // sliding the line along one fixed track (see buildMorphPoints above) —
  // no point ever has a "target position" to interpolate toward at all.
  const playStopMorph = () => {
    const el = lineARef.current
    if (el) {
      el.removeAttribute('stroke-dasharray')
      el.removeAttribute('pathLength')
      el.removeAttribute('stroke-dashoffset')
      // Overrides the live line's url(#voiceGradA) reference (a
      // left-to-right fade meant for a horizontal line) with a plain
      // color — a gradient wrapped around an arc would fade in and out
      // unevenly instead of reading as one uniform stroke.
      el.style.stroke = '#111214'
      // The live waveform's own filter is a soft blur(1px), not a shadow —
      // once this line becomes the ring, it needs to match RingScreen's/
      // ProcessingScreen's own .ring-screen__ring / .processing-screen__arc
      // filter exactly, since this frozen end state is what stays on
      // screen for the entire crossfade into RingScreen.
      el.style.filter = 'drop-shadow(0 0 3px rgba(0, 0, 0, 0.4))'

      const startTime = performance.now()
      const tick = (now) => {
        const u = Math.min(1, (now - startTime) / MORPH_MS)
        // One eased progress value drives everything: how far the head has
        // travelled, and the stroke's thickness/color — so the line thickens
        // in step with its own motion rather than on a separate schedule.
        const overall = easeInOutCubic(u)
        el.setAttribute('d', smoothPath(buildMorphPoints(overall * MORPH_TRACK.headTravel)))

        el.style.strokeWidth = String(1.5 + (RING_STROKE_WIDTH - 1.5) * overall)
        // #111214 -> #000000, plain component lerp — the two are close
        // enough that a linear fade reads fine without needing a curve.
        const gray = Math.round(17 * (1 - overall))
        const grayB = Math.round(20 * (1 - overall))
        el.style.stroke = `rgb(${gray}, ${gray}, ${grayB})`

        if (u < 1) {
          lineAMorphRafRef.current = requestAnimationFrame(tick)
        }
      }
      lineAMorphRafRef.current = requestAnimationFrame(tick)
    }
    ;[lineBRef, lineCRef].forEach((ref) => {
      const lineEl = ref.current
      if (!lineEl) return
      const anim = lineEl.animate([{ opacity: getComputedStyle(lineEl).opacity }, { opacity: 0 }], {
        duration: MORPH_MS,
        easing: 'ease',
        fill: 'forwards',
      })
      morphAnimsRef.current.push(anim)
    })
  }

  // A tap toggles: first click starts listening, second click ends it — the
  // user no longer has to keep a finger down on the mic the whole time they
  // talk.
  const handleMicClick = (event) => {
    if (morphing) return

    if (!pressedRef.current) {
      // Starting fresh — stop the shape morph's rAF loop and any leftover
      // WAAPI animation still holding a ring shape in place (a finished
      // WAAPI animation with fill:'forwards' keeps overriding whatever it
      // touched indefinitely until canceled, otherwise the live waveform
      // below would silently fail to render) and put every line back at
      // its own flat baseline.
      if (lineAMorphRafRef.current) cancelAnimationFrame(lineAMorphRafRef.current)
      morphAnimsRef.current.forEach((anim) => anim.cancel())
      morphAnimsRef.current = []
      lineARef.current?.setAttribute('d', LINE_A_FLAT)
      lineARef.current?.removeAttribute('stroke-dasharray')
      lineARef.current?.removeAttribute('pathLength')
      lineARef.current?.removeAttribute('stroke-dashoffset')
      lineARef.current?.style.removeProperty('stroke')
      lineARef.current?.style.removeProperty('stroke-width')
      lineARef.current?.style.removeProperty('filter')
      lineBRef.current?.setAttribute('d', LINE_B_FLAT)
      lineCRef.current?.setAttribute('d', LINE_C_FLAT)

      pressedRef.current = true
      pressStartRef.current = performance.now()
      setPressed(true)
      onStart(event)
    } else {
      pressedRef.current = false
      const durationMs = performance.now() - pressStartRef.current
      setPressed(false)

      if (durationMs >= MIN_COHERENT_HOLD_MS) {
        setMorphing(true)
        playStopMorph()
        morphTimeoutRef.current = setTimeout(() => {
          setMorphing(false)
          onStop(durationMs, event)
        }, MORPH_MS)
      } else {
        onStop(durationMs, event)
      }
    }
  }

  return (
    <div
      className={`listening-screen${visible ? ' listening-screen--visible' : ''}${pressed || morphing ? ' listening-screen--active' : ''}`}
    >
      {/* Plain black for now — the dial is meant to eventually be a dynamic
          shader-style gradient, but that's deferred; this is the flat
          stand-in. Masked with the wing's own path (see WING_PATH_D above)
          so the dial's edge and the wing image on top of it share exactly
          one boundary where they meet, instead of two separately-drawn
          curves crossing at an angle. */}
      <svg className="listening-screen__glow-box" viewBox="0 0 1072 1072" aria-hidden="true">
        <defs>
          <mask id="listening-screen-dial-mask" maskUnits="userSpaceOnUse">
            <circle cx={DIAL_CENTER} cy={DIAL_CENTER} r={DIAL_RADIUS} fill="#ffffff" />
            {/* Same listening-screen-mic-boot-in keyframes as the visible
                wing image below, so the cutout grows in lockstep with it
                instead of being a full-size hole from the first frame.
                Keyed on micBootId (see .listening-screen__mic-boot below)
                so both remount — and so both replay the grow-in — together.
                Dropped entirely while RimMorph is running: the dial has to
                be a plain circle then, so the shape arriving above it is
                the only protrusion on screen. */}
            {!wingHidden && (
              <g
                key={micBootId}
                className={`listening-screen__dial-mask-boot listening-screen__dial-mask-boot--${bootVariant}`}
                style={{ transformOrigin: WING_ORIGIN }}
              >
                <path d={WING_PATH_D} fill="#000000" transform={WING_TRANSFORM} />
              </g>
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="1072"
          height="1072"
          fill="#000000"
          mask="url(#listening-screen-dial-mask)"
        />
      </svg>

      {/* Digital smartwatch face (time/date/stats) — replaces the old
          analog ticks/hands. The wrapper (not .digital-face itself) carries
          the once-only boot fade-in, since .digital-face's own opacity is
          also used for the ongoing active-state dim below — combining both
          on one element would let the boot animation's held end state
          permanently win over that later rule. This component never
          unmounts, so the boot animation can't replay. */}
      <div className="listening-screen__face-boot">
        <DigitalClockFace />
      </div>

      {/* Floods the whole screen white while actively recording, same as
          the original mic interaction — the clock/gradient underneath
          fade out and this covers them entirely. This is the only
          backdrop treatment during the morph — no separate gradient/glass
          layer on top of it, just the flat white flood behind the line
          itself. */}
      <div className="listening-screen__flood" />

      <svg
        className="listening-screen__wave"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="voiceGradA" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#111214" stopOpacity="0" />
            <stop offset="50%" stopColor="#111214" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#111214" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="voiceGradB" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#5a5d63" stopOpacity="0" />
            <stop offset="50%" stopColor="#5a5d63" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#5a5d63" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="voiceGradC" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#9a9da2" stopOpacity="0" />
            <stop offset="50%" stopColor="#9a9da2" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#9a9da2" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          ref={lineARef}
          className="listening-screen__wave-line listening-screen__wave-line--a"
          d={LINE_A_FLAT}
        >
          {useFallbackAnimation && (
            <animate
              attributeName="d"
              values={`${LINE_A_FLAT};${LINE_A_UP};${LINE_A_FLAT};${LINE_A_DOWN};${LINE_A_FLAT}`}
              dur="2.6s"
              repeatCount="indefinite"
            />
          )}
        </path>
        <path
          ref={lineBRef}
          className="listening-screen__wave-line listening-screen__wave-line--b"
          d={LINE_B_FLAT}
        >
          {useFallbackAnimation && (
            <animate
              attributeName="d"
              values={`${LINE_B_FLAT};${LINE_B_DOWN};${LINE_B_FLAT};${LINE_B_UP};${LINE_B_FLAT}`}
              dur="3.1s"
              repeatCount="indefinite"
            />
          )}
        </path>
        <path
          ref={lineCRef}
          className="listening-screen__wave-line listening-screen__wave-line--c"
          d={LINE_C_FLAT}
        >
          {useFallbackAnimation && (
            <animate
              attributeName="d"
              values={`${LINE_C_FLAT};${LINE_C_UP};${LINE_C_DOWN};${LINE_C_FLAT}`}
              dur="2.1s"
              repeatCount="indefinite"
            />
          )}
        </path>
      </svg>

      {/* On the app's first mount the bubble grows up out of the rim's
          bottom edge instead of just being there. The wrapper (not the
          button itself) carries that entrance animation so it doesn't
          fight the button's own press-state transform.

          Only the first mount animates. Arriving here from a decline, this
          protrusion isn't entering on its own — it's what DirectionCard's
          two are already in the middle of becoming, and RimMorph is drawing
          that whole motion. So it's held hidden (--replay, plus wingHidden
          below) until that shape lands on it, then fades up underneath the
          overlay, which is the same shape by then. Keyed on micBootId so
          each decline still forces a fresh mount, since a CSS `animation`
          only plays once per element instance and this component otherwise
          never unmounts. */}
      <div
        key={micBootId}
        className={`listening-screen__mic-boot listening-screen__mic-boot--${bootVariant}${wingHidden ? ' listening-screen__mic-boot--yielded' : ''}`}
      >
        <button
          type="button"
          className={`listening-screen__mic${pressed ? ' listening-screen__mic--pressed' : ''}${morphing ? ' listening-screen__mic--hide' : ''}`}
          onClick={handleMicClick}
          aria-pressed={pressed}
          aria-label={pressed ? 'Recording — click to stop' : 'Click to speak'}
          tabIndex={visible && !morphing && !wingHidden ? 0 : -1}
        >
          <img src={micWing} alt="" />
          {pressed ? (
            <PauseFilled size={32} className="listening-screen__mic-icon" />
          ) : (
            <MicrophoneFilled size={32} className="listening-screen__mic-icon" />
          )}
        </button>
      </div>
    </div>
  )
}
