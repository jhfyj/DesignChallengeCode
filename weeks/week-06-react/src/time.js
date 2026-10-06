import { useEffect, useState } from 'react'
import { localHour } from './dotfield.js'

// The dial keeps New York time.
export const HOME = 'America/New_York'

// The one moment the whole wall shows. Live, it is simply now. Once the dial
// is turned it becomes now plus an offset, so it keeps ticking from wherever
// it was left -- every city then shows that same moment in its own zone.
let offset = 0
let live = true
let returning = 0 // the rAF of a wind back to now, if one is running
const subs = new Set()

const DAY = 864e5
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

const emit = () => subs.forEach((fn) => fn())

export const time = {
  now: () => new Date(Date.now() + offset),
  isLive: () => live,

  // Turn the wall to an hour of the day in New York. The offset is kept
  // within half a day either way, so dragging past midnight carries on
  // smoothly instead of jumping a day ahead.
  setLocalHour(hour) {
    const n = new Date()
    const cur = localHour(HOME, n) + n.getMilliseconds() / 3.6e6
    let d = (hour - cur) % 24
    if (d < -12) d += 24
    if (d >= 12) d -= 24
    cancelAnimationFrame(returning)
    returning = 0
    offset = d * 3.6e6
    live = false
    emit()
  },

  // Wind back to the real time the short way round -- never more than half a
  // day either way -- easing in and out, so the hand turns home and every
  // tile's light shifts with it instead of snapping.
  backToNow() {
    cancelAnimationFrame(returning)
    // Only the time of day shows, so whole days can be dropped from the offset.
    let from = offset % DAY
    if (from > DAY / 2) from -= DAY
    if (from < -DAY / 2) from += DAY

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // A hidden tab gets no frames, so there it simply jumps.
    if (still || document.hidden || Math.abs(from) < 1000) {
      offset = 0
      live = true
      emit()
      return
    }

    // Longer for a longer way back: 0.6s for a moment, 1.8s for half a day.
    const duration = 600 + 1200 * (Math.abs(from) / (DAY / 2))
    const start = performance.now()
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration)
      offset = from * (1 - easeInOut(t))
      if (t < 1) {
        returning = requestAnimationFrame(step)
      } else {
        offset = 0
        live = true
        returning = 0
      }
      emit()
    }
    returning = requestAnimationFrame(step)
  },

  subscribe(fn) {
    subs.add(fn)
    return () => subs.delete(fn)
  },
}

// Hidden preview knob, kept from before: ?hour=21.5 starts the dial there.
const params = new URLSearchParams(window.location.search)
if (params.has('hour') && !Number.isNaN(Number(params.get('hour')))) {
  time.setLocalHour(Number(params.get('hour')))
}

// The current moment, re-rendering on every wall-clock second and whenever
// the dial moves.
export function useNow() {
  const [now, setNow] = useState(() => time.now())

  useEffect(() => {
    let timer = 0
    const tick = () => {
      setNow(time.now())
      timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 5)
    }
    timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 5)
    const unsub = time.subscribe(() => setNow(time.now()))
    return () => {
      clearTimeout(timer)
      unsub()
    }
  }, [])

  return now
}
