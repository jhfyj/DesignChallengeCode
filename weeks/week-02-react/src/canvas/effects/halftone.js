// Real per-pixel halftone: source pixels are sampled on a grid and re-drawn
// as variable-radius dots (darker source = bigger dot), the same "screen"
// technique print halftones use. This can't be done as a live CSS filter
// (see ImageElement.jsx's dither comment) — it reads actual pixel data once
// and bakes the result into a new image, cached by source URL + settings.
// Brightness/contrast are applied to luminance BEFORE the dot radius/tint are
// derived from it (like adjusting levels before screening a print), rather
// than as a CSS filter layered on top of the finished dots — so they still
// visibly affect which areas go big/dark vs. small/light.
const CELL_SIZE = 7 // dot pitch, in output pixels
const MAX_DIMENSION = 900 // cap processing size for perf
const TINT_COLOR = [0x3f, 0x6c, 0xff] // brand blue, mixed into midtone dots

const cache = new Map()

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

function luminance(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

function mix(a, b, t) {
  return a + (b - a) * t
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n))
}

// brightness/contrast: 0-100, 50 = neutral (matches photoFilter's CSS-filter
// formula in ImageElement.jsx, so the same slider position means the same
// thing in either mode). tintStrength: 0-100, how much of TINT_COLOR shows at
// the peak midtone — 0 is a plain black/white halftone, 100 is the full
// gradient from black through the tint color back to white.
export async function getHalftoneDataUrl(sourceUrl, { brightness = 50, contrast = 50, tintStrength = 100 } = {}) {
  if (!sourceUrl) return sourceUrl
  const cacheKey = `${sourceUrl}|${brightness}|${contrast}|${tintStrength}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const img = await loadImage(sourceUrl)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))

  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = width
  sourceCanvas.height = height
  const sourceCtx = sourceCanvas.getContext('2d')
  sourceCtx.drawImage(img, 0, 0, width, height)
  const { data } = sourceCtx.getImageData(0, 0, width, height)

  const outCanvas = document.createElement('canvas')
  outCanvas.width = width
  outCanvas.height = height
  const ctx = outCanvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  const maxRadius = CELL_SIZE * 0.68
  const brightnessFactor = brightness / 100 + 0.5
  const contrastFactor = contrast / 100 + 0.5
  const tintAmount0to1 = tintStrength / 100

  for (let cy = 0; cy < height; cy += CELL_SIZE) {
    const cellH = Math.min(CELL_SIZE, height - cy)
    for (let cx = 0; cx < width; cx += CELL_SIZE) {
      const cellW = Math.min(CELL_SIZE, width - cx)
      let total = 0
      let count = 0
      for (let y = cy; y < cy + cellH; y++) {
        const rowStart = y * width * 4
        for (let x = cx; x < cx + cellW; x++) {
          const i = rowStart + x * 4
          total += luminance(data[i], data[i + 1], data[i + 2])
          count++
        }
      }
      let lum = count ? total / count : 1
      lum = lum * brightnessFactor
      lum = (lum - 0.5) * contrastFactor + 0.5
      lum = clamp01(lum)

      const radius = maxRadius * Math.pow(1 - lum, 0.85)
      if (radius < 0.4) continue

      // Blue tint peaks at midtones and fades out toward pure black/white —
      // a gradient from 0% (black/white edges) to tintAmount0to1 (midtone
      // peak), so the strength slider scales that whole gradient up/down
      // rather than applying a flat tint everywhere.
      const tintAmount = Math.max(0, 1 - Math.abs(lum - 0.5) * 2.2) * tintAmount0to1
      const r = Math.round(mix(0, TINT_COLOR[0], tintAmount))
      const g = Math.round(mix(0, TINT_COLOR[1], tintAmount))
      const b = Math.round(mix(0, TINT_COLOR[2], tintAmount))

      ctx.beginPath()
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
      ctx.arc(cx + cellW / 2, cy + cellH / 2, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const dataUrl = outCanvas.toDataURL('image/png')
  cache.set(cacheKey, dataUrl)
  return dataUrl
}
