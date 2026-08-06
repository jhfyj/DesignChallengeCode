import { useRef } from 'react'

// Corner handles (nw/ne/sw/se) scale the box and font together; edge
// handles (n/s/e/w) stretch just one dimension and leave font size alone —
// see useElementDrag.js's startResize for the actual behavior split.
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export default function SelectionOverlay({ placement, onStartResize, onStartRotate }) {
  const boxRef = useRef(null)
  const { row, col, colSpan, rowSpan, rotation } = placement

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
        className="selection-overlay__rotate"
        onPointerDown={(e) => onStartRotate(e, placement, boxRef.current)}
        aria-label="Rotate"
      />
      {HANDLES.map((handle) => (
        <button
          key={handle}
          type="button"
          className={`selection-overlay__handle selection-overlay__handle--${handle}`}
          onPointerDown={(e) => onStartResize(e, placement, handle)}
          aria-label={`Resize ${handle}`}
        />
      ))}
    </div>
  )
}
