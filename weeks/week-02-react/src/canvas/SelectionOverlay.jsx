import { useRef, useState } from 'react'
import LockIcon from './LockIcon.jsx'
import { rotatedBoxStyle } from './rotationLayout.js'

const CORNERS = ['nw', 'ne', 'se', 'sw']
const EDGES = ['n', 'e', 's', 'w']

// A handle's CSS cursor (ns-resize, ew-resize, ...) is a screen-space hint,
// but its ROLE (n/e/s/w/corners) is defined in the element's own LOCAL
// frame — the CSS class-based cursor (Canvas.css) is static and doesn't
// know about rotation, so a 90°-rotated element's "s" handle (now sitting
// at the element's visual LEFT edge, see useElementDrag.js's startResize)
// still shows an up/down cursor even though dragging it left/right is what
// actually resizes it. This computes the correct cursor by rotating the
// handle's nominal compass angle by the element's own rotation and snapping
// to the nearest of CSS's 4 resize-cursor directions (each covers a 90°-
// wide band), then gets applied as an inline style override.
const NOMINAL_ANGLE = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 }
const CURSOR_BY_COMPASS_BUCKET = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize']

function resizeCursorForHandle(handleRole, rotation) {
  const effective = ((NOMINAL_ANGLE[handleRole] + (rotation || 0)) % 360 + 360) % 360
  const bucket = Math.round(effective / 45) % 8
  return CURSOR_BY_COMPASS_BUCKET[bucket]
}

// Chebyshev distance (in px) from a corner's center within which a
// pointerdown resizes instead of rotates — the handle's hit area is bigger
// than this so there's a ring beyond the resize zone, still on the same
// button, that rotates. This is what "embeds" rotation into the corners
// instead of giving it its own separate handle.
const RESIZE_ZONE_RADIUS = 8

function zoneFromEvent(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const dist = Math.max(Math.abs(e.clientX - cx), Math.abs(e.clientY - cy))
  return dist <= RESIZE_ZONE_RADIUS ? 'resize' : 'rotate'
}

// A single corner button that's both the resize handle and the (otherwise
// hidden) rotate handle: pointer near the corner dot resizes, pointer a
// little further out — still over the same enlarged hit area — rotates.
// Hovering is the only way to discover the rotate zone, by design (no
// separate dot cluttering the selection box).
function CornerHandle({ corner, placement, boxRef, onStartResize, onStartRotate }) {
  const [zone, setZone] = useState('resize')

  function handlePointerDown(e) {
    if (zoneFromEvent(e) === 'rotate') {
      onStartRotate(e, placement, boxRef.current)
    } else {
      onStartResize(e, placement, corner)
    }
  }

  return (
    <button
      type="button"
      className={`selection-overlay__handle selection-overlay__handle--${corner} selection-overlay__handle--zone-${zone}`}
      // Only the resize zone's cursor is rotation-dependent — the rotate
      // zone's grab cursor (Canvas.css) has no directional meaning to correct.
      style={zone === 'resize' ? { cursor: resizeCursorForHandle(corner, placement.rotation) } : undefined}
      onPointerMove={(e) => setZone(zoneFromEvent(e))}
      onPointerDown={handlePointerDown}
      aria-label={zone === 'rotate' ? 'Rotate' : `Resize ${corner}`}
    >
      <span className="selection-overlay__handle-dot" />
    </button>
  )
}

// Edge (side-midpoint) handles are resize-only, single-axis, no rotate
// zone — rotation only lives in the corners (see CornerHandle above). Drawn
// as a small bar/grip instead of a square dot so they read as a distinct
// affordance from the corners at a glance.
function EdgeHandle({ edge, placement, onStartResize }) {
  return (
    <button
      type="button"
      className={`selection-overlay__edge selection-overlay__edge--${edge}`}
      style={{ cursor: resizeCursorForHandle(edge, placement.rotation) }}
      onPointerDown={(e) => onStartResize(e, placement, edge)}
      aria-label={`Resize ${edge}`}
    >
      <span className="selection-overlay__edge-bar" />
    </button>
  )
}

// hideLock: the speaker info block has no lock concept of its own (locking
// lives on its linked photo) — passing true skips rendering the button
// entirely instead of showing a non-functional one.
export default function SelectionOverlay({ placement, grid, onStartResize, onStartRotate, onToggleLock, hideLock = false }) {
  const boxRef = useRef(null)
  const { locked } = placement

  return (
    <div
      ref={boxRef}
      className="selection-overlay"
      style={rotatedBoxStyle(placement, grid)}
    >
      {!hideLock && (
        <button
          type="button"
          className={`selection-overlay__lock${locked ? ' selection-overlay__lock--locked' : ''}`}
          onPointerDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
          onClick={(e) => {
            e.stopPropagation()
            onToggleLock()
          }}
          aria-label={locked ? 'Unlock element' : 'Lock element'}
          aria-pressed={locked}
        >
          <LockIcon locked={locked} />
        </button>
      )}
      {/* Locked elements skip resize/rotate entirely — the lock button above
          is the only interactive affordance until it's unlocked again. */}
      {!locked && EDGES.map((edge) => (
        <EdgeHandle key={edge} edge={edge} placement={placement} onStartResize={onStartResize} />
      ))}
      {!locked && CORNERS.map((corner) => (
        <CornerHandle
          key={corner}
          corner={corner}
          placement={placement}
          boxRef={boxRef}
          onStartResize={onStartResize}
          onStartRotate={onStartRotate}
        />
      ))}
    </div>
  )
}
