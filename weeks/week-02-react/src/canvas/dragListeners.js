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

// Un-rotates a screen-space pointer delta into an element's own local
// (pre-rotation) axes. A resize handle's role (e.g. "n" drives rowSpan, "e"
// drives colSpan — see useElementDrag.js/useSpeakerInfoDrag.js's
// HANDLE_CONFIG) is defined in the element's LOCAL frame; once the element
// is visually rotated via CSS transform, its handles rotate right along
// with it, so a raw screen dx/dy no longer points along those axes. Without
// this, dragging what's now visually the side handle of a 90°-rotated box
// resizes its height instead of its width (or vice versa). Only resize
// needs this — a move drag should track the cursor in screen space
// regardless of the element's own rotation, and a rotate drag is already a
// screen-space angle measured around a fixed pivot.
export function unrotateDelta(dx, dy, rotationDeg) {
  const theta = ((rotationDeg || 0) * Math.PI) / 180
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  return { dx: cos * dx + sin * dy, dy: -sin * dx + cos * dy }
}
