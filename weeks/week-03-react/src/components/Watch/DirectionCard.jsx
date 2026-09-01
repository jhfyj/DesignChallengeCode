import { useEffect, useRef, useState } from 'react'
import twilightPhoto from '../../assets/figma/direction-card/restaurant-photo.jpeg'
import lanternsPhoto from '../../assets/chinese-restaurant.jpg'
import jadePhoto from '../../assets/restaurant3.jpg'
import walkIcon from '../../assets/figma/direction-card/walk-icon.svg'
// These two wings and the listening screen's single one are the same rim
// seen in two states, so they're described in one place rather than each
// screen owning its own copy — see rimShape.js, which is also what morphs
// between them on decline.
import {
  ACCEPT_ICON_D,
  ACCEPT_OUTER_D,
  DECLINE_ICON_D,
  DECLINE_OUTER_D,
} from './rimShape.js'
import './DirectionCard.css'

// Three nearby options instead of a single fixed result — none of this is
// real, just stand-in copy for the mockup. The three pagination dots below
// are what this list's length actually is, not a decoration. Twilight
// Lounge and Jade Palace each have their own photo; Golden Wok is the one
// page still borrowing another's (the lantern-lit storefront shot), so it
// alone carries a crop and warm grade to keep that repeat from reading as
// an obvious duplicate.
const RESULTS = [
  {
    name: 'Twilight Lounge',
    description: 'A modern Chinese kitchen in the heart of the East Village.',
    walkLabel: '12 MIN WALK',
    photo: twilightPhoto,
    photoClassName: 'direction-card__photo--twilight',
  },
  {
    name: 'Golden Wok',
    description: 'Hand-pulled noodles and a wok station that never stops smoking.',
    walkLabel: '9 MIN WALK',
    photo: lanternsPhoto,
    photoClassName: 'direction-card__photo--golden',
    darkOverlay: true,
  },
  {
    name: 'Jade Palace',
    description: 'Dim sum carts and red lanterns, open late most weekends.',
    walkLabel: '16 MIN WALK',
    photo: jadePhoto,
    photoClassName: 'direction-card__photo--jade',
    darkOverlay: true,
  },
]

// How far a drag has to travel before it counts as a page swipe rather
// than a tap.
const SWIPE_THRESHOLD_PX = 40
const SLIDE_MS = 260

// Renders one page's photo/overlay/text — pulled out so both the outgoing
// and incoming page can share it during a slide (see the two-panel render
// below).
function DirectionCardPanel({ item, style }) {
  const overlayOpacity = item.darkOverlay ? 0.4 : 0
  return (
    <div className="direction-card__slide" style={style}>
      <img className={`direction-card__photo ${item.photoClassName}`} src={item.photo} alt="" />
      {/* Golden Wok and Jade Palace's shared source photo runs too light —
          this darkens it back down without touching the color grading
          already happening in the photo's own filter. */}
      <div className="direction-card__photo-overlay" style={{ opacity: overlayOpacity }} />

      <div className="direction-card__content">
        <h1 className="direction-card__name">{item.name}</h1>
        <p className="direction-card__description">{item.description}</p>

        <div className="direction-card__pill">
          <img className="direction-card__pill-icon" src={walkIcon} alt="" />
          <span>{item.walkLabel}</span>
        </div>
      </div>
    </div>
  )
}

// onAccept is still passed in by Watch.jsx but deliberately not destructured
// here — the accept wing is inert for now (see its comment below).
export default function DirectionCard({ visible, onDecline }) {
  const [page, setPage] = useState(0)
  const [displayed, setDisplayed] = useState(RESULTS[0])
  // Both pages of a swipe are on screen and moving together the whole
  // time — see the effect below — so all this needs to track is which page
  // is incoming, which side it's arriving from, and whether the move has
  // started yet.
  const [transition, setTransition] = useState(null)
  const directionRef = useRef(1)
  const dragStartX = useRef(null)

  // A freshly confirmed request starts back on the first recommendation,
  // not wherever the last one happened to be left paged to.
  useEffect(() => {
    if (visible) setPage(0)
  }, [visible])

  // The outgoing and incoming photo are positioned edge-to-edge from the
  // very first frame (see the render below) and then both animate the same
  // distance in the same direction at once, so the seam between them never
  // opens up into a gap the way an exit-then-enter handoff would. `moving`
  // starts false so that first frame paints with no transition — otherwise
  // the browser would tween from each panel's *default* position instead of
  // the offscreen one they're meant to start from — then flips true a
  // couple of frames later to animate both into place.
  useEffect(() => {
    const target = RESULTS[page]
    if (target.name === displayed.name) return undefined
    setTransition({ to: target, direction: directionRef.current, moving: false })
    const startId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransition((t) => (t ? { ...t, moving: true } : t))
      })
    })
    const doneId = setTimeout(() => {
      setDisplayed(target)
      setTransition(null)
    }, SLIDE_MS)
    return () => {
      cancelAnimationFrame(startId)
      clearTimeout(doneId)
    }
  }, [page, displayed])

  const handlePointerDown = (event) => {
    dragStartX.current = event.clientX
  }

  const handlePointerUp = (event) => {
    if (dragStartX.current === null) return
    const dx = event.clientX - dragStartX.current
    dragStartX.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return
    // Loops both ways — swiping past the last option wraps to the first,
    // and past the first wraps to the last, instead of stopping dead at
    // either end.
    const delta = dx < 0 ? 1 : -1
    directionRef.current = delta
    setPage((p) => (p + delta + RESULTS.length) % RESULTS.length)
  }

  // The incoming panel is already mounted, already carrying its own
  // overlay, and already at its final position by the time the slide ends,
  // so the settle below just drops the outgoing one rather than swapping
  // anything on the panel the user is left looking at. Rendered as one
  // keyed array in both cases (rather than a fragment of two collapsing to
  // a lone element) so React matches these by key across that update and
  // keeps the incoming panel's DOM node instead of recycling the outgoing
  // one into it — recycling re-ran the node's overlay from the old page's
  // value to the new one, which the overlay's transition then tweened as a
  // brightness flash right as the slide landed.
  const panels = transition
    ? [
        {
          item: displayed,
          transform: transition.moving
            ? `translateX(${transition.direction === 1 ? '-100%' : '100%'})`
            : 'translateX(0%)',
        },
        {
          item: transition.to,
          transform: transition.moving
            ? 'translateX(0%)'
            : `translateX(${transition.direction === 1 ? '100%' : '-100%'})`,
        },
      ]
    : [{ item: displayed, transform: 'translateX(0%)' }]

  return (
    <div
      className={`direction-card${visible ? ' direction-card--visible' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragStartX.current = null
      }}
    >
      {/* The round mask stays put — only what's inside it slides. See
          DirectionCard.css for why the photo itself is a plain square
          rather than a circle of its own. */}
      <div className="direction-card__window">
        {panels.map(({ item, transform }) => (
          <DirectionCardPanel
            key={item.name}
            item={item}
            style={{
              transform,
              transition: transition?.moving ? `transform ${SLIDE_MS}ms ease` : 'none',
            }}
          />
        ))}
      </div>

      <div className="direction-card__dots" aria-hidden="true">
        {RESULTS.map((option, i) => (
          <span
            key={option.name}
            className={`direction-card__dot${i === page ? ' direction-card__dot--active' : ''}`}
          />
        ))}
      </div>

      {/* Each wing is one <path>, not a separate backing shape clipped or
          dilated to line up with the rim (earlier attempts at both kept
          leaving a seam right where they were supposed to meet, however
          precisely the numbers were tuned, because they were always two
          independently-antialiased edges lined up to *look* continuous
          rather than one edge that actually is). The curve leaves the rim
          at the rim's own slope — see tangentStartHandle/tangentEndHandle
          in rimShape.js.

          On decline these two stop existing as separate shapes entirely:
          RimMorph takes the rim and both protrusions over as one shape and
          merges them into the listening screen's single one. Nothing here
          animates on the way out — a wing that collapsed on its own would
          be the thing that fix was meant to stop, a protrusion moving
          independently of the rim it belongs to. */}
      {/* Mounted only while visible, not just hidden via opacity like the
          rest of the card — a CSS `animation` only plays once per element
          instance, and this screen re-shows on every completed request, so
          each fresh mount is what replays the grow-in below instead of it
          having already finished once, silently, back when the card first
          existed in the DOM. */}
      {visible && (
        <>
          <button
            type="button"
            className="direction-card__wing direction-card__wing--decline"
            onClick={onDecline}
            aria-label="Decline"
          >
            <svg
              className="direction-card__wing-backing"
              viewBox="0 0 400 381.5"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {/* One path, one fill. Combining both subpaths reproduces the
                  same nonzero-winding "hole" the original exported SVG
                  relies on for the icon cutout. */}
              <path d={DECLINE_OUTER_D + DECLINE_ICON_D} fill="#ffffff" />
            </svg>
          </button>
          {/* Deliberately inert for now — there's no destination to accept
              into yet, so this renders and animates like the decline wing
              but doesn't fire onAccept. Left enabled rather than `disabled`
              on purpose: a disabled button swallows pointer events instead
              of letting them bubble, which would make the area it covers a
              dead zone for the card's own swipe gesture. Watch.jsx still
              passes onAccept, so restoring this means destructuring it
              again and putting onClick back. */}
          <button
            type="button"
            className="direction-card__wing direction-card__wing--accept"
            aria-label="Accept and start direction"
          >
            <svg
              className="direction-card__wing-backing"
              viewBox="0 0 400 381.5"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d={ACCEPT_OUTER_D + ACCEPT_ICON_D} fill="#ffffff" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}
