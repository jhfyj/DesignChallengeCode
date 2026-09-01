// The white rim and every protrusion growing out of it, described as ONE
// closed curve rather than a ring with separate pieces layered on top of it.
//
// Everything here works in polar coordinates around the dial's own center:
// the boundary is a single radius-per-angle profile r(theta), where r ==
// RIM_RADIUS means "this stretch is plain rim" and r < RIM_RADIUS means "a
// protrusion bites in this far here." A protrusion isn't a shape sitting on
// the rim under that description — it's the same curve, locally dented
// inward. That's what makes the morph below possible at all: two lobes
// becoming one is just the profile changing, so the rim can't detach from
// the protrusions partway through, because there is nothing to detach.
//
// Interpolating in polar (rather than lerping x/y) is load-bearing for the
// same reason: any stretch where the radius is RIM_RADIUS at both ends of
// the morph stays at exactly RIM_RADIUS throughout, so the rim stays a
// true circle for the whole animation instead of denting inward along the
// straight-line chord between two points that both sit on it.

export const FRAME = 1072
const CQ = 10.72

// The dial circle every Figma frame shares — 35px inset from the 1072px
// frame, so it's centered on the frame's own center.
const RIM_INSET = 3.265 * CQ
const RIM_DIAMETER = 93.47 * CQ
export const RIM_CENTER = RIM_INSET + RIM_DIAMETER / 2
export const RIM_RADIUS = RIM_DIAMETER / 2

// Each direction wing's on-screen box origin — its own CSS left/top (see
// .direction-card__wing--decline/--accept in DirectionCard.css). The boxes
// are exactly 400x381.5 Figma-px, so within a wing 1 local unit == 1
// frame unit and the box origin is the whole transform.
const DECLINE_ORIGIN = { x: 6.063 * CQ, y: 65.42 * CQ }
const ACCEPT_ORIGIN = { x: 56.63 * CQ, y: 65.89 * CQ }
export const DECLINE_ORIGIN_TRANSFORM = `translate(${DECLINE_ORIGIN.x} ${DECLINE_ORIGIN.y})`
export const ACCEPT_ORIGIN_TRANSFORM = `translate(${ACCEPT_ORIGIN.x} ${ACCEPT_ORIGIN.y})`

// The rim circle re-expressed in each wing's own local space, so the wing
// outlines below can be welded onto it.
const DECLINE_CIRCLE = { cx: RIM_CENTER - DECLINE_ORIGIN.x, cy: RIM_CENTER - DECLINE_ORIGIN.y }
const ACCEPT_CIRCLE = { cx: RIM_CENTER - ACCEPT_ORIGIN.x, cy: RIM_CENTER - ACCEPT_ORIGIN.y }

// Moves `point` onto the rim circle, along the direction it already sits
// from the circle's center.
function ontoCircle(circle, radius, point) {
  const dx = point.x - circle.cx
  const dy = point.y - circle.cy
  const dist = Math.hypot(dx, dy)
  return { x: circle.cx + (dx / dist) * radius, y: circle.cy + (dy / dist) * radius }
}

// The unit tangent of `circle` at `point` (assumed to sit on the circle).
// There are two, one per direction around the circle; `signHint` (a vector
// roughly pointing the way travel should go) picks which.
function tangentAt(circle, point, signHint) {
  const dx = point.x - circle.cx
  const dy = point.y - circle.cy
  const dist = Math.hypot(dx, dy)
  let tx = -dy / dist
  let ty = dx / dist
  if (tx * signHint.x + ty * signHint.y < 0) {
    tx = -tx
    ty = -ty
  }
  return { x: tx, y: ty }
}

// Re-aims a cubic's start handle along the rim's own tangent, keeping its
// original length. A shared point alone only makes the wing's curve and the
// rim *touch*; matching the tangent is what makes the join read as one
// continuous line growing out of the rim rather than two curves meeting at
// a corner.
function tangentStartHandle(circle, start, originalHandle) {
  const handleVector = { x: originalHandle.x - start.x, y: originalHandle.y - start.y }
  const len = Math.hypot(handleVector.x, handleVector.y)
  const dir = tangentAt(circle, start, handleVector)
  return { x: start.x + dir.x * len, y: start.y + dir.y * len }
}

// Same, for a curve that arrives at a point on the rim rather than leaving
// from one.
function tangentEndHandle(circle, end, originalHandle) {
  const arrivalVector = { x: end.x - originalHandle.x, y: end.y - originalHandle.y }
  const len = Math.hypot(arrivalVector.x, arrivalVector.y)
  const dir = tangentAt(circle, end, arrivalVector)
  return { x: end.x - dir.x * len, y: end.y - dir.y * len }
}

// Each wing's raw Figma "Subtract" path, split into the outer silhouette
// and the icon (X / arrow) cutout. The two are kept apart because the
// profile sampling below has to trace the silhouette only — the icon is a
// nonzero-winding hole, and sampling through it would read as "the
// protrusion stops here" and put a notch in the profile.
const DECLINE_RIM_POINT = ontoCircle(DECLINE_CIRCLE, RIM_RADIUS, { x: 0, y: 0 })
const DECLINE_C1 = tangentStartHandle(DECLINE_CIRCLE, DECLINE_RIM_POINT, { x: 47.5, y: 118.5 })
export const DECLINE_OUTER_D = `M${DECLINE_RIM_POINT.x} ${DECLINE_RIM_POINT.y}C${DECLINE_C1.x} ${DECLINE_C1.y} 119.419 73.1333 198.5 101C356 156.5 289 316 400 328.5L252 381.5L0 127.5L${DECLINE_RIM_POINT.x} ${DECLINE_RIM_POINT.y}Z`
export const DECLINE_ICON_D =
  'M217.438 170.562C215.907 169.032 213.426 169.032 211.896 170.562L197.45 185.009C194.717 187.742 190.283 187.742 187.55 185.009L173.104 170.562C171.574 169.032 169.093 169.032 167.562 170.562C166.032 172.093 166.032 174.574 167.562 176.104L182.009 190.551C184.742 193.284 184.742 197.717 182.009 200.45L167.562 214.896C166.032 216.426 166.032 218.907 167.562 220.438C169.093 221.968 171.574 221.968 173.104 220.438L187.55 205.991C190.283 203.258 194.717 203.258 197.45 205.991L211.896 220.438C213.426 221.968 215.907 221.968 217.438 220.438C218.968 218.907 218.968 216.426 217.438 214.896L202.991 200.45C200.258 197.717 200.258 193.284 202.991 190.551L217.438 176.104C218.968 174.574 218.968 172.093 217.438 170.562Z'

const ACCEPT_RIM_POINT = ontoCircle(ACCEPT_CIRCLE, RIM_RADIUS, { x: 400, y: 0 })
const ACCEPT_C2 = tangentEndHandle(ACCEPT_CIRCLE, ACCEPT_RIM_POINT, { x: 352.5, y: 118.5 })
export const ACCEPT_OUTER_D = `M400 127.5L148 381.5L0 328.5C111 316 44 156.5 201.5 101C280.581 73.1333 ${ACCEPT_C2.x} ${ACCEPT_C2.y} ${ACCEPT_RIM_POINT.x} ${ACCEPT_RIM_POINT.y}L400 127.5Z`
export const ACCEPT_ICON_D =
  'M209.829 159.089C208.267 157.527 205.734 157.527 204.172 159.089C202.61 160.651 202.61 163.183 204.172 164.745L225.926 186.5H178.417C176.208 186.5 174.417 188.291 174.417 190.5C174.417 192.709 176.208 194.5 178.417 194.5H225.927L204.172 216.255C202.61 217.817 202.61 220.35 204.172 221.912C205.734 223.474 208.267 223.474 209.829 221.912L238.412 193.329C239.974 191.767 239.974 189.234 238.412 187.672L209.829 159.089Z'

// The listening screen's single mic protrusion — same path data as
// mic-wing-solid.svg, in its own 676x236.897 viewBox.
export const MIC_WING_D =
  'M212 44.3818C291.5 -13.6188 387 -18.6182 470 52.3818C536.4 109.182 636.667 71.0484 676 35.8818C617.333 112.215 532 238.481 522 236.882C512 235.282 200.5 189.882 46 167.382L0 28.3818C86.4999 104.381 174 72.1054 212 44.3818Z'
const MIC_BOX = { left: 12.8 * CQ, top: 75.18 * CQ, width: 74.41 * CQ, height: 26.08 * CQ }
const MIC_VIEWBOX = { width: 676, height: 236.897 }
const MIC_SCALE = { x: MIC_BOX.width / MIC_VIEWBOX.width, y: MIC_BOX.height / MIC_VIEWBOX.height }
export const MIC_WING_TRANSFORM = `translate(${MIC_BOX.left} ${MIC_BOX.top}) scale(${MIC_SCALE.x} ${MIC_SCALE.y})`

// How finely the boundary is sampled around the full circle. 1440 is a
// quarter-degree per step — fine enough that the near-tangent stretch where
// a protrusion meets the rim (where the radius changes fastest) still
// resolves smoothly.
const PROFILE_STEPS = 1440
// A protrusion has to bite in at least this far (frame units) before it
// counts as a lobe rather than sampling noise on the rim itself.
const LOBE_EPSILON = 0.75
// Extra samples kept on each side of the morphing stretch, so the polyline
// hands back to the plain-rim arc a few degrees clear of any actual motion.
const ACTIVE_PAD = 12

// Probes just inside the rim rather than exactly on it: the wings are
// welded tangentially, so a probe exactly at RIM_RADIUS sits right on the
// boundary where an inside/outside test is a coin flip.
const RIM_PROBE_INSET = 0.5

// Builds an off-document SVG holding `shapes`, and returns a predicate per
// shape answering "is this frame-space point inside it." Each shape carries
// its own toLocal rather than an SVG transform attribute, because
// isPointInFill's coordinate space relative to an element's own transform
// isn't consistent across engines — converting the query point by hand is
// unambiguous.
function makeInsideTests(shapes) {
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.style.position = 'absolute'
  svg.style.left = '-9999px'
  svg.style.width = '0'
  svg.style.height = '0'
  svg.style.overflow = 'hidden'

  const tests = shapes.map(({ d, toLocal }) => {
    const el = document.createElementNS(NS, 'path')
    el.setAttribute('d', d)
    svg.appendChild(el)
    const point = svg.createSVGPoint()
    return (x, y) => {
      const local = toLocal(x, y)
      point.x = local[0]
      point.y = local[1]
      return el.isPointInFill(point)
    }
  })

  document.body.appendChild(svg)
  return { tests, dispose: () => svg.remove() }
}

// Traces one state's boundary as a radius-per-angle profile. For each
// angle: if the rim there is covered by a protrusion, binary-search inward
// for where that protrusion stops; otherwise the radius is just the rim's.
function buildProfile(tests) {
  const profile = new Float64Array(PROFILE_STEPS)
  for (let i = 0; i < PROFILE_STEPS; i++) {
    const theta = (i / PROFILE_STEPS) * Math.PI * 2
    const cos = Math.cos(theta)
    const sin = Math.sin(theta)
    const covered = (rho) => {
      const x = RIM_CENTER + rho * cos
      const y = RIM_CENTER + rho * sin
      for (let t = 0; t < tests.length; t++) if (tests[t](x, y)) return true
      return false
    }

    let hi = RIM_RADIUS - RIM_PROBE_INSET
    if (!covered(hi)) {
      profile[i] = RIM_RADIUS
      continue
    }
    let lo = 0
    if (covered(lo)) {
      profile[i] = 0
      continue
    }
    for (let step = 0; step < 22; step++) {
      const mid = (lo + hi) / 2
      if (covered(mid)) hi = mid
      else lo = mid
    }
    profile[i] = hi
  }
  return profile
}

// The contiguous index ranges where a profile dips inside the rim — i.e.
// where its protrusions are. The protrusions all sit near the bottom of the
// dial (theta ~ PI/2, since y grows downward), nowhere near index 0, so
// there's no wrap-around case to handle.
function findLobes(profile) {
  const lobes = []
  let start = null
  for (let i = 0; i < profile.length; i++) {
    const dipped = profile[i] < RIM_RADIUS - LOBE_EPSILON
    if (dipped && start === null) start = i
    else if (!dipped && start !== null) {
      lobes.push([start, i - 1])
      start = null
    }
  }
  if (start !== null) lobes.push([start, profile.length - 1])
  return lobes
}

// Piecewise-linear lookup through `controls` ([from, to] pairs, ascending
// by `from`), identity outside their range.
function mapThrough(controls, i) {
  if (i <= controls[0][0]) return i
  const last = controls[controls.length - 1]
  if (i >= last[0]) return i
  for (let k = 0; k < controls.length - 1; k++) {
    const [aFrom, aTo] = controls[k]
    const [bFrom, bTo] = controls[k + 1]
    if (i >= aFrom && i <= bFrom) {
      const span = bFrom - aFrom
      const t = span === 0 ? 0 : (i - aFrom) / span
      return aTo + (bTo - aTo) * t
    }
  }
  return i
}

function sampleProfile(profile, index) {
  const n = profile.length
  const wrapped = ((index % n) + n) % n
  const lo = Math.floor(wrapped)
  const hi = (lo + 1) % n
  const t = wrapped - lo
  return profile[lo] + (profile[hi] - profile[lo]) * t
}

const angleOf = (index) => (index / PROFILE_STEPS) * Math.PI * 2

const FRAME_OUTLINE = `M0 0H${FRAME}V${FRAME}H0Z`

// Builds the morph once (it needs the DOM to trace the source artwork) and
// hands back a function from progress 0..1 to a path.
//
// The correspondence is what makes this read as a merge rather than a
// crossfade between two silhouettes. Each of the two small protrusions is
// mapped onto its own half of the single big one — the decline lobe onto
// the left half, the accept lobe onto the right half — so their outer
// vertices stay put on the rim and widen while their inner vertices travel
// toward each other. The stretch of plain rim between the two lobes maps
// entirely onto the single point where those inner vertices meet, so it
// pinches shut and is swallowed as they join, rather than one protrusion
// fading out under another fading in.
function buildRimMorph() {
  if (typeof document === 'undefined') return null

  const declineTest = {
    d: DECLINE_OUTER_D,
    toLocal: (x, y) => [x - DECLINE_ORIGIN.x, y - DECLINE_ORIGIN.y],
  }
  const acceptTest = {
    d: ACCEPT_OUTER_D,
    toLocal: (x, y) => [x - ACCEPT_ORIGIN.x, y - ACCEPT_ORIGIN.y],
  }
  const micTest = {
    d: MIC_WING_D,
    toLocal: (x, y) => [(x - MIC_BOX.left) / MIC_SCALE.x, (y - MIC_BOX.top) / MIC_SCALE.y],
  }

  const pair = makeInsideTests([declineTest, acceptTest])
  const fromProfile = buildProfile(pair.tests)
  pair.dispose()

  const single = makeInsideTests([micTest])
  const toProfile = buildProfile(single.tests)
  single.dispose()

  const fromLobes = findLobes(fromProfile)
  const toLobes = findLobes(toProfile)
  if (fromLobes.length !== 2 || toLobes.length !== 1) return null

  const [[declineStart, declineEnd], [acceptStart, acceptEnd]] = fromLobes
  const [[micStart, micEnd]] = toLobes
  const micMid = (micStart + micEnd) / 2

  const controls = [
    [declineStart, micStart],
    [declineEnd, micMid],
    [acceptStart, micMid],
    [acceptEnd, micEnd],
  ]

  const activeStart = Math.max(0, Math.min(declineStart, micStart) - ACTIVE_PAD)
  const activeEnd = Math.min(PROFILE_STEPS - 1, Math.max(acceptEnd, micEnd) + ACTIVE_PAD)
  const count = activeEnd - activeStart + 1

  const fromAngle = new Float64Array(count)
  const fromRadius = new Float64Array(count)
  const toAngle = new Float64Array(count)
  const toRadius = new Float64Array(count)

  for (let k = 0; k < count; k++) {
    const i = activeStart + k
    const j = mapThrough(controls, i)
    fromAngle[k] = angleOf(i)
    fromRadius[k] = fromProfile[i]
    toAngle[k] = angleOf(j)
    toRadius[k] = sampleProfile(toProfile, j)
  }

  // The stretch outside [activeStart, activeEnd] is plain rim in both
  // states, so it's emitted as one true circular arc rather than sampled
  // points — the rim stays mathematically a circle instead of a very fine
  // polygon approximating one.
  function pathAt(progress) {
    let d = FRAME_OUTLINE
    let firstX = 0
    let firstY = 0
    for (let k = 0; k < count; k++) {
      const theta = fromAngle[k] + (toAngle[k] - fromAngle[k]) * progress
      const radius = fromRadius[k] + (toRadius[k] - fromRadius[k]) * progress
      const x = RIM_CENTER + radius * Math.cos(theta)
      const y = RIM_CENTER + radius * Math.sin(theta)
      if (k === 0) {
        firstX = x
        firstY = y
        d += `M${x.toFixed(2)} ${y.toFixed(2)}`
      } else {
        d += `L${x.toFixed(2)} ${y.toFixed(2)}`
      }
    }
    d += `A${RIM_RADIUS.toFixed(2)} ${RIM_RADIUS.toFixed(2)} 0 1 1 ${firstX.toFixed(2)} ${firstY.toFixed(2)}Z`
    return d
  }

  return { pathAt }
}

// Tracing the artwork costs a couple of hundred milliseconds, so it's done
// once and kept — warmed on mount (see RimMorph.jsx) rather than on the
// click that starts the morph, which would spend that time as a stall on
// the animation's first frame. null means the trace didn't find the
// protrusions it expected and the morph should be skipped rather than
// played wrong.
let cachedMorph
export function getRimMorph() {
  if (cachedMorph === undefined) cachedMorph = buildRimMorph()
  return cachedMorph
}
