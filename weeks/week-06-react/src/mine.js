import { COLS, ROWS, localHour, sampleImage, segmentSky } from './dotfield.js'

// Places added through the New dialog. They can't be hand-tuned like the
// built-ins, so everything places.js spells out is worked out here instead:
// the crop, the look, sunrise and sunset. They live in IndexedDB, photo and
// all, so they survive a reload.

const ASPECT = 26 / 32 // the tile
const LONG_EDGE = 1080 // what a saved photo is shrunk to

// ---- sun -------------------------------------------------------------------

// Sunrise and sunset as local clock hours, from the usual declination and
// hour-angle formula. Minutes out at worst, which is plenty for a dusk blend.
export function sunTimes(lat, lng, timeZone, date = new Date()) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const dayOfYear = Math.floor((date.getTime() - start) / 864e5)
  const decl = (23.44 * Math.PI) / 180 * Math.sin((2 * Math.PI * (284 + dayOfYear)) / 365)
  const phi = (lat * Math.PI) / 180
  const cosH = Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(decl)))
  const halfDay = ((Math.acos(cosH) * 180) / Math.PI) / 15

  // The zone's offset from UTC right now, in hours.
  const utc = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  let offset = localHour(timeZone, date) - utc
  if (offset > 14) offset -= 24
  if (offset < -12) offset += 24

  const noon = 12 - lng / 15 + offset
  return { sunrise: noon - halfDay, sunset: noon + halfDay }
}

// ---- photo -----------------------------------------------------------------

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file could not be read as an image.'))
    }
    img.src = url
  })
}

const lumaAt = (d, i) => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255

// Where to cut a tile-shaped window out of the photo: across the busiest
// stretch -- the most edges -- since that is where a city usually is.
function autoCrop(img) {
  const s = 96 / Math.max(img.width, img.height)
  const w = Math.max(2, Math.round(img.width * s))
  const h = Math.max(2, Math.round(img.height * s))
  const ctx = Object.assign(document.createElement('canvas'), { width: w, height: h }).getContext('2d', {
    willReadFrequently: true,
  })
  ctx.drawImage(img, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h).data

  const colEdge = new Float32Array(w)
  const rowEdge = new Float32Array(h)
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = (y * w + x) * 4
      const e = Math.abs(lumaAt(d, i) - lumaAt(d, i + 4)) + Math.abs(lumaAt(d, i) - lumaAt(d, i + w * 4))
      colEdge[x] += e
      rowEdge[y] += e
    }
  }

  // Slide a window of `size` along `edges` and return its best start, 0..1.
  const best = (edges, size) => {
    const n = edges.length
    const span = Math.min(n, Math.round(size * n))
    let sum = 0
    for (let i = 0; i < span; i++) sum += edges[i]
    let top = sum
    let at = 0
    for (let i = span; i < n; i++) {
      sum += edges[i] - edges[i - span]
      if (sum > top) {
        top = sum
        at = i - span + 1
      }
    }
    return at / n
  }

  const aspect = img.width / img.height
  if (aspect > ASPECT) {
    const f = ASPECT / aspect
    const x = best(colEdge, f)
    return { crop: [0, 1], cropX: [x, Math.min(1, x + f)] }
  }
  const f = aspect / ASPECT
  const y = best(rowEdge, f)
  return { crop: [y, Math.min(1, y + f)], cropX: [0, 1] }
}

// Day, dusk or night, read off the photo's own sky (see segmentSky), and the
// look that reads it best. A blue or pale sky is day: the night is invented,
// like Frankfurt's. A warm or dimming sky is a sunset: its real lights are
// kept and topped up, like New York's. A dark sky is night: its lights are
// read as they are. Whatever it is, autoSky turns the sky blue by day.
export function autoLook(img, crop, cropX) {
  const colors = sampleImage(img, crop, cropX)
  const { sky } = segmentSky(colors)
  const n = COLS * ROWS

  let count = 0
  const s = [0, 0, 0]
  let ground = 0
  for (let i = 0; i < n; i++) {
    const r = colors[i * 3], g = colors[i * 3 + 1], b = colors[i * 3 + 2]
    if (sky[i]) {
      s[0] += r; s[1] += g; s[2] += b
      count++
    } else {
      ground += 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
  }
  ground /= Math.max(1, n - count)

  let kind
  if (count < n * 0.04) {
    // Hardly any sky to go by: judge by the whole picture.
    kind = ground > 0.3 ? 'day' : ground < 0.15 ? 'night' : 'dusk'
  } else {
    const [r, g, b] = s.map((v) => v / count)
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const warm = r - b
    if (l < 0.13) kind = 'night'
    else if (warm > 0.06 || l < 0.32) kind = 'dusk'
    else kind = 'day'
  }

  if (kind === 'day') {
    return { kind, autoSky: true, horizon: 0.75, daylit: true, windows: 0.3, strings: 0.3 }
  }
  if (kind === 'dusk') {
    return {
      kind,
      autoSky: true,
      horizon: 0.6,
      duskPhoto: true,
      invent: true,
      glow: [0.12, 0.35],
      windows: 0.14,
    }
  }
  return { kind, autoSky: true, horizon: 0.6, haze: true, ground: [0.32, 0.33, 0.36], gain: 0.55 }
}

// A chosen file, shrunk for keeping, with its crop and look worked out.
export async function preparePhoto(file) {
  const img = await fileToImage(file)
  const s = Math.min(1, LONG_EDGE / Math.max(img.width, img.height))
  const canvas = Object.assign(document.createElement('canvas'), {
    width: Math.round(img.width * s),
    height: Math.round(img.height * s),
  })
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new Error('That image could not be saved.')

  const { crop, cropX } = autoCrop(canvas)
  return { blob, crop, cropX, look: autoLook(canvas, crop, cropX) }
}

// ---- storage ---------------------------------------------------------------

const DB = 'week-06-travel-clocks'
const STORE = 'places'

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function run(mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = fn(tx.objectStore(STORE))
        tx.oncomplete = () => {
          db.close()
          resolve(req.result)
        }
        tx.onerror = () => {
          db.close()
          reject(tx.error)
        }
      }),
  )
}

const loadRecords = () => run('readonly', (s) => s.getAll())
export const saveRecord = (rec) => run('readwrite', (s) => s.put(rec))
export const deleteRecord = (id) => run('readwrite', (s) => s.delete(id))

// Which card a photo belongs on: one card per city, matched by the city's
// name and its time zone -- so a Los Angeles photo joins the built-in "Los
// Angeles, California" card, not a new "Los Angeles, USA" one beside it.
export const cardKey = (name, timeZone) => `${name.split(',')[0].trim().toLowerCase()}|${timeZone}`

// A stored record as a photo the wall can draw, with the city it was taken in.
export function toPhoto(rec) {
  return {
    id: rec.id,
    image: URL.createObjectURL(rec.blob),
    crop: rec.crop,
    cropX: rec.cropX,
    look: 'auto', // worked out from the photo when it loads; see Tile
    mine: true,
    label: rec.label,
    timeZone: rec.timeZone,
    lat: rec.lat,
    lng: rec.lng,
  }
}

// Everything added so far, oldest first. Storage being unavailable (a private
// window, say) just means starting empty.
export async function loadMine() {
  try {
    const recs = await loadRecords()
    return recs.sort((a, b) => a.added - b.added).map(toPhoto)
  } catch {
    return []
  }
}

// Which photo each card was last showing, kept in this browser.
const SHOWN = 'week-06-shown-photo'
export function loadShown() {
  try {
    return JSON.parse(localStorage.getItem(SHOWN)) || {}
  } catch {
    return {}
  }
}
export function saveShown(shown) {
  try {
    localStorage.setItem(SHOWN, JSON.stringify(shown))
  } catch {
    // Not remembered, then; it still works for this visit.
  }
}
