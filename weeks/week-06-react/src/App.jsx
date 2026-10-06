import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PLACES } from './places.js'
import { DotField, daylight, loadImage, localHour, sampleImage } from './dotfield.js'
import {
  autoLook,
  cardKey,
  deleteRecord,
  loadMine,
  loadShown,
  saveRecord,
  saveShown,
  sunTimes,
  toPhoto,
} from './mine.js'
import { time, useNow } from './time.js'
import Dial, { HomeTime } from './Dial.jsx'
import WorldMap from './WorldMap.jsx'
import { continentOf } from './cities.js'
import NewPlace from './NewPlace.jsx'
import Photo from './Photo.jsx'
import Splitter from './Splitter.jsx'
import { DEFAULTS, MIN_DIAL, MIN_LEFT, MIN_MAP, clamp, loadLayout, saveLayout, useWide } from './layout.js'
import './App.css'

// Hidden preview knobs, so day and night can be checked without waiting:
//   ?hour=13.5   start the dial at that hour in New York (see time.js)
//   ?cycle=60    turn the dial through a whole day every 60 seconds
const params = new URLSearchParams(window.location.search)
const CYCLE = params.has('cycle') ? Number(params.get('cycle')) || 60 : null

const FRAME_MS = 1000 / 30 // the drift is slow; 30fps is plenty

// Jumping to a card from the map spotlights it: it glows while the rest
// dim, on one envelope -- a smooth rise, a moment held, a slower fall.
// Every card reads `spot` as it paints.
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)
const RISE = 450
const HOLD = 150
const FALL = 900
function envelope(ms) {
  if (!(ms >= 0)) return 0
  if (ms < RISE) return easeInOut(ms / RISE)
  if (ms < RISE + HOLD) return 1
  if (ms < RISE + HOLD + FALL) return easeInOut(1 - (ms - RISE - HOLD) / FALL)
  return 0
}
const spot = { key: null, from: NaN }
function spotlight(key) {
  const now = performance.now()
  // Mid-spotlight, the new one rises from where the old one had got to.
  const e = envelope(now - spot.from)
  let lo = 0
  let hi = 1
  for (let k = 0; k < 20 && e > 0; k++) {
    const m = (lo + hi) / 2
    if (easeInOut(m) < e) lo = m
    else hi = m
  }
  spot.key = key
  spot.from = now - (e > 0 ? lo : 0) * RISE
}
const DIM = 0.8 // how far the other cards fade: to 20%

// One card per city. The built-ins come first, each with its own photo; an
// added photo joins its city's card if there is one, or starts a new card.
function buildCards(mine) {
  const cards = PLACES.map((p) => ({
    key: cardKey(p.name, p.timeZone),
    place: p,
    photos: [{ id: p.id, image: p.image, crop: p.crop, cropX: p.cropX, look: p.look }],
  }))
  for (const photo of mine) {
    const key = cardKey(photo.label, photo.timeZone)
    let card = cards.find((c) => c.key === key)
    if (!card) {
      card = {
        key,
        place: {
          id: `card-${photo.id}`,
          name: photo.label,
          timeZone: photo.timeZone,
          lat: photo.lat,
          lng: photo.lng,
          ...sunTimes(photo.lat, photo.lng, photo.timeZone),
        },
        photos: [],
      }
      cards.push(card)
    }
    card.photos.push(photo)
  }
  return cards
}

export default function App() {
  const [mine, setMine] = useState([])
  const [adding, setAdding] = useState(false)
  const [shown, setShown] = useState(loadShown) // card key -> photo id
  const cards = useMemo(() => buildCards(mine), [mine])
  const [flare, setFlare] = useState(null) // { key, n }: the place just jumped to

  // The dividers. The column's height (less the text's own) bounds the boxes.
  const wide = useWide()
  const [layout, setLayout] = useState(loadLayout)
  const leftRef = useRef(null)
  const aboutRef = useRef(null)
  const [col, setCol] = useState({ w: 0, h: 0, text: 0 })
  useEffect(() => {
    const left = leftRef.current
    const about = aboutRef.current
    if (!wide || !left || !about) return
    const measure = () => {
      const last = about.lastElementChild.getBoundingClientRect().bottom
      const pad = parseFloat(getComputedStyle(about).paddingBottom)
      setCol({
        w: left.getBoundingClientRect().width,
        h: left.clientHeight,
        text: Math.ceil(last - about.getBoundingClientRect().top + pad),
      })
    }
    const ro = new ResizeObserver(measure)
    ro.observe(left)
    measure()
    return () => ro.disconnect()
  }, [wide])
  const relayout = (change) =>
    setLayout((l) => {
      const next = { ...l, ...change }
      saveLayout(next)
      return next
    })

  // Where the two lines in the column sit, in px, kept clear of each other.
  const H = col.h
  const lineMap = clamp(layout.map * H, MIN_MAP, H - col.text - MIN_DIAL)
  const lineDial = clamp(layout.dial * H, lineMap + MIN_DIAL, H - col.text)
  const maxLeft = window.innerWidth / 2
  const sized = wide && H > 0

  const show = (key, id) =>
    setShown((s) => {
      const next = { ...s, [key]: id }
      saveShown(next)
      return next
    })

  useEffect(() => {
    let alive = true
    loadMine().then((places) => alive && setMine(places))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!CYCLE) return
    let raf = 0
    const spin = (now) => {
      time.setLocalHour(((now / 1000 / CYCLE) * 24) % 24)
      raf = requestAnimationFrame(spin)
    }
    raf = requestAnimationFrame(spin)
    return () => cancelAnimationFrame(raf)
  }, [])

  // A new photo goes onto its city's card and is the one shown.
  const add = async (rec) => {
    await saveRecord(rec)
    setMine((m) => [...m, toPhoto(rec)])
    show(cardKey(rec.label, rec.timeZone), rec.id)
  }

  // The name of the card a city would join, if it has one already.
  const existing = (city) => cards.find((c) => c.key === cardKey(city.label, city.timeZone))?.place.name

  const closeNew = useCallback(() => setAdding(false), [])

  // From the map: bring the card into view and make it glow.
  // The flare waits for the scroll to land: until the card stops moving.
  const goTo = (key) => {
    const el = document.querySelector(`[data-card="${CSS.escape(key)}"]`)
    if (!el) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' })
    el.focus({ preventScroll: true })
    let top = NaN
    let calm = 0
    const started = performance.now()
    const watch = setInterval(() => {
      const now = el.getBoundingClientRect().top
      calm = Math.abs(now - top) < 0.5 ? calm + 1 : 0
      top = now
      if (calm < 2 && performance.now() - started < 1500) return
      clearInterval(watch)
      spotlight(key)
      setFlare((f) => ({ key, n: (f?.n ?? 0) + 1 }))
    }, 50)
  }

  const pins = cards.map((c) => ({ key: c.key, name: c.place.name, lat: c.place.lat, lng: c.place.lng }))
  const continents = new Set(cards.map((c) => continentOf(c.place.timeZone, c.place.lat, c.place.lng))).size

  const remove = (photo) => {
    setMine((m) => m.filter((p) => p !== photo))
    URL.revokeObjectURL(photo.image)
    deleteRecord(photo.id).catch(() => {})
  }

  return (
    <main
      className="app"
      style={wide && layout.left ? { '--left': `${clamp(layout.left, MIN_LEFT, maxLeft)}px` } : undefined}
    >
      <HomeTime />
      <aside
        className="left"
        ref={leftRef}
        style={sized ? { '--map-h': `${lineMap}px`, '--dial-h': `${lineDial - lineMap}px` } : undefined}
      >
        <section className="box map-box" aria-label="Where the places are">
          <WorldMap places={pins} onPick={goTo} fill={wide} flare={flare} />
          <div className="map-foot">
            <span>
              {cards.length} {cards.length === 1 ? 'location' : 'locations'}
            </span>
            <span className="dim">
              {continents} {continents === 1 ? 'Continent' : 'Continents'}
            </span>
          </div>
        </section>
        {sized && (
          <Splitter
            orientation="horizontal"
            label="Resize the map"
            value={lineMap}
            min={MIN_MAP}
            max={lineDial - MIN_DIAL}
            onChange={(px) => relayout({ map: clamp(px, MIN_MAP, lineDial - MIN_DIAL) / H })}
            onReset={() => relayout({ map: DEFAULTS.map })}
          />
        )}
        <section className="box dial-box" aria-label="Time">
          <Dial />
        </section>
        {sized && (
          <Splitter
            orientation="horizontal"
            label="Resize the time rim"
            value={lineDial}
            min={lineMap + MIN_DIAL}
            max={H - col.text}
            onChange={(px) => relayout({ dial: clamp(px, lineMap + MIN_DIAL, H - col.text) / H })}
            onReset={() => relayout({ dial: DEFAULTS.dial })}
          />
        )}
        {sized && (
          <Splitter
            orientation="vertical"
            label="Resize the panels"
            value={col.w}
            min={MIN_LEFT}
            max={maxLeft}
            onChange={(px) => relayout({ left: clamp(px, MIN_LEFT, maxLeft) })}
            onReset={() => relayout({ left: null })}
          />
        )}
        <section className="box about" ref={aboutRef}>
          <h1 className="place">World clock</h1>
          <p>Memories are made to be felt, not seen.</p>
        </section>
      </aside>

      <section className="right" aria-label="Places">
        <div className="wall">
          {cards.map((card) => (
            <Tile
              key={card.key}
              cardId={card.key}
              place={card.place}
              photos={card.photos}
              shownId={shown[card.key]}
              onShow={(id) => show(card.key, id)}
              onRemove={remove}
              flare={flare?.n ?? 0}
            />
          ))}
          <button type="button" className="tile new" onClick={() => setAdding(true)}>
            <span className="new-box" aria-hidden="true">
              +
            </span>
            <span className="caption">
              <span className="place">New</span>
              <span className="time">&nbsp;</span>
            </span>
          </button>
        </div>
      </section>

      {adding && <NewPlace onClose={closeNew} onSave={add} existing={existing} />}
    </main>
  )
}

function Tile({ cardId, place, photos, shownId, onShow, onRemove, flare }) {
  const canvasRef = useRef(null)
  const figureRef = useRef(null)
  const repaint = useRef(null)
  const stillFx = useRef({ glow: 0, dim: 0 }) // the spotlight, motion reduced
  const at = Math.max(0, photos.findIndex((p) => p.id === shownId))
  const photo = photos[at]
  const many = photos.length > 1
  const step = (d) => onShow(photos[(at + d + photos.length) % photos.length].id)

  // Drag or swipe sideways across the photo to switch it.
  const swipe = useRef(null)
  const onSwipeStart = (e) => {
    if (!many || e.button !== 0 || e.target.closest('button')) return
    swipe.current = { x: e.clientX, y: e.clientY }
  }
  const onSwipeEnd = (e) => {
    const s = swipe.current
    swipe.current = null
    if (!s) return
    const dx = e.clientX - s.x
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - s.y)) step(dx < 0 ? 1 : -1)
  }

  const { timeZone, sunrise, sunset } = place
  useEffect(() => {
    const canvas = canvasRef.current
    const field = new DotField(canvas)
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let timer = 0
    let lastFrame = 0
    let alive = true

    // The spotlight, eased towards each frame so a new one taking over
    // mid-way glides rather than jumps.
    let glow = 0
    let dim = 0
    let last = performance.now()
    const paint = (now) => {
      const light = daylight(localHour(timeZone, time.now()), sunrise, sunset)
      if (still) {
        glow = stillFx.current.glow
        dim = stillFx.current.dim
      } else {
        const t = performance.now()
        const e = envelope(t - spot.from)
        const mine = spot.key === cardId
        const k = 1 - Math.exp(-(t - last) / 90)
        last = t
        glow += ((mine ? e : 0) - glow) * k
        dim += ((mine ? 0 : e) - dim) * k
        if (glow < 0.002) glow = 0
        if (dim < 0.002) dim = 0
      }
      field.flare = glow
      field.draw(still ? 0 : now / 1000, light)
      const fig = figureRef.current
      const opacity = dim ? String(1 - DIM * dim) : ''
      if (fig && fig.style.opacity !== opacity) fig.style.opacity = opacity
    }
    repaint.current = paint

    // With motion reduced there is no frame loop, so turning the dial repaints.
    const unsub = still ? time.subscribe(() => paint(0)) : () => {}

    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      if (now - lastFrame < FRAME_MS) return
      lastFrame = now
      paint(now)
    }

    const sync = () => {
      const r = canvas.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (field.resize(r.width, r.height, dpr)) paint(performance.now())
    }
    const ro = new ResizeObserver(sync)
    ro.observe(canvas)
    sync()

    // Animate -- unless motion is reduced, in which case only repaint often
    // enough to follow the sun.
    loadImage(photo.image).then((img) => {
      if (!alive) return
      // Added photos work their look out from the photo itself.
      const look = photo.look === 'auto' ? autoLook(img, photo.crop, photo.cropX) : photo.look
      field.setPlace(sampleImage(img, photo.crop, photo.cropX), look)
      paint(performance.now())
      if (still) timer = setInterval(() => paint(0), 30000)
      else raf = requestAnimationFrame(frame)
    })

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      clearInterval(timer)
      unsub()
      ro.disconnect()
    }
  }, [photo, timeZone, sunrise, sunset, cardId])

  // A spotlight from the map. The frame loop plays it out; with motion
  // reduced there's none, so this card glows or dims briefly, then settles.
  useEffect(() => {
    if (!flare || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    stillFx.current = spot.key === cardId ? { glow: 0.6, dim: 0 } : { glow: 0, dim: 1 }
    repaint.current?.(0)
    const off = setTimeout(() => {
      stillFx.current = { glow: 0, dim: 0 }
      repaint.current?.(0)
    }, 520)
    return () => clearTimeout(off)
  }, [flare, cardId])

  const onKey = (e) => {
    if (!many || e.target !== e.currentTarget) return
    if (e.key === 'ArrowLeft') step(-1)
    else if (e.key === 'ArrowRight') step(1)
  }

  // Hover or focus shows the photo itself under the dots. A card with more
  // than one photo gets arrows and a row of pips to switch between them; each
  // photo gets a fresh canvas, which fades in.
  return (
    <figure
      ref={figureRef}
      className={many ? 'tile has-many' : 'tile'}
      tabIndex={0}
      onKeyDown={onKey}
      data-card={cardId}
    >
      <div
        className="frame"
        onPointerDown={onSwipeStart}
        onPointerUp={onSwipeEnd}
        onPointerCancel={() => (swipe.current = null)}
        onDragStart={(e) => e.preventDefault()}
      >
        <canvas key={photo.id} ref={canvasRef} className="dots" aria-hidden="true" />
        <Photo
          key={`photo-${photo.id}`}
          src={photo.image}
          crop={photo.crop}
          cropX={photo.cropX}
          alt={`Photo of ${place.name}`}
        />
        {photo.mine && (
          <button
            type="button"
            className="remove"
            onClick={() => onRemove(photo)}
            aria-label={`Remove this photo of ${place.name}`}
          >
            ×
          </button>
        )}
        {many && (
          <>
            <span className="count" aria-label={`Photo ${at + 1} of ${photos.length}`}>
              {at + 1}/{photos.length}
            </span>
            <button type="button" className="nav prev" onClick={() => step(-1)} aria-label="Previous photo">
              ‹
            </button>
            <button type="button" className="nav next" onClick={() => step(1)} aria-label="Next photo">
              ›
            </button>
          </>
        )}
      </div>
      <figcaption className="caption">
        <span className="place">{place.name}</span>
        <Clock timeZone={place.timeZone} />
      </figcaption>
    </figure>
  )
}

function Clock({ timeZone }) {
  const now = useNow()
  const text = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(now)

  return (
    <time className="time" dateTime={now.toISOString()}>
      {text}
    </time>
  )
}
