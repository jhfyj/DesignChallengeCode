import { useRef, useState } from 'react'

const CORNERS = ['nw', 'ne', 'se', 'sw']
const EDGES = ['n', 'e', 's', 'w']

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
      onPointerDown={(e) => onStartResize(e, placement, edge)}
      aria-label={`Resize ${edge}`}
    >
      <span className="selection-overlay__edge-bar" />
    </button>
  )
}

function LockIcon({ locked }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" fill="currentColor" />
      {locked ? (
        <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M8 11V7a4 4 0 0 1 7.4-2.2" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      )}
    </svg>
  )
}

export default function SelectionOverlay({ placement, onStartResize, onStartRotate, onToggleLock }) {
  const boxRef = useRef(null)
  const { row, col, colSpan, rowSpan, rotation, locked } = placement

  return (
    <div
      ref={boxRef}
      className="selection-overlay"
      style={{
        gridRow: `${row + 1} / span ${rowSpan}`,
        gridColumn: `${col + 1} / span ${colSpan}`,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
      }}
    >
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
