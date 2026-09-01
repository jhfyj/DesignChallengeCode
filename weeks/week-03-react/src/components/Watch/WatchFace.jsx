const TICKS = Array.from({ length: 60 }, (_, i) => i)

function polar(radius, deg, center = { x: 150, y: 150 }) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: center.x + radius * Math.cos(rad), y: center.y + radius * Math.sin(rad) }
}

// Ticks/hands read light-on-gradient now that this is the permanent
// default face (see ListeningScreen) rather than sitting on a solid black
// dial — there's no dark variant to support anymore.
const HOUR_TICK = '#ffffff'
const MINUTE_TICK = 'rgba(255, 255, 255, 0.55)'
const HAND = '#ffffff'

const TICK_OUTER_R = 136

// The mic-wing platform (ListeningScreen) sits over the bottom of the dial
// and would otherwise just swallow whatever ticks fall under its solid
// white fill. Instead of letting that happen, ticks in its footprint are
// pulled inward to sit right on the wing's own top edge, so the ring reads
// as continuous — following the wing's silhouette rather than vanishing
// under it. Values are the wing SVG's actual top-boundary curve (its exact
// cubic-bezier control points, same asset as mic-wing-solid.svg) evaluated
// at each 6deg tick angle and converted into this component's radius units
// (matching ListeningScreen.css's button box: left 12.8cqw/top 75.18cqw/
// width 74.41cqw/height 26.08cqw, 1cqw = 3 of these units since the 300
// viewBox fills the full 100cqw screen). Ticks outside this angular range
// aren't touched at all — the wing doesn't reach them.
const WING_BOUNDARY_R = {
  132: 139.27,
  138: 133.74,
  144: 126.47,
  150: 116.25,
  156: 98.47,
  162: 85.82,
  168: 79.59,
  174: 76.49,
  180: 75.54,
  186: 76.5,
  192: 79.56,
  198: 85.55,
  204: 97.11,
  210: 112.81,
  216: 124.2,
  222: 132.19,
  228: 137.45,
}
// Small clearance so ticks sit visibly above the wing's edge rather than
// touching it exactly.
const WING_CLEARANCE = 3

// The hands pivot from here instead of the dial's true geometric center.
// The wave eats into the bottom of the visible dial without touching the
// top at all, so the true center (150,150) reads as too low — this instead
// balances the hands between the top of the ring and the highest point the
// wave reaches, i.e. the actual visible vertical span of the dial once the
// platform is accounted for, not the full circle.
const DIAL_TOP_Y = 150 - TICK_OUTER_R
const WAVE_PEAK_Y = 150 + WING_BOUNDARY_R[180]
// Nudged down a bit further from the exact midpoint — felt closer to right.
const HAND_CENTER_NUDGE = 25
const HAND_CENTER = { x: 150, y: (DIAL_TOP_Y + WAVE_PEAK_Y) / 2 + HAND_CENTER_NUDGE }

export default function WatchFace({ now }) {
  const hours = now.getHours() % 12
  const minutes = now.getMinutes()
  const seconds = now.getSeconds() + now.getMilliseconds() / 1000

  const hourAngle = hours * 30 + minutes * 0.5
  const minuteAngle = minutes * 6 + seconds * 0.1
  const secondAngle = seconds * 6

  return (
    <svg className="watch-face" viewBox="0 0 300 300" role="img" aria-label="Analog watch face">
      {/* minute/hour tick markers around the round dial */}
      {TICKS.map((i) => {
        const isHour = i % 5 === 0
        const deg = i * 6
        const tickLen = TICK_OUTER_R - (isHour ? 118 : 126)
        const wingR = WING_BOUNDARY_R[deg]
        const outerR = wingR !== undefined ? wingR - WING_CLEARANCE : TICK_OUTER_R
        const outer = polar(outerR, deg)
        const inner = polar(outerR - tickLen, deg)
        return (
          <line
            key={i}
            x1={outer.x}
            y1={outer.y}
            x2={inner.x}
            y2={inner.y}
            stroke={isHour ? HOUR_TICK : MINUTE_TICK}
            strokeWidth={isHour ? 3 : 1.4}
            strokeLinecap="round"
          />
        )
      })}

      {/* hour hand */}
      <line
        x1={HAND_CENTER.x}
        y1={HAND_CENTER.y}
        x2={polar(46, hourAngle, HAND_CENTER).x}
        y2={polar(46, hourAngle, HAND_CENTER).y}
        stroke={HAND}
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* minute hand */}
      <line
        x1={HAND_CENTER.x}
        y1={HAND_CENTER.y}
        x2={polar(66, minuteAngle, HAND_CENTER).x}
        y2={polar(66, minuteAngle, HAND_CENTER).y}
        stroke={HAND}
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* second hand */}
      <line
        x1={polar(15, secondAngle + 180, HAND_CENTER).x}
        y1={polar(15, secondAngle + 180, HAND_CENTER).y}
        x2={polar(72, secondAngle, HAND_CENTER).x}
        y2={polar(72, secondAngle, HAND_CENTER).y}
        stroke={HAND}
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <circle cx={HAND_CENTER.x} cy={HAND_CENTER.y} r="5" fill={HAND} />
      <circle cx={HAND_CENTER.x} cy={HAND_CENTER.y} r="2.2" fill="#0b0c10" />
    </svg>
  )
}
