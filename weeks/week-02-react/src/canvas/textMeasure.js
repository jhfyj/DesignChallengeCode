// Estimates a text block's rendered pixel height (greedy word-wrap against a
// box width) so shuffleEngine.js can decide whether two stacked text blocks
// would actually collide before allowing them to share a grid cell. Isolated
// in its own file since it's the only place in the shuffle feature that
// touches a <canvas> 2D context (measureText), keeping shuffleEngine.js
// itself easy to reason about without a DOM/canvas dependency.

let measureCanvas = null

function measureTextWidth(text, fontSizePx, fontFamily, fontWeight) {
  if (!measureCanvas) measureCanvas = document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`
  return ctx.measureText(text).width
}

function countWrappedLines(text, fontSizePx, fontFamily, fontWeight, boxWidthPx) {
  if (!text) return 1
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return 1

  let lines = 1
  let lineWidth = 0
  const spaceWidth = measureTextWidth(' ', fontSizePx, fontFamily, fontWeight)

  for (const word of words) {
    const wordWidth = measureTextWidth(word, fontSizePx, fontFamily, fontWeight)
    const nextWidth = lineWidth === 0 ? wordWidth : lineWidth + spaceWidth + wordWidth
    if (nextWidth > boxWidthPx && lineWidth > 0) {
      lines += 1
      lineWidth = wordWidth
    } else {
      lineWidth = nextWidth
    }
  }
  return lines
}

export function estimateTextBlockHeight({ text, fontFamily, fontWeight = 400, fontSize, boxWidthPx, lineHeight = 1.15 }) {
  const lines = countWrappedLines(text, fontSize, fontFamily, fontWeight, boxWidthPx)
  return lines * fontSize * lineHeight
}

// The widest single word in the text at this font — never split across
// lines (Swiss mode's word-break: keep-all, and countWrappedLines above,
// both already assume a word is one unbreakable unit), so a box narrower
// than this will always overflow. Callers use it to size the box wide
// enough in the first place rather than relying on that overflow being
// merely visible instead of clipped.
export function widestWordWidth(text, fontSizePx, fontFamily, fontWeight = 400) {
  const words = (text || '').split(/\s+/).filter(Boolean)
  if (words.length === 0) return 0
  return Math.max(...words.map((w) => measureTextWidth(w, fontSizePx, fontFamily, fontWeight)))
}
