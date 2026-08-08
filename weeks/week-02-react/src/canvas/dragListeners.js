// Shared pointer-drag mechanics: attach window-level pointermove/pointerup
// listeners on drag start, remove both on pointerup. Used by
// useElementDrag.js (move/resize/rotate) and useGridLineDrag.js (custom grid
// line drag) so both hooks share one implementation instead of copy-pasting
// the same wiring.
export function withDragListeners(onMove, onUp) {
  function handleMove(ev) {
    onMove(ev)
  }
  function handleUp(ev) {
    onUp?.(ev)
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleUp)
  }
  window.addEventListener('pointermove', handleMove)
  window.addEventListener('pointerup', handleUp)
}
