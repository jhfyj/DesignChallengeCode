import { useEffect, useState } from 'react'

// Scales the artboard to fit the available canvas viewport (no pan/zoom yet
// — that's later infinite-canvas scope). Recomputes on container resize,
// which also covers window resize since the container tracks the viewport.
export function useFitToView(containerRef, contentWidth, contentHeight) {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const PADDING = 48

    function recompute(width, height) {
      const s = Math.min((width - PADDING) / contentWidth, (height - PADDING) / contentHeight)
      setScale(Math.max(0.05, Math.min(s, 3)))
    }

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      recompute(width, height)
    })
    ro.observe(el)
    recompute(el.clientWidth, el.clientHeight)

    return () => ro.disconnect()
  }, [containerRef, contentWidth, contentHeight])

  return scale
}
