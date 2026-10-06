// Scene geometry: axis-aligned boxes and standalone quads -> gridded faces ->
// flat typed-array buffers. All of this runs once at startup; the render loop
// only ever reads these buffers.

export const CELL = 1 // world units per grid square

// Faces running along the view axis are chopped at every lattice line.
//
// A single quad spanning the scene's whole depth has a centroid that says
// nothing useful about what occludes what -- the corridor shell running
// z -22..0 has its centroid at -11, so with the camera inside at -12 it sorted
// as if it were behind everything and painted straight over the blocks.
// Slicing gives every face a centroid that actually describes its depth, and
// seams land on lattice lines that are being drawn anyway, so no new edges
// appear.
//
// The step is CELL rather than some coarser multiple on purpose. Every face
// that squarely faces the camera sits at a whole cell, so with slices one cell
// deep no such face can ever land strictly inside a slice: its centroid falls
// on a slice boundary and sorts cleanly between the slice in front of it and
// the slice behind. A coarser step leaves them tied, and a tie is exactly the
// case the sort cannot resolve -- at TILE_Z = 2 the ceiling slice spanning
// z -2..0 tied with the header face at z = -1 and painted over it.
const TILE_Z = CELL

function quad(ox, oy, oz, ux, uy, uz, vx, vy, vz, nx, ny, nz, extra) {
  return { ox, oy, oz, ux, uy, uz, vx, vy, vz, nx, ny, nz, ...extra }
}

function boxFaces(b, out) {
  const { x0, x1, y0, y1, z0, z1 } = b
  const s = b.inward ? -1 : 1 // room shell: normals point inward
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0
  const F = (...a) => {
    const f = quad(...a)
    f.nx *= s; f.ny *= s; f.nz *= s
    out.push(f)
  }
  F(x1, y0, z1, 0, 0, -dz, 0, dy, 0, 1, 0, 0)
  F(x0, y0, z0, 0, 0, dz, 0, dy, 0, -1, 0, 0)
  F(x0, y1, z0, 0, 0, dz, dx, 0, 0, 0, 1, 0)
  F(x0, y0, z0, dx, 0, 0, 0, 0, dz, 0, -1, 0)
  F(x0, y0, z1, dx, 0, 0, 0, dy, 0, 0, 0, 1)
  F(x1, y0, z0, -dx, 0, 0, 0, dy, 0, 0, 0, -1)
}

// Grid lines are anchored to one world lattice -- every line sits at a whole
// multiple of CELL on its axis -- rather than each face splitting its own span
// into equal parts. Even subdivision gives a 5.4-unit wall 1.08-unit cells and
// a 22-unit wall 1.0-unit cells, so neighbouring faces cannot meet at a shared
// edge. Anchoring instead makes every square the same size everywhere and lines
// up across every seam.
function latticeCuts(a0, a1) {
  const lo = Math.min(a0, a1), hi = Math.max(a0, a1)
  const cuts = []
  const first = Math.ceil(lo / CELL - 1e-6)
  const last = Math.floor(hi / CELL + 1e-6)
  for (let m = first; m <= last; m++) {
    const t = (m * CELL - a0) / (a1 - a0)
    if (t > 1e-6 && t < 1 - 1e-6) cuts.push(t)
  }
  return cuts
}

// Split a face into depth slices. Only faces that actually run along z need it;
// one facing the camera already has a meaningful centroid.
//
// Every face here is axis-aligned, so the edge running along z carries no x or
// y, and a slice differs from its parent in oz and that edge alone. Cutting in
// world coordinates rather than along the parametric edge matters: dividing to
// get a fraction and multiplying back out left slice centroids at -0.999...
// instead of -1, which sorted them a hair in front of faces genuinely at -1 and
// let them paint over the blocks they should sit behind.
function sliceDepth(r, out) {
  const uAlongZ = r.uz !== 0
  const vAlongZ = r.vz !== 0
  if (!uAlongZ && !vAlongZ) {
    out.push(r)
    return
  }
  const span = uAlongZ ? r.uz : r.vz
  const lo = Math.min(r.oz, r.oz + span)
  const hi = Math.max(r.oz, r.oz + span)

  const bounds = [lo]
  const first = Math.ceil(lo / TILE_Z - 1e-6)
  const last = Math.floor(hi / TILE_Z + 1e-6)
  for (let m = first; m <= last; m++) {
    const z = m * TILE_Z
    if (z > lo + 1e-6 && z < hi - 1e-6) bounds.push(z)
  }
  bounds.push(hi)
  if (bounds.length === 2) {
    out.push(r)
    return
  }
  if (span < 0) bounds.reverse() // keep the winding the face was built with

  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i], b = bounds[i + 1]
    const seg = { ...r }
    seg.oz = a
    if (uAlongZ) seg.uz = b - a
    else seg.vz = b - a
    out.push(seg)
  }
}

function axisCoords(ox, oy, oz, ux, uy, uz) {
  if (ux !== 0) return [ox, ox + ux]
  if (uy !== 0) return [oy, oy + uy]
  return [oz, oz + uz]
}

export function buildScene({ boxes = [], quads = [], outlines = [] }) {
  const whole = []
  for (const b of boxes) boxFaces(b, whole)
  for (const q of quads) whole.push(q)

  const raw = []
  for (const r of whole) sliceDepth(r, raw)

  // Pass 1: size every face so the whole scene fits one contiguous buffer.
  const faces = []
  let total = 0
  for (const r of raw) {
    const [u0, u1] = axisCoords(r.ox, r.oy, r.oz, r.ux, r.uy, r.uz)
    const [v0, v1] = axisCoords(r.ox, r.oy, r.oz, r.vx, r.vy, r.vz)
    // Sheet panels carry no grid of their own. A rectangle with a hole can only
    // be decomposed into rectangles that meet along internal seams, and those
    // seams land on lattice lines -- each panel treats such a line as its own
    // boundary and skips it, so the line goes missing entirely. The paper pass
    // in the renderer draws the whole lattice in one go instead, which has no
    // seams to fall through.
    const isSheet = r.sheet === true
    const cutsU = isSheet ? [] : latticeCuts(u0, u1)
    const cutsV = isSheet ? [] : latticeCuts(v0, v1)
    const ptCount = 4 + 2 * (cutsU.length + cutsV.length)
    faces.push({ ...r, cutsU, cutsV, ptOff: total, ptCount })
    total += ptCount
  }

  // Pass 2: write world-space points. Lines are placed in WORLD space and then
  // projected, so perspective stays correct -- lerping projected corners would
  // give evenly spaced lines instead of converging ones.
  const verts = new Float32Array(total * 3)
  let maxFacePts = 0
  for (const fc of faces) {
    const { ox, oy, oz, ux, uy, uz, vx, vy, vz, cutsU, cutsV } = fc
    let p = fc.ptOff * 3
    const set = (x, y, z) => { verts[p++] = x; verts[p++] = y; verts[p++] = z }

    set(ox, oy, oz)
    set(ox + ux, oy + uy, oz + uz)
    set(ox + ux + vx, oy + uy + vy, oz + uz + vz)
    set(ox + vx, oy + vy, oz + vz)

    for (const t of cutsU) {
      const ax = ox + ux * t, ay = oy + uy * t, az = oz + uz * t
      set(ax, ay, az); set(ax + vx, ay + vy, az + vz)
    }
    for (const t of cutsV) {
      const ax = ox + vx * t, ay = oy + vy * t, az = oz + vz * t
      set(ax, ay, az); set(ax + ux, ay + uy, az + uz)
    }

    fc.cx = ox + (ux + vx) * 0.5
    fc.cy = oy + (uy + vy) * 0.5
    fc.cz = oz + (uz + vz) * 0.5
    fc.edged = fc.sheet !== true
    if (fc.ptCount > maxFacePts) maxFacePts = fc.ptCount
  }

  return {
    faces,
    verts,
    maxFacePts: Math.max(maxFacePts, 4),
    outlines: outlines.map((o) => new Float32Array(o)),
  }
}

// --- The composition -------------------------------------------------------
// A sheet of graph paper with a rectangular aperture cut in it, and a stepped
// corridor receding behind. The sheet is real geometry, not a screen overlay,
// so its grid is the same projection as everything else and shifts with it.
//
// Every dimension below is a whole number of CELL, so the aperture rim, the
// block faces and the paper grid all land on the same lattice.

const AX = 3     // aperture half width
const AY = 5     // aperture half height
// The sheet has to cover the frame at every camera the controls can reach, or
// its own edge swings into view at full drag and the corridor shows through
// beside it. What it must cover is the viewport half-span at the fit distance,
// plus the whole drag range: about 14 * (w/h) + 6 across and 20 across the
// other axis in landscape, and 22 across by 16 * (h/w) + 6 down in portrait.
// These sizes clear an ultrawide landscape window and a tall portrait one with
// room to spare. Panels carry no grid of their own, so a bigger sheet is four
// bigger fills and nothing else.
const SX = 44    // sheet half width
const SY = 52    // sheet half height
const LI = -1    // inner face of the left run
const RI = 1     // inner face of the right mass

export const APERTURE = { AX, AY }

export const SCENE = {
  quads: [
    quad(-SX, -SY, 0, SX - AX, 0, 0, 0, SY * 2, 0, 0, 0, 1, { sheet: true }),  // left of aperture
    quad(AX, -SY, 0, SX - AX, 0, 0, 0, SY * 2, 0, 0, 0, 1, { sheet: true }),   // right of aperture
    quad(-AX, AY, 0, AX * 2, 0, 0, 0, SY - AY, 0, 0, 0, 1, { sheet: true }),   // above
    quad(-AX, -SY, 0, AX * 2, 0, 0, 0, SY - AY, 0, 0, 0, 1, { sheet: true }),  // below
  ],
  // The aperture rim, stroked on its own so the coplanar sheet panels need no
  // edges of their own and their seams stay invisible.
  outlines: [[-AX, -AY, 0, AX, -AY, 0, AX, AY, 0, -AX, AY, 0]],
  // Every block shares at least one whole face with the shell or with the block
  // next to it, so the massing reads as one carved solid rather than slabs
  // floating in the void. The left run ascends one square per step, which is
  // what exposes the risers; the right run descends to open up the far end.
  boxes: [
    { x0: -AX, x1: AX, y0: -AY, y1: AY, z0: -22, z1: 0, inward: true }, // corridor shell

    { x0: -AX, x1: LI, y0: -AY, y1: -1, z0: -6, z1: -1 },    // left run, tread 1
    { x0: -AX, x1: LI, y0: -AY, y1: 0, z0: -11, z1: -6 },    // tread 2
    { x0: -AX, x1: LI, y0: -AY, y1: 1, z0: -16, z1: -11 },   // tread 3
    { x0: -AX, x1: LI, y0: -AY, y1: 2, z0: -22, z1: -16 },   // tread 4

    { x0: RI, x1: AX, y0: -AY, y1: 3, z0: -9, z1: -1 },      // right mass, near
    { x0: RI, x1: AX, y0: -AY, y1: 1, z0: -22, z1: -9 },     // right mass, far

    { x0: -AX, x1: AX, y0: 4, y1: AY, z0: -7, z1: -1 },      // ceiling header
    { x0: LI, x1: RI, y0: -AY, y1: -2, z0: -22, z1: -16 },   // far floor step
  ],
}
