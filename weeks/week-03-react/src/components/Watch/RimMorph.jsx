import { useEffect, useRef } from 'react'
import {
  ACCEPT_ICON_D,
  DECLINE_ICON_D,
  FRAME,
  getRimMorph,
  ACCEPT_ORIGIN_TRANSFORM,
  DECLINE_ORIGIN_TRANSFORM,
} from './rimShape.js'
import './RimMorph.css'

// How long the two protrusions take to merge into one.
export const RIM_MORPH_MS = 620
// A beat after the shape lands, during which this overlay fades out while
// ListeningScreen's own settled wing is restored underneath it. The two are
// the same shape by construction, so this only exists to absorb any
// sub-pixel difference between the traced profile and the source artwork
// rather than letting it land as a single-frame snap.
export const RIM_SETTLE_MS = 160

// The X / arrow glyphs are holes in the direction wings, so they can't
// survive as holes once those two wings stop existing as separate shapes.
// They're drawn here as solid dark glyphs instead (what's behind them on
// the card is the dark photo, so it reads the same) and taken out early —
// they belong to the choice being made, and the merge shouldn't be carrying
// them along with it.
const ICON_FADE_FRACTION = 0.35

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

// The rim and its protrusions, drawn as one shape for the length of a
// decline so they can move as one. This sits above both screens while they
// crossfade underneath: the card's photo and the listening dial swap over
// inside the hole, while the boundary itself is never handed off between
// them, which is what lets the two protrusions merge without the rim ever
// looking like it came apart. See rimShape.js for the geometry.
export default function RimMorph({ stage }) {
  const pathRef = useRef(null)
  const iconsRef = useRef(null)
  const rafRef = useRef(null)

  // Traced on mount, not on the click that needs it — see getRimMorph.
  useEffect(() => {
    getRimMorph()
  }, [])

  useEffect(() => {
    if (stage !== 'morph') return undefined
    const morph = getRimMorph()
    if (!morph) return undefined

    const startedAt = performance.now()
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / RIM_MORPH_MS)
      pathRef.current?.setAttribute('d', morph.pathAt(easeInOutCubic(progress)))
      if (iconsRef.current) {
        iconsRef.current.style.opacity = String(
          Math.max(0, 1 - progress / ICON_FADE_FRACTION),
        )
      }
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [stage])

  if (stage === 'off') return null
  const morph = getRimMorph()
  if (!morph) return null

  // The first frame's shape is set here rather than left to the effect
  // above, which only runs after the browser has already painted once —
  // the card's own wings are gone by this point, so a frame with nothing
  // in this path yet would be a frame with no protrusion at all.
  return (
    <svg
      className={`rim-morph${stage === 'settle' ? ' rim-morph--settling' : ''}`}
      viewBox={`0 0 ${FRAME} ${FRAME}`}
      aria-hidden="true"
    >
      <path
        ref={pathRef}
        d={morph.pathAt(stage === 'settle' ? 1 : 0)}
        fill="#ffffff"
        fillRule="evenodd"
      />
      <g ref={iconsRef} fill="#141519" style={{ opacity: stage === 'settle' ? 0 : 1 }}>
        <path d={DECLINE_ICON_D} transform={DECLINE_ORIGIN_TRANSFORM} />
        <path d={ACCEPT_ICON_D} transform={ACCEPT_ORIGIN_TRANSFORM} />
      </g>
    </svg>
  )
}
