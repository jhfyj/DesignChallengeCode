import { useEffect, useState } from 'react'
import ListeningScreen from './ListeningScreen.jsx'
import RingScreen from './RingScreen.jsx'
import ProcessingScreen from './ProcessingScreen.jsx'
import CompleteScreen from './CompleteScreen.jsx'
import DirectionCard from './DirectionCard.jsx'
import RimMorph, { RIM_MORPH_MS, RIM_SETTLE_MS } from './RimMorph.jsx'
import './Watch.css'

// The lug: the short flared stretch where the strap leaves the case, wide
// at the case and tapering into the straight strap below. Drawn as a path
// rather than a CSS shape because the taper is a curve, not a bevel —
// border-radius only rounds convexly, and the mask-composite trick that
// gets a concave cut in pure CSS needs four stacked layers to say what one
// path says outright.
//
// The wing box this lives in is sized from --case-size on both axes (see
// .watch__band-lug), so its aspect ratio never changes and
// preserveAspectRatio="none" can't distort the curve.
const LUG_W = 100
const LUG_H = 60
// Where the strap's straight edges end up, as a fraction of the lug's own
// width — keep in sync with --band-narrow / --band-wide in Watch.css.
const LUG_INSET = 13
// Both curves leave the case vertically and arrive at the strap vertically
// (control points directly above/below their own endpoints), so the lug
// meets the case square and hands off to the straight strap without a
// visible corner at either end.
const LUG_D = [
  `M0 0`,
  `C0 ${LUG_H * 0.42} ${LUG_INSET} ${LUG_H * 0.5} ${LUG_INSET} ${LUG_H}`,
  `L${LUG_W - LUG_INSET} ${LUG_H}`,
  `C${LUG_W - LUG_INSET} ${LUG_H * 0.5} ${LUG_W} ${LUG_H * 0.42} ${LUG_W} 0`,
  'Z',
].join('')

// Across the strap, not along it: a soft cylindrical falloff that reads as
// matte silicone. Deliberately a narrow range (#1b1d22 to #2b2e35, ~16
// levels) — the old strap ran a much wider one, which is what made it look
// like polished metal instead of rubber. Shared by the SVG lug above and
// .watch__band-strap's CSS gradient, which must stay identical.
const BAND_STOPS = [
  ['0%', '#15171b'],
  ['10%', '#1f2128'],
  ['38%', '#2b2e35'],
  ['62%', '#2b2e35'],
  ['90%', '#1f2128'],
  ['100%', '#15171b'],
]

export default function Watch({ flow }) {
  const {
    phase,
    checkpointIndex,
    elapsedSeconds,
    cycleId,
    micBootId,
    tasks,
    onListenStart,
    onListenStop,
    onRingSequenceDone,
    onConfirmAccept,
    onConfirmDecline,
  } = flow

  // 'off' | 'morph' | 'settle'. Declining hands the rim and both of its
  // protrusions to RimMorph as one shape while the card and the listening
  // screen crossfade underneath it — the phase flips immediately rather
  // than after a wing animation, because there is no longer a per-wing
  // animation to wait on. 'settle' is the short beat where RimMorph fades
  // off the listening screen's own (identical, by then) wing.
  const [rimStage, setRimStage] = useState('off')

  useEffect(() => {
    if (rimStage === 'off') return undefined
    const next = rimStage === 'morph' ? 'settle' : 'off'
    const id = setTimeout(
      () => setRimStage(next),
      rimStage === 'morph' ? RIM_MORPH_MS : RIM_SETTLE_MS,
    )
    return () => clearTimeout(id)
  }, [rimStage])

  const handleDecline = (event) => {
    setRimStage('morph')
    onConfirmDecline(event)
  }

  return (
    <div className="watch">
      {/* Shared fill for both lugs — a single defs block rather than one per
          band, since SVG gradient ids resolve document-wide. Matches
          .watch__band-strap's own CSS gradient stop for stop, so the curved
          lug and the straight strap below it read as one continuous piece of
          silicone rather than two shapes that happen to touch. */}
      <svg className="watch__band-defs" aria-hidden="true">
        <defs>
          {/* userSpaceOnUse, spanning exactly the lug's narrow end rather
              than its bounding box: an objectBoundingBox gradient stretches
              across the lug's *widest* point, so by the time the taper
              reaches the strap the two gradients are at different scales and
              the junction shows up as a tonal step. Pinning both to the same
              span — the strap's own width — makes them line up exactly. The
              flared shoulders sit past the last stop and clamp to the edge
              color, which is what a strap curving away from the light does
              anyway. */}
          <linearGradient
            id="watch-band-fill"
            gradientUnits="userSpaceOnUse"
            x1={LUG_INSET}
            y1="0"
            x2={LUG_W - LUG_INSET}
            y2="0"
          >
            {BAND_STOPS.map(([offset, color]) => (
              <stop key={offset} offset={offset} stopColor={color} />
            ))}
          </linearGradient>
        </defs>
      </svg>

      <div className="watch__band watch__band--top">
        <div className="watch__band-strap" />
        <svg
          className="watch__band-lug"
          viewBox={`0 0 ${LUG_W} ${LUG_H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={LUG_D} fill="url(#watch-band-fill)" />
        </svg>
      </div>

      <div className="watch__case">
        <div className="watch__bezel">
          <div className="watch__screen">
            {/* The default face — ticking hands over the white/gradient
                dial — doubles as the listening screen: pressing the mic
                doesn't cut to a different screen, it just starts recording
                on the one that's already showing, so nothing "jumps." */}
            <ListeningScreen
              visible={phase === 'idle' || phase === 'listening' || phase === 'unclear'}
              onStart={onListenStart}
              onStop={onListenStop}
              micBootId={micBootId}
              wingHidden={rimStage === 'morph'}
            />

            <RingScreen
              visible={phase === 'ring'}
              taskCount={tasks.length}
              onSequenceDone={onRingSequenceDone}
            />

            <ProcessingScreen
              visible={phase === 'progress'}
              tasks={tasks}
              checkpointIndex={checkpointIndex}
              cycleId={cycleId}
              elapsedSeconds={elapsedSeconds}
            />

            <CompleteScreen visible={phase === 'complete'} />

            <DirectionCard
              visible={phase === 'confirm'}
              onAccept={onConfirmAccept}
              onDecline={handleDecline}
            />

            {/* Above every screen: the rim and its protrusions as one
                shape, for as long as it takes the card's two to merge into
                the listening screen's one. See rimShape.js. */}
            <RimMorph stage={rimStage} />

            {/* The cover glass, above every screen and every morph — a real
                watch's glass doesn't go away when the UI changes, so this
                sits outside the phase machinery entirely and is never
                toggled. pointer-events: none in the CSS is what keeps it
                from eating the mic press and the card's swipe/taps, since it
                covers the entire screen. */}
            <div className="watch__glass" aria-hidden="true">
              <div className="watch__glass-streak" />
            </div>
          </div>
        </div>
      </div>

      <div className="watch__band watch__band--bottom">
        <svg
          className="watch__band-lug"
          viewBox={`0 0 ${LUG_W} ${LUG_H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={LUG_D} fill="url(#watch-band-fill)" />
        </svg>
        <div className="watch__band-strap" />
      </div>
    </div>
  )
}
