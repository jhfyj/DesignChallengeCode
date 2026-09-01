// Small helpers shared by the listening screen's reactive waveform, plus
// the geometry both ListeningScreen and RingScreen have to agree on exactly
// for the wave-to-ring morph to hand off without a visible jump.

const SIZE = 300
const CENTER = SIZE / 2
// Same radius as ProcessingScreen's own arc — see RADIUS there.
export const RING_RADIUS = 128
// How much space the flat line leaves on each side — same inset the ring
// itself sits at (CENTER - RING_RADIUS), not a separately-chosen number, so
// the resting line reads as having the same margin as everything else on
// this screen instead of running edge to edge. Deriving it this way also
// means the line's own right end lands exactly on the ring's own rightmost
// point, so the morph can hand off there with no gap or jump to close.
export const LINE_MARGIN = CENTER - RING_RADIUS
// The flat line spans the viewBox width minus that margin on each side.
export const LINE_LENGTH = SIZE - 2 * LINE_MARGIN

// The morph ends with the whole line laid along the ring, and the line
// never changes length, so the arc it ends up covering is exactly as long
// as the line itself — this is derived, not chosen. RingScreen's spinner
// uses the same span so the shape it picks up is the shape the morph left.
export const RING_SPIN_SPAN_DEG = (LINE_LENGTH / RING_RADIUS) * (180 / Math.PI)

// The path the line's right end (the head) travels, as a lookup from
// distance-along-the-track to an [x, y] position. Distance 0 is where the
// head starts, sitting exactly on the ring (see LINE_MARGIN above) at the
// ring's own rightmost point. Negative distances run back along the
// original flat line — which is what keeps the part the head hasn't swept
// yet perfectly straight instead of bending early — and positive distances
// trace the ring itself, starting from that same point.
//
// Every point of the line is placed at a fixed distance behind the head on
// this one track, which is what makes the whole thing behave like a snake:
// the body follows exactly where the head has already been, and the line's
// length is preserved for free (the points are, by construction, spaced by
// arc length) rather than being corrected for after the fact.
export function buildMorphTrack() {
  function pointAt(distance) {
    if (distance <= 0) return [SIZE - LINE_MARGIN + distance, CENTER]
    const theta = distance / RING_RADIUS
    return [CENTER + RING_RADIUS * Math.cos(theta), CENTER + RING_RADIUS * Math.sin(theta)]
  }

  return {
    pointAt,
    // How far the head travels in total: exactly the line's own length, at
    // which point the tail has just reached distance 0 and the whole line
    // is lying on the ring.
    headTravel: LINE_LENGTH,
  }
}


// A single soft bump centered at `center`, `height` tall and `width` wide —
// the building block each wave line is made of several of, summed together.
export function gaussian(x, center, height, width) {
  return height * Math.exp(-((x - center) ** 2) / (2 * width * width))
}

// Turns a flat list of [x, y] points into a smooth SVG path — each segment
// is a quadratic curve through the midpoint between two points, which is
// enough to round off a sampled waveform without the jagged look a plain
// polyline (straight L-to-L segments) would have.
export function smoothPath(points, { close = false } = {}) {
  if (points.length === 0) return ''
  if (points.length === 1) return `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`

  let d = `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)} `
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    const mx = (x0 + x1) / 2
    const my = (y0 + y1) / 2
    d += `Q${x0.toFixed(2)},${y0.toFixed(2)} ${mx.toFixed(2)},${my.toFixed(2)} `
  }
  const [lx, ly] = points[points.length - 1]
  d += `L${lx.toFixed(2)},${ly.toFixed(2)} `
  if (close) d += 'Z'
  return d
}
