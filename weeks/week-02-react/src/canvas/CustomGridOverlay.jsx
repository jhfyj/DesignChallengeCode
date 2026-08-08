import LockIcon from './LockIcon.jsx'
import { computeLineOffsets } from './customGrid.js'

// Wider than the visible 1px bar so it's actually grabbable — the bar itself
// is centered inside this hit strip. See useGridLineDrag.js for the drag math.
const HIT_WIDTH = 10

function GridLine({ line, grid, selected, onStartDrag, onStartEndDrag, onSelectLine, onToggleLock }) {
  const isCol = line.axis === 'col'
  const style = isCol
    ? { left: grid.marginPx + line.offsetPx - HIT_WIDTH / 2, top: grid.marginPx, height: grid.usableHeight, width: HIT_WIDTH }
    : { top: grid.marginPx + line.offsetPx - HIT_WIDTH / 2, left: grid.marginPx, width: grid.usableWidth, height: HIT_WIDTH }

  return (
    <div
      className={`custom-grid-line custom-grid-line--${line.axis}${line.locked ? ' is-locked' : ''}${selected ? ' is-selected' : ''}`}
      style={style}
      onPointerDown={(e) => {
        onSelectLine(line.id)
        onStartDrag(e, line)
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <span className="custom-grid-line__bar" />
      {!line.locked && (
        <>
          <button
            type="button"
            className="custom-grid-line__end custom-grid-line__end--a"
            onPointerDown={(e) => {
              onSelectLine(line.id)
              onStartEndDrag(e, line)
            }}
            aria-label={`Drag ${line.axis === 'col' ? 'top' : 'left'} end`}
          />
          <button
            type="button"
            className="custom-grid-line__end custom-grid-line__end--b"
            onPointerDown={(e) => {
              onSelectLine(line.id)
              onStartEndDrag(e, line)
            }}
            aria-label={`Drag ${line.axis === 'col' ? 'bottom' : 'right'} end`}
          />
        </>
      )}
      <button
        type="button"
        className="custom-grid-line__lock"
        onPointerDown={(e) => {
          e.stopPropagation()
          e.preventDefault()
        }}
        onClick={(e) => {
          e.stopPropagation()
          onToggleLock(line.id)
        }}
        aria-label={line.locked ? 'Unlock grid line' : 'Lock grid line'}
        aria-pressed={line.locked}
      >
        <LockIcon locked={line.locked} />
      </button>
    </div>
  )
}

// The Custom (Swiss) grid's interactive counterpart to GridOverlay.jsx —
// rendered instead of it when gridType is 'Custom'. Every internal divider
// line is draggable (resizes its two neighboring tracks — see
// useGridLineDrag.js), individually lockable (hover to reveal the lock
// toggle, same interaction shape as SelectionOverlay.jsx's element lock),
// selectable (click, then Backspace/Delete removes it — see Canvas.jsx), and
// its two end handles can be dragged around the canvas border to convert the
// line to the other axis (see useGridLineDrag.js's startEndDrag).
export default function CustomGridOverlay({ grid, lines, visible, selectedLineId, onStartDrag, onStartEndDrag, onSelectLine, onToggleLock }) {
  if (!visible) return null

  const colLines = computeLineOffsets(lines.filter((l) => l.axis === 'col'), grid.usableWidth, grid.gapPx)
  const rowLines = computeLineOffsets(lines.filter((l) => l.axis === 'row'), grid.usableHeight, grid.gapPx)

  return (
    <>
      {[...colLines, ...rowLines].map((line) => (
        <GridLine
          key={line.id}
          line={line}
          grid={grid}
          selected={line.id === selectedLineId}
          onStartDrag={onStartDrag}
          onStartEndDrag={onStartEndDrag}
          onSelectLine={onSelectLine}
          onToggleLock={onToggleLock}
        />
      ))}
    </>
  )
}
