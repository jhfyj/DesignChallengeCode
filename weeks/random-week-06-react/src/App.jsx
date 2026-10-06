import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { entryAt } from './entries.js'
import { tick } from './tick.js'
import Page from './Page.jsx'
import './App.css'

// Everything is laid out in the Figma frame's own units and scaled to fit.
const FRAME_W = 589
const FRAME_H = 1278

// The phone around the screen: metal rim plus black bezel on every side.
const BEZEL = 26
const DEVICE_W = FRAME_W + BEZEL * 2
const DEVICE_H = FRAME_H + BEZEL * 2
const FIT = 0.94 // leave a little room around the phone

// Positions count back in time: 0 is the newest entry, and the history above
// it never runs out. Moving up the list (older) means a larger position.
const PITCH = 150 // one entry plus the 69px gap, as in the frames
const ABOVE = 5 // entries rendered above / below the active one
const BELOW = 6
const TICK_RATE = 75 // ticks travel this far per entry, so a drag on the pill scrubs at 2x the list
const TICK_PERIOD = 32 // the tick artwork repeats every long+short pair
const WHEEL_PER_STEP = 90 // wheel delta (px) that clicks one entry over
const OVERPULL = 0.45 // input slack below the newest entry
const STIFFNESS = 0.35
const DAMPING = 0.4 // critically damped: lands without overshooting
const SETTLE_MS = 140 // quiet time before leftover input is dropped
const DWELL_MS = 1000 // staying on a task this long opens its context
const LIST_LEFT = 121 // left edge of the entry column
const CONTEXT_LEFT = 352 // left edge of the context column, as in the frame
const ARROW_W = 10.4
const CLOSE_MS = 450

// Wherever the pointer first presses becomes a checkpoint. Small drags from it
// step through entries; dragging well away from it and holding keeps scrolling
// that way, faster the further from the checkpoint the pointer is pulled.
const REACH = 110 // px from the checkpoint before continuous scrolling starts
const EDGE_RATE = 3 // entries per second once past REACH
const EDGE_GAIN = 0.07 // extra entries per second for each px further
const EDGE_MAX = 40

const floor0 = (v) => Math.max(0, v)

function useFrameScale() {
  const read = () => FIT * Math.min(window.innerWidth / DEVICE_W, window.innerHeight / DEVICE_H)
  const [scale, setScale] = useState(read)
  useEffect(() => {
    const onResize = () => setScale(read())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return scale
}

export default function App() {
  const scale = useFrameScale()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(0)
  const [edge, setEdge] = useState(0) // -1 holding the bottom, 1 holding the top
  const [held, setHeld] = useState(null) // entry whose context is open

  const panelRef = useRef(null)
  const railRef = useRef(null)
  const listRef = useRef(null)
  const arrowRef = useRef(null)
  const raw = useRef(0) // continuous input from wheel and drag
  const step = useRef(0) // the detent the input currently falls in
  const current = useRef(0)
  const velocity = useRef(0)
  const raf = useRef(0)
  const settleTimer = useRef(0)
  const closeTimer = useRef(0)
  const drag = useRef(null)

  // Input accumulates freely, but the list only ever moves to whole detents:
  // it holds still until the input crosses halfway, then snaps to the next
  // entry and stops there. Nothing ever travels past a detent and comes back.
  const run = useCallback(() => {
    if (raf.current) return
    const frame = () => {
      const goal = step.current
      const before = goal - current.current
      velocity.current = (velocity.current + before * STIFFNESS) * DAMPING
      current.current += velocity.current
      const after = goal - current.current
      // Never let it sail past the goal: no bounce, ever.
      if (Math.sign(after) !== Math.sign(before) || Math.abs(after) < 0.0005) {
        current.current = goal
        velocity.current = 0
      }
      setPos(current.current)
      if (velocity.current === 0 && !drag.current?.rate) {
        raf.current = 0
        return
      }
      raf.current = requestAnimationFrame(frame)
    }
    raf.current = requestAnimationFrame(frame)
  }, [])

  const landOn = useCallback((i) => {
    if (i === step.current) return
    step.current = i
    tick(listRef.current?.querySelector(`[data-k="${i}"] .entry__dot`))
  }, [])

  // Once input goes quiet, drop any partial pull so the next one starts fresh.
  const scheduleRelease = useCallback(() => {
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      if (drag.current) return
      raw.current = step.current
      run()
    }, SETTLE_MS)
  }, [run])

  const shift = useCallback(
    (delta) => {
      raw.current = Math.max(-OVERPULL, raw.current + delta)
      landOn(floor0(Math.round(raw.current)))
      run()
    },
    [landOn, run],
  )

  const nudge = useCallback(
    (delta) => {
      shift(delta)
      scheduleRelease()
    },
    [shift, scheduleRelease],
  )

  const goTo = useCallback(
    (i) => {
      raw.current = floor0(i)
      landOn(raw.current)
      run()
    },
    [landOn, run],
  )

  const show = useCallback(() => {
    clearTimeout(closeTimer.current)
    setOpen(true)
  }, [])

  const hide = useCallback(() => {
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => {
      if (!drag.current) setOpen(false)
    }, CLOSE_MS)
  }, [])

  // The wheel scrubs only over the rail (the pill, or the timeline once it's
  // out). Everywhere else it falls through and scrolls the task page.
  useEffect(() => {
    const el = railRef.current
    const onWheel = (e) => {
      e.preventDefault()
      show()
      const px = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY
      nudge(-px / WHEEL_PER_STEP)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [nudge, show])

  // While a drag is held in an end zone, keep feeding the scroll every frame,
  // even when the pointer itself is perfectly still.
  useEffect(() => {
    if (!edge) return
    let id = 0
    let last = performance.now()
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const rate = drag.current?.rate ?? 0
      if (rate) shift(rate * dt)
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [edge, shift])

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      clearTimeout(settleTimer.current)
      clearTimeout(closeTimer.current)
    },
    [],
  )

  // Context opens once the scrubber has stayed on one task for DWELL_MS,
  // whether the pill is still being held or was let go. It stays open until
  // the scrubber moves to another task.
  const settledOn = open && !edge && pos === Math.round(pos) ? pos : null
  useEffect(() => {
    if (settledOn === null) return
    const id = setTimeout(() => setHeld(settledOn), DWELL_MS)
    return () => clearTimeout(id)
  }, [settledOn])

  const onPillDown = (e) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Synthetic or already-released pointers can't be captured; dragging still works inside the pill.
    }
    drag.current = { y: e.clientY, checkpoint: e.clientY, rate: 0 }
    e.currentTarget.dataset.touched = ''
    show()
    setGlow(e)
  }

  // The lit spot follows the pointer, pinned to the pill's ends.
  const setGlow = (e) => {
    const box = e.currentTarget.getBoundingClientRect()
    const y = Math.min(box.height, Math.max(0, e.clientY - box.top)) / scale
    e.currentTarget.style.setProperty('--touch-y', `${y}px`)
  }

  const onPillMove = (e) => {
    if (!drag.current) return
    setGlow(e)
    const pulled = (drag.current.checkpoint - e.clientY) / scale // up is positive
    const beyond = Math.abs(pulled) - REACH
    const dir = beyond > 0 ? Math.sign(pulled) : 0

    if (dir) {
      // Far enough from the checkpoint: the hold loop does the scrolling.
      drag.current.rate = dir * Math.min(EDGE_MAX, EDGE_RATE + beyond * EDGE_GAIN)
    } else {
      // Thumbwheel: the ticks ride with the pointer, so pushing up rolls the
      // list back in time.
      drag.current.rate = 0
      shift(-(e.clientY - drag.current.y) / scale / TICK_RATE)
    }
    drag.current.y = e.clientY
    setEdge(dir)
  }

  const onPillUp = (e) => {
    if (!drag.current) return
    drag.current = null
    delete e.currentTarget.dataset.touched
    setEdge(0)
    scheduleRelease()
  }

  const onPillKey = (e) => {
    const move = { ArrowUp: 1, ArrowDown: -1, PageUp: 5, PageDown: -5 }[e.key]
    if (move !== undefined) {
      e.preventDefault()
      show()
      goTo(step.current + move)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      show()
      setHeld((h) => (h === step.current ? null : step.current))
    } else if (e.key === 'End') {
      e.preventDefault()
      goTo(0)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const tickShift = ((((-pos * TICK_RATE) % TICK_PERIOD) + TICK_PERIOD) % TICK_PERIOD) - TICK_PERIOD
  const active = floor0(Math.round(pos))
  const activeEntry = entryAt(active)
  const details = open && held === active && pos === active ? active : null

  // Centre the arrow in the gap between where the active title's text really
  // ends (titles wrap to different widths) and the context column.
  useLayoutEffect(() => {
    if (details === null) return
    const place = () => {
      const title = listRef.current?.querySelector(`[data-k="${details}"] .entry__title`)
      if (!title || !arrowRef.current) return
      const range = document.createRange()
      range.selectNodeContents(title)
      // Measured against the title's own box, so the list's slide-in doesn't skew it.
      const textWidth =
        (Math.max(...[...range.getClientRects()].map((r) => r.right)) - title.getBoundingClientRect().left) / scale
      const textRight = LIST_LEFT + textWidth
      arrowRef.current.style.left = `${(textRight + CONTEXT_LEFT) / 2 - ARROW_W / 2}px`
    }
    place()
    document.fonts?.ready.then(place)
  }, [details, scale])

  const pages = []
  for (let k = floor0(Math.floor(pos)); k <= Math.ceil(pos); k++) pages.push(k)

  const visible = []
  for (let k = floor0(Math.floor(pos) - BELOW); k <= Math.ceil(pos) + ABOVE; k++) visible.push(k)

  return (
    <main className="stage">
      <div className="frame-slot" style={{ width: DEVICE_W * scale, height: DEVICE_H * scale }}>
        <div className="device" style={{ width: DEVICE_W, height: DEVICE_H, transform: `scale(${scale})` }}>
          <span className="device__button device__button--action" />
          <span className="device__button device__button--vol-up" />
          <span className="device__button device__button--vol-down" />
          <span className="device__button device__button--power" />
          <div
            ref={panelRef}
            className={`panel${open ? ' is-open' : ''}`}
            style={{ width: FRAME_W, height: FRAME_H, left: BEZEL, top: BEZEL }}
          >
            {/* Task pages sit on one vertical strip that follows the scrubber, so
                moving between tasks slides rather than cuts. Older tasks are above. */}
            {pages.map((k) => (
              <Page key={k} k={k} onGo={goTo} offset={(pos - k) * FRAME_H} />
            ))}

            <button
              type="button"
              className={`return${active > 0 ? ' is-shown' : ''}`}
              onClick={() => goTo(0)}
              tabIndex={active > 0 ? 0 : -1}
              aria-hidden={active === 0}
            >
              Return to current
              <span aria-hidden="true">↓</span>
            </button>

            <div ref={railRef} className="rail" onPointerLeave={hide} onPointerEnter={() => open && show()}>
              <div className="rail__backdrop" />
              <div
                className={`pill${edge > 0 ? ' is-holding-top' : edge < 0 ? ' is-holding-bottom' : ''}`}
                role="slider"
                tabIndex={0}
                aria-label="Activity timeline, newest at the bottom"
                aria-orientation="vertical"
                aria-valuemin={0}
                aria-valuenow={active}
                aria-valuetext={`${activeEntry.title}, ${activeEntry.time}`}
                onPointerEnter={show}
                onPointerDown={onPillDown}
                onPointerMove={onPillMove}
                onPointerUp={onPillUp}
                onPointerCancel={onPillUp}
                onFocus={show}
                onKeyDown={onPillKey}
              >
                <div className="pill__glow" />
                <div className="ticks ticks--collapsed">
                  <span className="ticks__lip" style={{ '--shift': `${tickShift}px` }} />
                  <span className="ticks__art" style={{ '--shift': `${tickShift}px` }} />
                </div>
                <div className="ticks ticks--open">
                  <span className="ticks__lip" style={{ '--shift': `${tickShift}px` }} />
                  <span className="ticks__art" style={{ '--shift': `${tickShift}px` }} />
                </div>
              </div>

              <ol ref={listRef} className="entries" aria-hidden={!open}>
                {visible.map((k) => {
                  const entry = entryAt(k)
                  const d = Math.min(1, Math.abs(k - pos))
                  return (
                    <li
                      key={k}
                      data-k={k}
                      className={`entry${k === active ? ' is-active' : ''}`}
                      style={{ transform: `translateY(${(pos - k) * PITCH}px)`, opacity: 1 - 0.73 * d }}
                      onClick={() => goTo(k)}
                    >
                      <span className="entry__dot" data-status={entry.status}>
                        <span className="entry__dot-fill" />
                      </span>
                      <p className="entry__title">{entry.title}</p>
                      <p className="entry__time">{entry.time}</p>
                    </li>
                  )
                })}
              </ol>

              {details !== null && (
                <div className="details" key={details}>
                  <img ref={arrowRef} className="details__arrow" src={`${import.meta.env.BASE_URL}assets/arrow.svg`} alt="" />
                  <section className="context" aria-live="polite">
                    <p className="context__summary">{entryAt(details).summary}</p>
                    <ul className="context__points">
                      {entryAt(details).points.map((line, j) => (
                        <li key={line} style={{ animationDelay: `${90 + j * 60}ms` }}>
                          {line}
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              )}
            </div>

            <span className="device__island" aria-hidden="true" />
            <span className="device__home" aria-hidden="true" />
          </div>
        </div>
      </div>
    </main>
  )
}
