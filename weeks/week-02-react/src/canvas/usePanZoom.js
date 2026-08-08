import { useEffect, useState } from 'react'

// A little smaller than a full "fit to view" by default — leaves breathing
// room around the artboard instead of it touching the viewport edges.
const DEFAULT_ZOOM = 0.85
const MIN_ZOOM = 0.2
const MAX_ZOOM = 3
const WHEEL_ZOOM_STEP = 1.08

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

// Mouse-wheel zoom (multiplies on top of useFitToView's fit-to-container
// scale) plus spacebar-held-and-drag panning, the "infinite canvas" pan/zoom
// useFitToView.js's own comment flagged as not-yet-built. Zoom is anchored to
// the viewport's center (via the canvas-stage's existing flex centering,
// untouched here) rather than the cursor position — simpler, and correct as
// long as the user hasn't panned far off-center. Ctrl/Cmd+0 resets both zoom
// and pan back to their defaults (also re-centering, since pan {0,0} is what
// the flex centering alone produces).
export function usePanZoom() {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [spacePressed, setSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)

  useEffect(() => {
    function isTyping(e) {
      const tag = e.target.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable
    }
    function handleKeyDown(e) {
      if (e.code === 'Digit0' && (e.ctrlKey || e.metaKey) && !isTyping(e)) {
        e.preventDefault() // stop the browser's own Ctrl/Cmd+0 page-zoom-reset
        setZoom(DEFAULT_ZOOM)
        setPan({ x: 0, y: 0 })
        return
      }
      if (e.code !== 'Space' || isTyping(e)) return
      e.preventDefault() // stop the page from scrolling on Space
      setSpacePressed(true)
    }
    function handleKeyUp(e) {
      if (e.code !== 'Space') return
      setSpacePressed(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  function handleWheel(e) {
    e.preventDefault()
    const factor = e.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP
    setZoom((z) => clamp(z * factor, MIN_ZOOM, MAX_ZOOM))
  }

  // Capture phase, so this runs before any element underneath the cursor
  // gets a chance to start its own drag/select on the same pointerdown —
  // panning while spacebar is held always wins, no matter what's under it.
  function handlePointerDownCapture(e) {
    if (!spacePressed) return
    e.preventDefault()
    e.stopPropagation()
    setIsPanning(true)
    const startX = e.clientX
    const startY = e.clientY
    const startPan = pan

    function handleMove(ev) {
      setPan({ x: startPan.x + (ev.clientX - startX), y: startPan.y + (ev.clientY - startY) })
    }
    function handleUp() {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      setIsPanning(false)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  return { zoom, pan, spacePressed, isPanning, handleWheel, handlePointerDownCapture }
}
