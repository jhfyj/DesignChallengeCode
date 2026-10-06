import { useSyncExternalStore } from 'react'

// The sizes of the left column and its three boxes, as dragged by the
// divider lines, kept between visits. The two lines inside the column are
// stored as where they sit, as a share of the column's height, so the boxes
// keep their proportions when the window changes size.

const KEY = 'week-06-layout'

export const DEFAULTS = {
  left: null, // the column's width in px; null for the default
  map: 0.44, // the line under the map
  dial: 0.87, // the line under the rim
}

export const MIN_LEFT = 260
export const MIN_MAP = 150
// The rim doesn't scale: its box always has room for it, the marker and
// the time and button under it.
export const MIN_DIAL = 310

export function loadLayout() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY)) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveLayout(layout) {
  try {
    localStorage.setItem(KEY, JSON.stringify(layout))
  } catch {
    // Storage off or full: the sizes just don't stick.
  }
}

export const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi))

// Only the two-panel layout has dividers; a phone keeps its own layout.
const WIDE = '(min-width: 761px)'
const subscribe = (cb) => {
  const mq = window.matchMedia(WIDE)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
export const useWide = () => useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches)
