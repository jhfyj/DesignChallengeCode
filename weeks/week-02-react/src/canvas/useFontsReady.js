import { useEffect, useState } from 'react'

// Canvas text renders with whatever font is loaded at the time, which can
// briefly be a system-font fallback if Inter/Figtree/Fira Mono haven't
// finished loading yet (FOUT) — this hook forces one re-render once the
// real webfont swaps in so the browser reflows with correct metrics.
export function useFontsReady() {
  const [ready, setReady] = useState(() => !document.fonts || document.fonts.status === 'loaded')

  useEffect(() => {
    if (ready || !document.fonts) return
    let cancelled = false
    document.fonts.ready.then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [ready])

  return ready
}
