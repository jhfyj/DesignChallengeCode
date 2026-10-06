// A photo, reimagined as a board of light dots.
//
// The photo is sampled once into one colour per dot. Every frame then decides,
// per dot, how much of that colour is light (bokeh, lamps, reflections) and
// how much is just the dark between them -- and the time of day decides what
// the dark becomes: nothing at night, sky and road by day.

export const COLS = 26
export const ROWS = 32

// The page colour. The idle grid and the night look are both drawn against it.
export const BG = [0.118, 0.118, 0.118]
const IDLE = [0.22, 0.22, 0.22]

// Sky and street by day; the dusk pair replaces them as the sun gets low.
const SKY_TOP = [0.2, 0.46, 0.86]
const SKY_LOW = [0.6, 0.78, 0.95]
const DUSK_TOP = [0.26, 0.27, 0.52]
const DUSK_LOW = [0.98, 0.6, 0.4]
const TOWER = [0.42, 0.47, 0.56]

// --- sampling -------------------------------------------------------------

const SUB = 4 // sub-samples per dot, per axis

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// One RGB triple per dot, 0..1. Each dot is a blend of its cell's average and
// its brightest sample: the average alone smears a small lamp into a brown
// smudge, the max alone turns every speck of noise into a light.
//
// crop is the [top, bottom] slice of the photo to keep and cropX the
// [left, right] one, as fractions of its height and width. The slice is fitted
// to the grid, so one a little off the grid's shape squashes slightly -- a lamp
// a few dots across never shows it.
export function sampleImage(img, crop = [0, 1], cropX = [0, 1]) {
  const w = COLS * SUB
  const h = ROWS * SUB
  const off = document.createElement('canvas')
  off.width = w
  off.height = h
  const ctx = off.getContext('2d', { willReadFrequently: true })

  const sx = img.width * cropX[0]
  const sw = img.width * (cropX[1] - cropX[0])
  const sy = img.height * crop[0]
  const sh = img.height * (crop[1] - crop[0])
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
  const px = ctx.getImageData(0, 0, w, h).data

  const out = new Float32Array(COLS * ROWS * 3)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let ar = 0, ag = 0, ab = 0
      let mr = 0, mg = 0, mb = 0, ml = -1
      for (let y = 0; y < SUB; y++) {
        for (let x = 0; x < SUB; x++) {
          const i = ((r * SUB + y) * w + c * SUB + x) * 4
          const pr = px[i] / 255, pg = px[i + 1] / 255, pb = px[i + 2] / 255
          ar += pr; ag += pg; ab += pb
          const l = luma(pr, pg, pb)
          if (l > ml) { ml = l; mr = pr; mg = pg; mb = pb }
        }
      }
      const n = SUB * SUB
      const o = (r * COLS + c) * 3
      out[o] = 0.55 * (ar / n) + 0.45 * mr
      out[o + 1] = 0.55 * (ag / n) + 0.45 * mg
      out[o + 2] = 0.55 * (ab / n) + 0.45 * mb
    }
  }
  return out
}

// --- time of day ------------------------------------------------------------

// Fractional local hour at a place, e.g. 21.5 for half past nine at night.
export function localHour(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (t) => Number(parts.find((p) => p.type === t).value)
  return get('hour') + get('minute') / 60 + get('second') / 3600
}

// day: 0 at night, 1 in full daylight, ramping over ~1.5h either side of the
// sun's edges. dusk peaks right at sunrise and sunset and is gone an hour out.
export function daylight(hour, sunrise = 7, sunset = 19) {
  const day =
    smoothstep(sunrise - 0.75, sunrise + 0.75, hour) *
    (1 - smoothstep(sunset - 0.75, sunset + 0.75, hour))
  const dusk = Math.min(
    1,
    Math.exp(-(((hour - sunrise) / 0.8) ** 2)) + Math.exp(-(((hour - sunset) / 0.8) ** 2)),
  )
  return { day, dusk }
}

// --- drawing ------------------------------------------------------------------

// What a place's photo needs to read right, and the defaults.
//   horizon  the lowest the sky can reach, as a fraction of the tile's height
//   glow     [lo, hi] on the light score: below lo a dot is dark, above hi it
//            is fully a light. The score weights brightness by colourfulness,
//            because in a dusk photo the grey sky can be brighter than a
//            floodlit wall -- what gives a lamp away is that it is warm or blue.
//   skyLift  how much brighter than the top edge a dot may be and still be
//            sky -- raise it for a cloudy sky with bright streaks in it
//   skyDrop  the same, darker; skyStep how much darker than its neighbour.
//            Raise both for a sunset sky that runs from pale to deep orange
//   duskPhoto  the photo was taken at sunset: its sky is the dusk look, and
//            however lit up it is, it is never read as lights
//   invent   add invented windows to the photo's real lights
//   haze     the night sky glows over the city (light pollution, fog), so a
//            bright sky dot is still sky rather than a light
//   towers   stand a made-up skyline in the daytime sky
//   ripple   run a wave through the dots below the horizon, for a wet street
//   ground   what the dark parts outside the sky become by day
//   gain     how much of the photo shows through the ground by day
//   daylit   the photo was taken by day. It then *is* the daytime look, and
//            the night is invented instead: there are no lamps to find in a
//            sunny photo, and its bright sky and glass would all read as one.
// and for an invented night only:
//   windows  share of plain facade dots that are lit windows
//   strings  how colourful a dot must be to become a string light
//   flood    floodlight red stone rather than giving it windows
//   promenade  a row of lamps along the horizon, for a waterfront
//   reflect  mirror the lights above the horizon into water below it
//   beacon   [x, y] of the aviation light as tile fractions; left out, it
//            goes on the highest point that isn't sky
//   lamps    [[x, y], ...] street lamps, as tile fractions
const LOOK = {
  horizon: 0.6,
  glow: [0.07, 0.35],
  skyLift: 0.16,
  skyDrop: 0.16,
  skyStep: 0.07,
  duskPhoto: false,
  invent: false,
  haze: false,
  towers: false,
  ripple: false,
  ground: [0.34, 0.35, 0.38],
  gain: 0.45,
  daylit: false,
  windows: 0.45,
  strings: 0.3,
  flood: false,
  promenade: false,
  reflect: false,
  beacon: null,
  lamps: [],
}

// Light colours for an invented night.
const WARM = [1, 0.78, 0.48]
const COOL = [0.8, 0.88, 1]
const FLOOD = [1, 0.64, 0.4]
const LAMP = [1, 0.7, 0.36]
const BEACON = [1, 0.16, 0.1]

// Blink behaviour per dot of an invented night.
const STEADY = 0
const WINDOW = 1 // now and then switches off for a while
const AVIATION = 2 // a red pulse, like the light on top of a mast
const STRING = 3 // festival lights: a gentle, quicker twinkle

// Per-dot constants that never change: a phase so no two dots breathe in step,
// which dots are sky, and (if asked for) the daytime skyline.
function buildStatics(colors, look) {
  const n = COLS * ROWS
  const phase = new Float32Array(n)
  for (let i = 0; i < n; i++) phase[i] = hash(i * 1.7 + 3.1)
  const sky = findSky(colors, look)

  // Towers stand on the horizon, each a few dots wide, with a lit-window
  // pattern that is just a stable hash per dot. They only replace sky.
  const tower = new Float32Array(n) // 0 = none, else window tint
  if (look.towers) {
    const base = Math.round(look.horizon * ROWS)
    let c = 0, k = 0
    while (c < COLS) {
      const width = 2 + Math.floor(hash(k * 9.3) * 4)
      const height = Math.round(ROWS * (0.08 + hash(k * 4.1 + 1) ** 1.6 * 0.3))
      for (let x = c; x < Math.min(COLS, c + width); x++) {
        for (let y = Math.max(0, base - height); y < base; y++) {
          const i = y * COLS + x
          if (sky[i]) tower[i] = 0.6 + 0.4 * hash(x * 13.1 + y * 7.7)
        }
      }
      c += width + (hash(k * 2.3) < 0.3 ? 1 : 0)
      k++
    }
  }
  const lights = look.daylit || look.invent ? inventNight(colors, sky, look) : null

  // Under a haze the glow sits on everything in a band, so a light is judged
  // against its own row's average rather than against black.
  const rowGlow = new Float32Array(ROWS)
  if (look.haze) {
    for (let r = 0; r < ROWS; r++) {
      let s = 0
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c
        s += lightScore(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2])
      }
      rowGlow[r] = s / COLS
    }
  }
  // For a photo read automatically: where its sky ends, so the daytime blue
  // runs its full gradient down to the skyline, and how much the foreground
  // needs lifting to read as daylight -- a sunset silhouette needs a lot.
  let skyBase = look.horizon
  let lift = 1
  if (look.autoSky) {
    let lowest = 0
    let sum = 0
    let k = 0
    for (let i = 0; i < n; i++) {
      if (sky[i]) lowest = Math.max(lowest, Math.floor(i / COLS) + 1)
      else {
        sum += luma(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2])
        k++
      }
    }
    skyBase = Math.max(0.2, lowest / ROWS)
    lift = Math.min(3.5, Math.max(1, 0.42 / Math.max(0.02, sum / Math.max(1, k))))
  }
  return { phase, sky, tower, lights, rowGlow, skyBase, lift }
}

// A night for a photo taken by day, read off what each dot is: anything
// strongly coloured (bunting, signs, awnings) becomes a string light in its
// own colour; grey and blue facades get windows, warm and cool; red stone is
// floodlit if the place asks; trees keep the odd lamp glimpsed through them.
// Then the place's extras: lamps along a waterfront, street lamps, an
// aviation light, and reflections of it all in the water below the horizon.
function inventNight(colors, sky, look) {
  const n = COLS * ROWS
  const rgb = new Float32Array(n * 3)
  const amt = new Float32Array(n)
  const blink = new Uint8Array(n)
  const hRow = Math.floor(look.horizon * ROWS)
  const set = (i, c, a, b = STEADY) => {
    rgb[i * 3] = c[0]; rgb[i * 3 + 1] = c[1]; rgb[i * 3 + 2] = c[2]
    amt[i] = a
    blink[i] = b
  }

  // Without water to reflect in, the whole photo is land and gets lights.
  const landRows = look.reflect ? hRow : ROWS
  let peak = -1
  for (let r = 0; r < landRows; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c
      if (sky[i]) continue
      if (peak < 0) peak = i
      const cr = colors[i * 3], cg = colors[i * 3 + 1], cb = colors[i * 3 + 2]
      const hi = Math.max(cr, cg, cb)
      const chroma = hi - Math.min(cr, cg, cb)
      const green = cg - Math.max(cr, cb)
      const red = cr - Math.max(cg, cb)
      const h = hash(i * 3.1 + 0.7)
      // A pennant is smaller than a dot, so its colour arrives diluted by the
      // wall behind it; the bar is set low enough to still catch it.
      if (chroma > look.strings && chroma / hi > 0.4) {
        const hue = [tint(cr / hi), tint(cg / hi), tint(cb / hi)]
        set(i, hue, 0.8 + 0.2 * h, STRING)
      } else if (green > 0.02) {
        if (h < 0.06) set(i, LAMP, 0.6)
      } else if (look.flood && red > 0.06) {
        set(i, FLOOD, 0.45 + 0.2 * h)
      } else if (h < look.windows && (!look.daylit || luma(cr, cg, cb) > 0.18)) {
        // Near-black in a sunny photo is a silhouette -- a tree against the
        // light, a lamppost -- not a wall with windows in it. (At sunset the
        // towers themselves are silhouettes, so there it doesn't apply.)
        set(i, hash(i * 5.3) < 0.55 ? WARM : COOL, 0.5 + 0.5 * hash(i * 8.9), WINDOW)
      }
    }
  }

  // The promenade along the water: a lamp every other dot.
  if (look.promenade && hRow > 0) {
    for (let c = 0; c < COLS; c += 2) set((hRow - 1) * COLS + c, LAMP, 0.9)
  }

  const cell = ([x, y]) =>
    Math.min(ROWS - 1, Math.round(y * (ROWS - 1))) * COLS +
    Math.min(COLS - 1, Math.round(x * (COLS - 1)))
  for (const at of look.lamps) set(cell(at), LAMP, 1)
  const beacon = look.beacon ? cell(look.beacon) : peak
  if (beacon >= 0) set(beacon, BEACON, 1, AVIATION)

  if (!look.reflect) return { rgb, amt, blink }

  // Reflections fade out over a few rows below the horizon.
  const span = Math.max(3, Math.round(ROWS * 0.16))
  for (let k = 0; k < span; k++) {
    const r = hRow + k
    const m = hRow - 1 - k
    if (r >= ROWS || m < 0) break
    for (let c = 0; c < COLS; c++) {
      const src = m * COLS + c
      if (!amt[src]) continue
      const i = r * COLS + c
      set(i, [rgb[src * 3], rgb[src * 3 + 1], rgb[src * 3 + 2]], amt[src] * 0.5 * (1 - k / span))
    }
  }
  return { rgb, amt, blink }
}

// The sky is grown down from the top edge: a dot joins if it is near the top
// row's colour, isn't fully a light, is above the horizon, and isn't a step
// darker than the neighbour it was reached from. Following colour rather than
// a straight horizon line is what keeps a dome or a hill that rises into the
// sky a building by day, instead of being painted over with blue. Only
// darkening stops the growth: a building against the sky is darker than it,
// while a cloud is brighter and still sky.
function findSky(colors, look) {
  if (look.autoSky) return segmentSky(colors).sky
  const sky = new Uint8Array(COLS * ROWS)
  const lastRow = Math.floor(look.horizon * ROWS)
  // How much brighter (up) and darker (down) than ref dot i is, per channel.
  const up = (i, ref) =>
    Math.max(colors[i * 3] - ref[0], colors[i * 3 + 1] - ref[1], colors[i * 3 + 2] - ref[2])
  // A sunset sky swings from teal to deep orange, which per channel looks
  // like darkening; only its brightness tells it from a building, so that is
  // what a sunset photo is measured by.
  const down = look.duskPhoto
    ? (i, ref) => luma(ref[0], ref[1], ref[2]) - luma(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2])
    : (i, ref) =>
        Math.max(ref[0] - colors[i * 3], ref[1] - colors[i * 3 + 1], ref[2] - colors[i * 3 + 2])
  const at = (i) => [colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]]
  // In a daytime photo nothing is a light, and a blue sky would score as one;
  // a sunset sky or a glowing city haze would too.
  const lit = (i) =>
    !look.daylit &&
    !look.duskPhoto &&
    !look.haze &&
    lightScore(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]) > look.glow[1]

  // The top row's median colour stands for the sky as a whole.
  const top = [0, 1, 2].map((ch) => {
    const vals = []
    for (let c = 0; c < COLS; c++) vals.push(colors[c * 3 + ch])
    vals.sort((a, b) => a - b)
    return vals[COLS >> 1]
  })
  const fits = (i) => !lit(i) && up(i, top) < look.skyLift && down(i, top) < look.skyDrop

  const queue = []
  for (let c = 0; c < COLS; c++) {
    if (fits(c)) {
      sky[c] = 1
      queue.push(c)
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]
    const r = Math.floor(i / COLS), c = i % COLS
    const next = [
      c > 0 ? i - 1 : -1,
      c < COLS - 1 ? i + 1 : -1,
      r < lastRow ? i + COLS : -1,
      r > 0 ? i - COLS : -1,
    ]
    for (const j of next) {
      if (j < 0 || sky[j] || !fits(j) || down(j, at(i)) > look.skyStep) continue
      sky[j] = 1
      queue.push(j)
    }
  }
  return sky
}

// The sky of a photo nobody has tuned by hand, any colour it happens to be:
// each column is walked down from the top for as long as it stays smooth,
// and stops at the first hard edge -- a roofline, a tree, a dark band. A
// cloud or the sun is brighter than the sky around it and doesn't stop the
// walk; only darkening or busy texture does. The column heights are then
// median-smoothed, so a lone mast or a stray noisy dot doesn't notch the
// skyline. Returns the mask and the heights (in rows).
export function segmentSky(colors) {
  const at = (r, c) => (r * COLS + c) * 3
  const L = (r, c) => {
    const i = at(r, c)
    return luma(colors[i], colors[i + 1], colors[i + 2])
  }
  const diff = (a, b) =>
    Math.max(
      Math.abs(colors[a] - colors[b]),
      Math.abs(colors[a + 1] - colors[b + 1]),
      Math.abs(colors[a + 2] - colors[b + 2]),
    )
  // How busy a dot is: how far it sits from its left and right neighbours.
  const texture = (r, c) => {
    const i = at(r, c)
    const a = c > 0 ? diff(i, at(r, c - 1)) : 0
    const b = c < COLS - 1 ? diff(i, at(r, c + 1)) : 0
    return Math.min(a || b, b || a)
  }
  const maxRows = Math.round(ROWS * 0.85)

  const raw = new Array(COLS)
  for (let c = 0; c < COLS; c++) {
    let h = 0
    let sum = 0
    if (texture(0, c) < 0.2) {
      sum = L(0, c)
      h = 1
      while (h < maxRows) {
        const cur = L(h, c)
        const prev = L(h - 1, c)
        const mean = sum / h
        const darker = prev - cur
        const busy = texture(h, c)
        // A hard edge into something darker. A sunset sky darkens too as it
        // runs into orange, but gently and evenly across, so a smaller drop
        // only counts where the row is also uneven.
        if (darker > 0.12 || (darker > 0.06 && busy > 0.06)) break
        if (cur < mean * 0.45 && mean > 0.08) break // or a slow slide into it
        if (busy > 0.16 && cur < mean + 0.05) break // leaves, windows
        // In a dark sky, a sudden step up into something warm and colourful
        // is a lit facade. A cloud brightens too, but it's grey; a blue sky
        // under a dark top edge (a vignette, a branch) is blue.
        const i = at(h, c)
        const hi = Math.max(colors[i], colors[i + 1], colors[i + 2])
        const chroma = hi - Math.min(colors[i], colors[i + 1], colors[i + 2])
        if (mean < 0.3 && cur - prev > 0.1 && chroma > 0.2 && colors[i + 2] < hi) break
        if (cur > mean + 0.15 && busy > 0.1) break
        sum += cur
        h++
      }
    }
    raw[c] = h
  }

  const heights = raw.map((_, c) => {
    const win = []
    for (let k = -2; k <= 2; k++) win.push(raw[Math.min(COLS - 1, Math.max(0, c + k))])
    return win.sort((a, b) => a - b)[2]
  })

  const sky = new Uint8Array(COLS * ROWS)
  for (let c = 0; c < COLS; c++) for (let r = 0; r < heights[c]; r++) sky[r * COLS + c] = 1
  return { sky, heights }
}

export class DotField {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.w = 0
    this.h = 0
    this.dpr = 1
    this.colors = null // sampled photo, or null for an idle slot
    this.look = LOOK
    this.statics = null
  }

  setPlace(colors, look) {
    this.colors = colors
    this.look = { ...LOOK, ...look }
    this.statics = buildStatics(colors, this.look)
  }

  resize(w, h, dpr) {
    if (w === this.w && h === this.h && dpr === this.dpr) return false
    this.w = w
    this.h = h
    this.dpr = dpr
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    return true
  }

  // t is seconds, only used for the drift. light is { day, dusk }.
  // 0 to 1: how much the card is flaring; see draw.
  flare = 0

  draw(t, light) {
    const { ctx, w, h, dpr } = this
    if (!w || !h) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    // Transparent, so the dots sit straight on the panel behind them.
    ctx.clearRect(0, 0, w, h)

    const pitch = Math.min(w / COLS, h / ROWS)
    const ox = (w - pitch * COLS) / 2 + pitch / 2
    const oy = (h - pitch * ROWS) / 2 + pitch / 2

    if (!this.colors) {
      ctx.fillStyle = css(IDLE)
      ctx.beginPath()
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = ox + c * pitch, y = oy + r * pitch
          ctx.moveTo(x + pitch * 0.36, y)
          ctx.arc(x, y, pitch * 0.36, 0, Math.PI * 2)
        }
      }
      ctx.fill()
      return
    }

    const { day, dusk } = light
    const night = 1 - day
    const look = this.look
    const { phase, sky, tower, lights, rowGlow, skyBase, lift: dayLift } = this.statics
    const horizonRow = look.horizon * ROWS
    const [lo, hi] = look.glow
    const ground = look.ground
    const top = mix3(SKY_TOP, DUSK_TOP, dusk)
    const low = mix3(SKY_LOW, DUSK_LOW, dusk)
    const glows = []
    const col = [0, 0, 0]
    const fl = this.flare

    for (let r = 0; r < ROWS; r++) {
      const v = r / (ROWS - 1)
      const below = r >= horizonRow
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c
        const p = phase[i]
        let sr = this.colors[i * 3], sg = this.colors[i * 3 + 1], sb = this.colors[i * 3 + 2]

        // Colours wander: a slow hue swing per dot, and a brightness breath
        // that a wet street below the horizon ripples through as a wave.
        const ang = 0.22 * Math.sin(t * 0.31 + p * 6.283 + c * 0.12)
        hueRotate(sr, sg, sb, ang, col)
        sr = col[0]; sg = col[1]; sb = col[2]
        let breath = 1 + 0.1 * Math.sin(t * (0.5 + p * 0.7) + p * 40)
        if (below && look.ripple) {
          breath += 0.14 * Math.sin(t * 1.4 - r * 0.8 + Math.sin(c * 0.5 + t * 0.4) * 1.5)
        }

        // How much of this dot is a light rather than the dark around it.
        // Sky is never a light, however bright the photo's clouds are.
        let amt = 0, nr = IDLE[0], ng = IDLE[1], nb = IDLE[2]
        if (!look.daylit) {
          const score = lightScore(sr, sg, sb) - rowGlow[r] * 0.7
          amt = sky[i] ? 0 : smoothstep(lo, hi, score * breath)

          // Night: the light alone, and the rest falls back to the idle grid.
          // Brightening is done on the hue, not the channels -- scaling RGB
          // straight up clips every lamp to the same white.
          const m = Math.max(sr, sg, sb, 1e-3)
          const lift = Math.min(1, m * 1.15 * breath)
          nr = mix(IDLE[0], tint(sr / m) * lift, amt)
          ng = mix(IDLE[1], tint(sg / m) * lift, amt)
          nb = mix(IDLE[2], tint(sb / m) * lift, amt)
          // A hazy sky isn't a light, but it does glow: keep a faint band.
          if (look.haze && sky[i]) {
            nr = mix(IDLE[0], sr, 0.3); ng = mix(IDLE[1], sg, 0.3); nb = mix(IDLE[2], sb, 0.3)
          }
        }
        if (lights) {
          // An invented night: the light was decided up front, and only its
          // blinking happens here. Windows go dark for a stretch now and then,
          // each on its own schedule; the aviation light pulses. Where the
          // photo has a real light of its own, the brighter of the two wins.
          let a = lights.amt[i]
          if (lights.blink[i] === WINDOW && hash(i * 3.3 + Math.floor(t * 0.04 + p * 10)) > 0.85) a = 0
          if (lights.blink[i] === AVIATION) a *= (t * 0.7 + p) % 1 < 0.25 ? 1 : 0.2
          if (lights.blink[i] === STRING) a *= 0.7 + 0.3 * Math.sin(t * 2.2 + p * 30)
          a = Math.min(1, a * breath)
          if (a > amt) {
            amt = a
            const lift = Math.min(1, breath)
            nr = mix(IDLE[0], lights.rgb[i * 3] * lift, amt)
            ng = mix(IDLE[1], lights.rgb[i * 3 + 1] * lift, amt)
            nb = mix(IDLE[2], lights.rgb[i * 3 + 2] * lift, amt)
          }
        }

        // Day: the sky turns blue (with towers standing in it, if the place
        // wants them), and everything else is the photo brought up into
        // daylight over the place's ground colour. The lights are still
        // there, just outshone.
        let dr, dg, db
        // A photo read automatically always gets a blue sky by day, whatever
        // colour its own was; only its foreground is kept.
        const ownSky = look.daylit && !(look.autoSky && sky[i])
        if (ownSky) {
          // The photo already is the day. Dusk only warms it: the sky leans
          // to the sunset colours, everything else dims a little and warms.
          if (sky[i]) {
            const tv = smoothstep(0, look.horizon, v)
            const k = dusk * 0.75
            dr = mix(sr, mix(top[0], low[0], tv), k)
            dg = mix(sg, mix(top[1], low[1], tv), k)
            db = mix(sb, mix(top[2], low[2], tv), k)
          } else {
            const f = 1 - 0.3 * dusk
            dr = sr * f + dusk * 0.1
            dg = sg * f + dusk * 0.04
            db = sb * f
          }
        } else if (sky[i]) {
          const tv = smoothstep(0, skyBase, v)
          dr = mix(top[0], low[0], tv)
          dg = mix(top[1], low[1], tv)
          db = mix(top[2], low[2], tv)
          const tw = tower[i]
          if (tw) {
            const shade = mix(1, 0.55, dusk)
            dr = TOWER[0] * tw * shade + dusk * 0.12
            dg = TOWER[1] * tw * shade + dusk * 0.06
            db = TOWER[2] * tw * shade
          }
          const shimmer = 0.03 * Math.sin(t * 0.2 + c * 0.35 + r * 0.2)
          dr += shimmer; dg += shimmer; db += shimmer
        } else if (look.autoSky) {
          // An automatic dusk or night photo by day: its foreground in its own
          // colours, brought up to daylight, with a little ground under it.
          const k = Math.min(1, 1 - 0.25 * dusk)
          dr = mix(ground[0], Math.min(1, sr * dayLift), 0.8) * k + dusk * 0.08
          dg = mix(ground[1], Math.min(1, sg * dayLift), 0.8) * k + dusk * 0.04
          db = mix(ground[2], Math.min(1, sb * dayLift), 0.8) * k
        } else {
          const depth = below ? (v - look.horizon) / (1 - look.horizon) : 0
          const fade = 1 - 0.35 * depth
          dr = ground[0] * fade + sr * look.gain + dusk * 0.08
          dg = ground[1] * fade + sg * look.gain + dusk * 0.04
          db = ground[2] * fade + sb * look.gain + 0.03
        }
        const keep = look.daylit ? 0 : amt * 0.4
        dr = mix(dr, sr * 1.2, keep)
        dg = mix(dg, sg * 1.2, keep)
        db = mix(db, sb * 1.2, keep)

        // A sunset photo is its own dusk: as the sun sets, the sky turns into
        // the photo's sky and the city into the photo's silhouette, from
        // either side of the day/night blend.
        if (look.duskPhoto && dusk > 0) {
          if (sky[i]) {
            nr = mix(nr, sr, dusk); ng = mix(ng, sg, dusk); nb = mix(nb, sb, dusk)
          }
          if (amt < 0.5) {
            dr = mix(dr, sr, dusk); dg = mix(dg, sg, dusk); db = mix(db, sb, dusk)
          }
        }

        let R = mix(nr, dr, day), G = mix(ng, dg, day), B = mix(nb, db, day)

        // A flare (the card just jumped to from the map): colours a touch
        // richer, and every dot haloed in its own colour, the lit ones most.
        if (fl > 0) {
          const L = (R + G + B) / 3
          const s = 1 + 0.3 * fl
          R = Math.min(1, Math.max(0, L + (R - L) * s))
          G = Math.min(1, Math.max(0, L + (G - L) * s))
          B = Math.min(1, Math.max(0, L + (B - L) * s))
        }

        // Dark dots shrink at night so the lit ones read as points of light;
        // by day every dot is full and the board reads as a picture.
        const rad = pitch * mix(0.22 + 0.17 * amt, 0.4, day)
        const x = ox + c * pitch, y = oy + r * pitch
        ctx.fillStyle = css3(R, G, B)
        ctx.beginPath()
        ctx.arc(x, y, rad, 0, Math.PI * 2)
        ctx.fill()

        let g = amt * night
        if (fl > 0) {
          const m = Math.max(R, G, B)
          g += fl * (0.2 + 1.8 * m * m) * (1 - 0.7 * day)
        }
        if (g > 0.25) glows.push(x, y, g, R, G, B)
      }
    }

    // Bloom, added on top so overlapping halos build into bokeh.
    ctx.globalCompositeOperation = 'lighter'
    for (let k = 0; k < glows.length; k += 6) {
      const x = glows[k], y = glows[k + 1], g = glows[k + 2]
      ctx.fillStyle = css3(glows[k + 3], glows[k + 4], glows[k + 5], 0.07 * g)
      ctx.beginPath()
      ctx.arc(x, y, pitch * 1.25, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = css3(glows[k + 3], glows[k + 4], glows[k + 5], 0.1 * g)
      ctx.beginPath()
      ctx.arc(x, y, pitch * 0.65, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }
}

// --- helpers -----------------------------------------------------------------

function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Brightness, counted up for colour: a warm window or a blue lantern scores
// well above a neutral grey cloud of the same brightness.
function lightScore(r, g, b) {
  const chroma = Math.max(r, g, b) - Math.min(r, g, b)
  return luma(r, g, b) * (0.5 + chroma * 2)
}

// Deepen a hue (a channel as a fraction of the brightest one) so the bokeh
// stays coloured rather than drifting to cream.
function tint(v) {
  return Math.max(0, 1 - (1 - v) * 1.35)
}

function hueRotate(r, g, b, a, out) {
  const cs = Math.cos(a), sn = Math.sin(a)
  out[0] = r * (0.299 + 0.701 * cs + 0.168 * sn) + g * (0.587 - 0.587 * cs + 0.33 * sn) + b * (0.114 - 0.114 * cs - 0.497 * sn)
  out[1] = r * (0.299 - 0.299 * cs - 0.328 * sn) + g * (0.587 + 0.413 * cs + 0.035 * sn) + b * (0.114 - 0.114 * cs + 0.292 * sn)
  out[2] = r * (0.299 - 0.3 * cs + 1.25 * sn) + g * (0.587 - 0.588 * cs - 1.05 * sn) + b * (0.114 + 0.886 * cs - 0.203 * sn)
}

function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function mix(a, b, t) {
  return a + (b - a) * t
}

function mix3(a, b, t) {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]
}

function to255(v) {
  return Math.round(Math.min(1, Math.max(0, v)) * 255)
}

function css(c) {
  return css3(c[0], c[1], c[2])
}

function css3(r, g, b, a = 1) {
  return `rgba(${to255(r)},${to255(g)},${to255(b)},${a})`
}
