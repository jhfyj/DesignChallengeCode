// Software perspective renderer on Canvas 2D.
//
// Hidden surfaces come from the painter's algorithm: backface-cull, walk the
// faces far-to-near, then fill each one with the paper colour so it erases
// whatever is behind it before stroking its own grid on top.
//
// The camera never rotates -- it only translates, sliding across the sheet and
// pushing along the view axis to zoom. That is a deliberate constraint (see
// App.jsx), and it buys two things here: view space is just world-minus-eye
// with no rotation matrix, and the far-to-near face order is fixed for the
// whole session, so there is no per-frame sort.
//
// Hot-loop rules: no allocation per frame, one stroke() per face, and only the
// points of visible faces get transformed.

import { APERTURE } from './scene.js'

const NEAR = 0.2

// One uniform hairline for everything. The colour is opaque rather than alpha:
// where two coincident lines do get drawn twice, a translucent stroke would
// composite twice and read as a heavier line.
export const THEME = {
  paper: '#f6f3ec',
  line: '#514c45',
  // Filled squares go darker than the line, so the lattice still reads across
  // a filled run instead of disappearing into it.
  fill: '#241f1a',
}

export const DEFAULT_WEIGHT = 0.75

const SKETCH_AMP = 1.9 // px of wobble at mid-span
const SKETCH_SPAN = 40 // px of line per wobble joint
const SKETCH_MAX = 16

// Hand-drawn fill is a one-way hatch rather than solid ink, so a filled run
// reads as pencil shading. The gap is a target: each square divides its own
// span into a whole number of passes near it, which keeps the strokes lined up
// from one square to the next instead of breaking at every boundary.
const HATCH_GAP = 4.6

// How far apart a dragged trail samples the pointer path, in CSS pixels. A few
// pixels is small enough for the squares deep in the corridor, which project
// to almost nothing.
const TRAIL_STEP = 4

// How long a square takes to flip. Short enough to feel like the square
// answered the tap rather than played an animation.
const FLIP_MS = 240

// The largest a paper square may be, as a fraction of the shorter side of the
// frame, and still be worth painting.
//
// The sheet is a plane in perspective, so its squares grow without bound as
// the camera closes on it: right up against the paper one lattice square
// covers most of the view, and a tap aimed at a square blacks out the whole
// sheet instead. That is the same square the lattice is drawing, so there is
// nothing to correct in the arithmetic -- what is wrong is calling it a tap on
// a square when the square is the frame. Under a third of the shorter side
// there are always three or more across the view, which is enough for the mark
// to land somewhere rather than everywhere.
const PAINT_CELL_MAX = 1 / 3

export class Renderer {
  constructor(canvas, scene, theme = THEME) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false })
    this.scene = scene
    this.theme = theme
    this.w = 0
    this.h = 0
    this.dpr = 1

    this.lineWidth = DEFAULT_WEIGHT
    this.sketch = false

    // Filled squares, keyed by world lattice square rather than by screen
    // position, so they stay welded to the paper while the camera moves.
    // Each entry remembers where it was touched and when, which is all the
    // flip animation needs. A square that has finished flipping back to paper
    // is dropped, so this only ever holds squares there is something to draw.
    this.cells = new Map()

    // The same thing for the squares on the corridor's own faces. Those are not
    // screen-aligned, so they are keyed by the world plane they sit on and the
    // lattice square within it -- never by which face drew them, because the
    // depth slicing in scene.js can cut one wall into a dozen faces and a
    // filled square must not care. Grouped by plane so that drawing a face is
    // one lookup rather than a walk of everything ever painted.
    this.faceCells = new Map() // plane key -> Map of "a,b" -> entry
    this.animUntil = 0

    // Scratch for one cell quad. Separate from the face buffers: a face's own
    // view-space points are still needed for its grid lines after its cells
    // have been filled.
    this.cview = new Float32Array(4 * 3)
    this.cpoly = new Float32Array(8 * 3)
    this.cproj = new Float32Array(8 * 2)

    this.view = new Float32Array(scene.maxFacePts * 3) // view-space scratch
    this.poly = new Float32Array(8 * 3) // near-clipped quad
    this.proj = new Float32Array(8 * 2) // that quad, projected

    // Static draw order: farthest centroid first. Ascending cz is far-to-near
    // for a camera anywhere on the view axis, not just at one depth, so zooming
    // does not invalidate it -- anything that ends up behind the eye is thrown
    // away by the near clip. Rotation is what would break this, and the camera
    // never rotates. Faces are depth-sliced in scene.js so that a centroid is a
    // fair stand-in for the whole face.
    this.order = Int32Array.from(
      scene.faces.map((_, i) => i).sort((a, b) => scene.faces[a].cz - scene.faces[b].cz),
    )

    // Every face is axis-aligned, so it lies on one whole-numbered plane and
    // spans whole lattice squares in the other two axes. Working that out once
    // is what lets a click be turned into a square, and a square back into a
    // quad to fill. The sheet is left out: it is the paper, and taps on it go
    // through the screen-space path instead.
    for (const fc of scene.faces) {
      if (fc.sheet === true) continue
      const ax = fc.nx !== 0 ? 0 : fc.ny !== 0 ? 1 : 2
      fc.ax = ax
      fc.pv = ax === 0 ? fc.ox : ax === 1 ? fc.oy : fc.oz
      fc.pk = ax + ',' + fc.pv
      const as = ax === 0 ? [fc.oy, fc.uy, fc.vy] : [fc.ox, fc.ux, fc.vx]
      const bs = ax === 2 ? [fc.oy, fc.uy, fc.vy] : [fc.oz, fc.uz, fc.vz]
      fc.pa0 = Math.round(as[0] + Math.min(0, as[1]) + Math.min(0, as[2]))
      fc.pa1 = Math.round(as[0] + Math.max(0, as[1]) + Math.max(0, as[2]))
      fc.pb0 = Math.round(bs[0] + Math.min(0, bs[1]) + Math.min(0, bs[2]))
      fc.pb1 = Math.round(bs[0] + Math.max(0, bs[1]) + Math.max(0, bs[2]))
    }
  }

  setStyle({ lineWidth, sketch }) {
    if (lineWidth !== undefined) this.lineWidth = lineWidth
    if (sketch !== undefined) this.sketch = sketch
  }

  // Only the backing store is set here. The display size stays owned by CSS,
  // so measuring the canvas can never feed back into its own layout.
  resize(w, h, dpr) {
    if (w === this.w && h === this.h && dpr === this.dpr) return false
    this.w = w
    this.h = h
    this.dpr = dpr
    this.canvas.width = Math.max(1, Math.round(w * dpr))
    this.canvas.height = Math.max(1, Math.round(h * dpr))
    return true
  }

  render(cam, now = performance.now()) {
    const { ctx, w, h, theme, scene } = this
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.fillStyle = theme.paper
    ctx.fillRect(0, 0, w, h)
    ctx.lineJoin = this.sketch ? 'round' : 'miter'
    ctx.lineCap = this.sketch ? 'round' : 'butt'

    const f = (h * 0.5) / Math.tan(cam.fov * 0.5)
    const cx = w * 0.5
    const cy = h * 0.5
    const amp = this.sketch ? SKETCH_AMP : 0

    const faces = scene.faces
    const order = this.order
    const src = scene.verts
    const view = this.view
    const poly = this.poly
    const proj = this.proj

    ctx.fillStyle = theme.paper
    ctx.strokeStyle = theme.line
    ctx.lineWidth = this.lineWidth

    for (let s = 0; s < order.length; s++) {
      const fc = faces[order[s]]

      const dx = cam.x - fc.cx, dy = cam.y - fc.cy, dz = cam.z - fc.cz
      if (dx * fc.nx + dy * fc.ny + dz * fc.nz <= 0) continue

      const base = fc.ptOff * 3
      const cnt = fc.ptCount
      for (let k = 0; k < cnt; k++) {
        const o = base + k * 3
        const t = k * 3
        view[t] = src[o] - cam.x
        view[t + 1] = src[o + 1] - cam.y
        view[t + 2] = src[o + 2] - cam.z
      }

      // Opaque fill: this is what hides everything already drawn behind it.
      // The fill stays straight even in sketch mode -- it is the occluder, and
      // letting the wobbly stroke spill past it is what reads as pen overshoot.
      const pc = clipPolyNear(view, 4, poly)
      if (pc < 3) continue
      ctx.beginPath()
      for (let k = 0; k < pc; k++) {
        const iz = -1 / poly[k * 3 + 2]
        const sx = cx + poly[k * 3] * f * iz
        const sy = cy - poly[k * 3 + 1] * f * iz
        proj[k * 2] = sx
        proj[k * 2 + 1] = sy
        if (k === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy)
      }
      ctx.closePath()
      ctx.fill()

      if (this.faceCells.size !== 0) this.drawFaceCells(fc, cam, now, f, cx, cy)

      // Grid lines and the outline share one path, so each face costs a single
      // stroke() and no style changes.
      ctx.beginPath()
      for (let k = 4; k < cnt; k += 2) {
        let ax = view[k * 3], ay = view[k * 3 + 1], az = view[k * 3 + 2]
        let bx = view[k * 3 + 3], by = view[k * 3 + 4], bz = view[k * 3 + 5]
        const ina = az < -NEAR, inb = bz < -NEAR
        if (!ina && !inb) continue
        if (ina !== inb) {
          const t = (-NEAR - az) / (bz - az)
          const ix = ax + (bx - ax) * t, iy = ay + (by - ay) * t
          if (ina) { bx = ix; by = iy; bz = -NEAR } else { ax = ix; ay = iy; az = -NEAR }
        }
        const ia = -1 / az, ib = -1 / bz
        emitSeg(
          ctx,
          cx + ax * f * ia, cy - ay * f * ia,
          cx + bx * f * ib, cy - by * f * ib,
          amp, fc.ptOff + k,
        )
      }

      // The coplanar sheet panels skip the outline so their seams stay invisible.
      if (fc.edged) {
        for (let k = 0; k < pc; k++) {
          const n = (k + 1) % pc
          emitSeg(
            ctx,
            proj[k * 2], proj[k * 2 + 1],
            proj[n * 2], proj[n * 2 + 1],
            amp, fc.ptOff * 7 + k + 3,
          )
        }
      }
      ctx.stroke()
    }

    // Free-standing outlines (the aperture rim) sit in front of everything, and
    // the first one doubles as the mask for the paper pass below.
    let rimCount = 0
    for (let li = 0; li < scene.outlines.length; li++) {
      const loop = scene.outlines[li]
      const c = loop.length / 3
      for (let k = 0; k < c; k++) {
        const t = k * 3
        view[t] = loop[t] - cam.x
        view[t + 1] = loop[t + 1] - cam.y
        view[t + 2] = loop[t + 2] - cam.z
      }
      const pc = clipPolyNear(view, c, poly)
      if (pc < 2) continue
      for (let k = 0; k < pc; k++) {
        const iz = -1 / poly[k * 3 + 2]
        proj[k * 2] = cx + poly[k * 3] * f * iz
        proj[k * 2 + 1] = cy - poly[k * 3 + 1] * f * iz
      }
      ctx.beginPath()
      for (let k = 0; k < pc; k++) {
        const n = (k + 1) % pc
        emitSeg(
          ctx,
          proj[k * 2], proj[k * 2 + 1],
          proj[n * 2], proj[n * 2 + 1],
          amp, 90001 + li * 17 + k,
        )
      }
      ctx.stroke()
      if (li === 0) rimCount = pc
    }

    // The paper. One continuous lattice over everything the sheet covers,
    // masked out of the aperture so it never lands on the corridor behind.
    // Drawing it here rather than as a backdrop is what keeps it unbroken: the
    // sheet's opaque fills would otherwise bury a backdrop, and the panels
    // themselves cannot redraw the lines along their shared seams.
    //
    // No visible rim means no paper: either the camera has gone through the
    // opening and the sheet is behind it, or the aperture fills the frame. Both
    // must skip this pass, or the lattice would be laid straight over the
    // corridor with nothing to mask it.
    if (rimCount >= 3) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, w, h)
      ctx.moveTo(proj[0], proj[1])
      for (let k = 1; k < rimCount; k++) ctx.lineTo(proj[k * 2], proj[k * 2 + 1])
      ctx.closePath()
      ctx.clip('evenodd')
      this.drawPaperCells(cam, now)
      this.drawPaperGrid(cam, amp)
      ctx.restore()
    }
  }

  // Side of one paper square, in CSS pixels. The sheet is the plane z = 0 and
  // the camera never rotates, so its projection is a plain uniform scale.
  // Hit-testing a tap and drawing the lattice both come through here; if they
  // each did their own arithmetic they could drift and squares would fill next
  // to the one that was tapped.
  paperCell(cam) {
    const f = (this.h * 0.5) / Math.tan(cam.fov * 0.5)
    return Math.max(8, f / Math.max(0.001, cam.z))
  }

  // The closest the camera may come to the sheet while its squares are still
  // worth painting. The zoom stops here rather than against the paper, so the
  // last stretch of the range cannot leave the sheet filling the frame with
  // squares too big to mark -- the stop and the guard read the same rule, which
  // is the only way the two can agree on every viewport.
  paperZoomLimit(cam) {
    const f = (this.h * 0.5) / Math.tan(cam.fov * 0.5)
    return f / (Math.min(this.w, this.h) * PAINT_CELL_MAX)
  }

  // Which lattice square a point in CSS pixels lands on, plus where inside it,
  // or null where there is no paper to mark: behind the camera, or in the
  // opening, which the paper pass masks out anyway.
  cellAt(cam, sx, sy) {
    if (cam.z <= 0) return null
    const cell = this.paperCell(cam)
    const wx = cam.x + (sx - this.w * 0.5) / cell
    const wy = cam.y + (this.h * 0.5 - sy) / cell
    if (Math.abs(wx) < APERTURE.AX && Math.abs(wy) < APERTURE.AY) return null
    const i = Math.floor(wx), j = Math.floor(wy)
    return { i, j, fx: wx - i, fy: wy - j }
  }

  // Turn a point in CSS pixels into the square under it, wherever it lands.
  // The sheet is a screen-aligned lattice and the corridor is real geometry, so
  // they need different arithmetic, but the split is not arbitrary: the paper
  // reaches exactly as far as the mask lets it draw, and everything the mask
  // cuts away is corridor, reached by casting a ray into the scene.
  flipAt(cam, sx, sy, force) {
    const paper = this.cellAt(cam, sx, sy)
    if (paper) {
      // Over the sheet, but too close to it for a square to mean anything.
      // Refused here rather than in cellAt so the tap stays on the paper it
      // landed on: falling through to the ray cast would let it paint a
      // corridor face lying behind the sheet, out of sight, and the mark would
      // only turn up once the camera pulled back.
      if (this.paperCell(cam) > Math.min(this.w, this.h) * PAINT_CELL_MAX) return null
      return this.flip(this.cells, paper.i + ',' + paper.j, paper.fx, paper.fy, force)
    }
    const face = this.pickFace(cam, sx, sy)
    if (!face) return null
    let bucket = this.faceCells.get(face.pk)
    if (bucket === undefined) {
      bucket = new Map()
      this.faceCells.set(face.pk, bucket)
    }
    return this.flip(bucket, face.i + ',' + face.j, face.fa, face.fb, force)
  }

  // `force` paints a known state instead of toggling, which is what a dragged
  // trail needs -- it has to keep laying down the state the first square landed
  // on rather than inverting every square it crosses.
  flip(bucket, key, fa, fb, force) {
    const prev = bucket.get(key)
    const was = prev !== undefined && prev.on
    const on = force === undefined ? !was : force
    if (on === was) return on // already there: leave its animation alone
    const now = performance.now()
    bucket.set(key, { on, t0: now, fx: fa, fy: fb })
    this.animUntil = now + FLIP_MS
    return on
  }

  // Forget every filled square, on the paper and in the corridor both.
  clearCells() {
    const had = this.cells.size !== 0 || this.faceCells.size !== 0
    this.cells.clear()
    this.faceCells.clear()
    return had
  }

  // The nearest face under a point, and where on it. This is a ray cast rather
  // than a lookup because the painter's algorithm keeps no depth buffer: the
  // only record of what is in front is the geometry itself. Same backface cull
  // as the draw, so a tap can only ever land on a face that is being drawn.
  pickFace(cam, sx, sy) {
    const faces = this.scene.faces
    const f = (this.h * 0.5) / Math.tan(cam.fov * 0.5)
    const dx = (sx - this.w * 0.5) / f
    const dy = (this.h * 0.5 - sy) / f
    let bestT = Infinity
    let best = null
    let bestA = 0
    let bestB = 0
    for (let i = 0; i < faces.length; i++) {
      const fc = faces[i]
      if (fc.pk === undefined) continue
      if ((cam.x - fc.cx) * fc.nx + (cam.y - fc.cy) * fc.ny + (cam.z - fc.cz) * fc.nz <= 0) continue
      const den = fc.nx * dx + fc.ny * dy - fc.nz
      if (den === 0) continue
      const t =
        (fc.nx * (fc.ox - cam.x) + fc.ny * (fc.oy - cam.y) + fc.nz * (fc.oz - cam.z)) / den
      if (t <= NEAR || t >= bestT) continue
      const hx = cam.x + dx * t
      const hy = cam.y + dy * t
      const hz = cam.z - t
      const a = fc.ax === 0 ? hy : hx
      const b = fc.ax === 2 ? hy : hz
      if (a < fc.pa0 || a > fc.pa1 || b < fc.pb0 || b > fc.pb1) continue
      bestT = t
      best = fc
      bestA = a
      bestB = b
    }
    if (best === null) return null
    // A hit exactly on the far edge would floor to a square the face does not
    // own, so it is pulled back inside.
    const i = Math.min(Math.floor(bestA), best.pa1 - 1)
    const j = Math.min(Math.floor(bestB), best.pb1 - 1)
    return { pk: best.pk, i, j, fa: bestA - i, fb: bestB - j }
  }

  // Paint every square a drag passed over. Sampling only the two endpoints
  // would skip squares whenever the pointer moved faster than one square per
  // frame, so the trail is walked in short steps.
  paintTrail(cam, x0, y0, x1, y1, on) {
    const dx = x1 - x0, dy = y1 - y0
    const n = Math.min(400, Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / TRAIL_STEP)))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      this.flipAt(cam, x0 + dx * t, y0 + dy * t, on)
    }
  }

  // Whether any square is still mid-flip, so the frame loop knows not to park.
  animating(now) {
    return now < this.animUntil
  }

  // Filled squares on the sheet, drawn under the lattice so the lines still
  // read across them.
  //
  // Split in two: everything settled goes into one path and one canvas call,
  // and only the handful still mid-flip pays for its own clip. That split is
  // what keeps a blacked-out sheet affordable -- a clip, a path and a stroke
  // per square costs about twenty milliseconds a frame once the whole page is
  // filled, and batching brings it back under one.
  drawPaperCells(cam, now) {
    if (this.cells.size === 0) return
    const { ctx } = this
    const cell = this.paperCell(cam)
    const cx = this.w * 0.5, cy = this.h * 0.5
    const pts = this.cproj

    // Squares off screen cost nothing to skip, which is what keeps a long
    // painting session from costing more every frame.
    const i0 = Math.floor(cam.x - cx / cell) - 1
    const i1 = Math.ceil(cam.x + cx / cell) + 1
    const j0 = Math.floor(cam.y - cy / cell) - 1
    const j1 = Math.ceil(cam.y + cy / cell) + 1

    let batched = 0
    ctx.beginPath()
    for (const [key, c] of this.cells) {
      if (now - c.t0 < FLIP_MS) continue
      if (!c.on) {
        this.cells.delete(key) // back to bare paper: nothing left to draw, ever
        continue
      }
      const comma = key.indexOf(',')
      const i = +key.slice(0, comma)
      const j = +key.slice(comma + 1)
      if (i < i0 || i > i1 || j < j0 || j > j1) continue
      const x = cx + (i - cam.x) * cell
      const y = cy - (j + 1 - cam.y) * cell
      // A settled square needs no clip: a solid fill is its own rectangle, and
      // clamping a 45-degree hatch to an axis-aligned square is exact.
      if (this.sketch) this.hatchInto(null, 0, 0, 0, x, y, x + cell, y + cell, i * 733 + j * 37)
      else ctx.rect(x, y, cell, cell)
      batched++
    }
    if (batched !== 0) this.strokeBatch()

    for (const [key, c] of this.cells) {
      const t = (now - c.t0) / FLIP_MS
      if (t >= 1) continue
      const comma = key.indexOf(',')
      const i = +key.slice(0, comma)
      const j = +key.slice(comma + 1)
      if (i < i0 || i > i1 || j < j0 || j > j1) continue
      const x = cx + (i - cam.x) * cell
      const y = cy - (j + 1 - cam.y) * cell
      pts[0] = x; pts[1] = y
      pts[2] = x + cell; pts[3] = y
      pts[4] = x + cell; pts[5] = y + cell
      pts[6] = x; pts[7] = y + cell
      this.paintSquare(pts, 4, x + c.fx * cell, y + (1 - c.fy) * cell, t, c.on, i * 733 + j * 37)
    }
  }

  // Filled squares on one face of the corridor, drawn straight after that
  // face's own fill so the painter's order still hides them correctly, and
  // before its grid so the lines read across them. Batched the same way as the
  // sheet's, with the projected quad standing in for the square.
  drawFaceCells(fc, cam, now, f, cx, cy) {
    const bucket = this.faceCells.get(fc.pk)
    if (bucket === undefined) return
    const { ctx } = this
    const view = this.cview
    const poly = this.cpoly
    const proj = this.cproj
    const ax = fc.ax
    const p = fc.pv

    let batched = 0
    ctx.beginPath()
    for (const pass of PASSES) {
      if (pass === 1) {
        if (batched !== 0) this.strokeBatch()
        batched = 0
      }
      for (const [key, c] of bucket) {
        const t = (now - c.t0) / FLIP_MS
        const settled = t >= 1
        if (settled !== (pass === 0)) continue
        if (settled && !c.on) {
          bucket.delete(key)
          continue
        }
        const comma = key.indexOf(',')
        const i = +key.slice(0, comma)
        const j = +key.slice(comma + 1)
        // Only the face that owns this square draws it. Planes are shared, so
        // this is what stops one slice of a wall painting another's squares.
        if (i < fc.pa0 || i + 1 > fc.pa1 || j < fc.pb0 || j + 1 > fc.pb1) continue

        // The square as four world corners on the plane, in view space.
        for (let k = 0; k < 4; k++) {
          const a = k === 1 || k === 2 ? i + 1 : i
          const b = k === 2 || k === 3 ? j + 1 : j
          const o = k * 3
          view[o] = (ax === 0 ? p : a) - cam.x
          view[o + 1] = ax === 1 ? p - cam.y : (ax === 0 ? a : b) - cam.y
          view[o + 2] = (ax === 2 ? p : b) - cam.z
        }
        const pc = clipPolyNear(view, 4, poly)
        if (pc < 3) continue
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
        let gx = 0, gy = 0
        for (let k = 0; k < pc; k++) {
          const iz = -1 / poly[k * 3 + 2]
          const sx = cx + poly[k * 3] * f * iz
          const sy = cy - poly[k * 3 + 1] * f * iz
          proj[k * 2] = sx
          proj[k * 2 + 1] = sy
          if (sx < x0) x0 = sx
          if (sx > x1) x1 = sx
          if (sy < y0) y0 = sy
          if (sy > y1) y1 = sy
          gx += sx
          gy += sy
        }
        if (!(x1 > x0) || !(y1 > y0)) continue

        if (settled) {
          if (this.sketch) {
            this.hatchInto(proj, pc, gx / pc, gy / pc, x0, y0, x1, y1, seedOf(i, j, ax, p))
          } else {
            ctx.moveTo(proj[0], proj[1])
            for (let k = 1; k < pc; k++) ctx.lineTo(proj[k * 2], proj[k * 2 + 1])
            ctx.closePath()
          }
          batched++
          continue
        }

        const ta = i + c.fx
        const tb = j + c.fy
        const tv0 = (ax === 0 ? p : ta) - cam.x
        const tv1 = ax === 1 ? p - cam.y : (ax === 0 ? ta : tb) - cam.y
        const tv2 = (ax === 2 ? p : tb) - cam.z
        // Touched point behind the eye: there is nowhere sane to grow from, so
        // the square waits until the camera is somewhere it can be drawn.
        if (tv2 >= -NEAR) continue
        const tiz = -1 / tv2
        this.paintSquare(
          proj, pc,
          cx + tv0 * f * tiz, cy - tv1 * f * tiz,
          t, c.on, seedOf(i, j, ax, p),
        )
      }
    }
    if (batched !== 0) this.strokeBatch()
  }

  // Commit a batch of settled squares: hand-drawn mode has built a path of
  // hatch passes to stroke, plain mode a path of outlines to fill.
  //
  // Saved and restored around the commit because this runs in the middle of
  // the face loop, which holds its own colours across every face -- leaving
  // the fill colour behind here turned every face drawn afterwards into a
  // solid block, so one painted square blacked out the whole drawing. The
  // path itself is not part of that saved state, so it survives the restore.
  strokeBatch() {
    const { ctx, theme } = this
    ctx.save()
    if (this.sketch) {
      ctx.strokeStyle = theme.fill
      ctx.lineWidth = this.lineWidth
      ctx.stroke()
    } else {
      ctx.fillStyle = theme.fill
      ctx.fill()
    }
    ctx.restore()
    ctx.beginPath()
  }

  // One square's flip, given its outline on screen and the point it was
  // touched. Mid-flip, the arriving mark is grown out of that point and clipped
  // to the square, so it reads as the square filling rather than as a circle
  // spreading across the page.
  paintSquare(pts, n, tx, ty, t, on, seed) {
    const { ctx } = this
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    let reach = 0
    for (let k = 0; k < n; k++) {
      const x = pts[k * 2], y = pts[k * 2 + 1]
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      const dx = x - tx, dy = y - ty
      const d = dx * dx + dy * dy
      if (d > reach) reach = d
    }
    if (!(x1 > x0) || !(y1 > y0)) return

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(pts[0], pts[1])
    for (let k = 1; k < n; k++) ctx.lineTo(pts[k * 2], pts[k * 2 + 1])
    ctx.closePath()

    if (t >= 1) {
      ctx.clip()
    } else {
      const r = Math.sqrt(reach) * (1 - (1 - t) * (1 - t) * (1 - t))
      // Filling: the mark shows inside the disc. Emptying: it shows wherever
      // the disc has not reached, which even-odd gives as square-minus-disc.
      if (on) {
        ctx.clip()
        ctx.beginPath()
        ctx.arc(tx, ty, r, 0, Math.PI * 2)
        ctx.clip()
      } else {
        ctx.arc(tx, ty, r, 0, Math.PI * 2)
        ctx.clip('evenodd')
      }
    }
    this.shade(x0, y0, x1, y1, seed)
    ctx.restore()
  }

  // The mark itself, over whatever the caller has clipped to. Only the squares
  // still mid-flip come through here; settled ones are batched instead.
  shade(x0, y0, x1, y1, seed) {
    const { ctx, theme } = this
    if (!this.sketch) {
      ctx.fillStyle = theme.fill
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
      return
    }
    ctx.beginPath()
    this.hatchInto(null, 0, 0, 0, x0, y0, x1, y1, seed)
    ctx.strokeStyle = theme.fill
    ctx.lineWidth = this.lineWidth
    ctx.stroke()
  }

  // One square's worth of hatch, added to the current path.
  //
  // Hatch runs along lines of constant x + y, and the span is divided into a
  // whole number of passes so neighbouring squares agree on where the strokes
  // fall and a filled run reads as one shaded area rather than separate boxes.
  //
  // Pass `pts` to cut the passes to a projected quad; pass null when the
  // square is axis-aligned, where clamping to the bounds is already exact.
  hatchInto(pts, n, gx, gy, x0, y0, x1, y1, seed) {
    const { ctx } = this
    const span = x1 - x0 + y1 - y0
    const passes = Math.max(2, Math.round(span / HATCH_GAP))
    const gap = span / passes
    for (let k = 0; k < passes; k++) {
      const c = x0 + y0 + gap * (k + 0.5)
      const ax = Math.max(x0, c - y1)
      const bx = Math.min(x1, c - y0)
      if (bx <= ax) continue
      seg[0] = ax; seg[1] = c - ax
      seg[2] = bx; seg[3] = c - bx
      if (pts !== null && !clipSegPoly(pts, n, gx, gy)) continue
      hatchSeg(ctx, seg[0], seg[1], seg[2], seg[3], SKETCH_AMP * 0.5, seed + k * 37)
    }
  }

  // Backdrop for wherever the sheet does not reach. Its cell size and phase are
  // derived from the sheet's own projection, so the two are indistinguishable.
  drawPaperGrid(cam, amp) {
    const { ctx, w, h, theme } = this
    const cell = this.paperCell(cam)
    const ox = mod(w * 0.5 - cam.x * cell, cell)
    const oy = mod(h * 0.5 + cam.y * cell, cell)
    ctx.strokeStyle = theme.line
    ctx.lineWidth = this.lineWidth
    // Seeds come from the world lattice index, not the loop counter. Seeding by
    // loop position would re-roll every line's wobble the moment a new line
    // entered at the edge, so the whole sheet would boil while dragging. Keyed
    // to the lattice, each line keeps its own wobble and the paper just slides.
    const cx = w * 0.5
    const cy = h * 0.5
    ctx.beginPath()
    for (let x = ox; x <= w; x += cell) {
      const m = Math.round(cam.x + (x - cx) / cell)
      const px = amp === 0 ? Math.round(x) + 0.5 : x
      emitSeg(ctx, px, 0, px, h, amp, 4001 + m * 53)
    }
    for (let y = oy; y <= h; y += cell) {
      const m = Math.round(cam.y + (cy - y) / cell)
      const py = amp === 0 ? Math.round(y) + 0.5 : y
      emitSeg(ctx, 0, py, w, py, amp, 77003 + m * 53)
    }
    ctx.stroke()
  }
}

// One line of the drawing. With amp = 0 this is a plain segment; otherwise the
// span is broken into joints pushed sideways by a deterministic wobble.
function emitSeg(ctx, ax, ay, bx, by, amp, seed) {
  if (amp === 0) {
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    return
  }
  const dx = bx - ax, dy = by - ay
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 0.5) {
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    return
  }
  const steps = Math.min(SKETCH_MAX, Math.max(2, Math.round(len / SKETCH_SPAN)))
  const nx = -dy / len, ny = dx / len
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    // Wobble peaks mid-span and eases off at the ends, so corners still land
    // close enough together to read as corners.
    const taper = 0.28 + 0.72 * Math.sin(t * Math.PI)
    const j = wob(seed + i * 131) * amp * taper
    const px = ax + dx * t + nx * j
    const py = ay + dy * t + ny * j
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
  }
}

// Deterministic noise in [-1, 1]. Seeded by the geometry's own index, never by
// time or frame count, so a line's wobble stays welded to that line while the
// camera moves. Reseeding per frame would boil the whole drawing.
function wob(n) {
  n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d)
  n = Math.imul(n ^ (n >>> 12), 0x297a2d39)
  n ^= n >>> 15
  return (n >>> 0) / 2147483648 - 1
}

// One hatch pass: two points, nudged off true so the stroke reads as drawn
// rather than printed. Deliberately not broken into joints the way a grid line
// is -- a filled sheet carries thousands of these, and the extra points are
// what pushes hand-drawn mode past a frame's worth of work.
function hatchSeg(ctx, ax, ay, bx, by, amp, seed) {
  const dx = bx - ax, dy = by - ay
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 0.5) return
  const nx = -dy / len, ny = dx / len
  const j0 = wob(seed) * amp
  const j1 = wob(seed + 911) * amp
  ctx.moveTo(ax + nx * j0, ay + ny * j0)
  ctx.lineTo(bx + nx * j1, by + ny * j1)
}

// Settled squares first, then the ones mid-flip: the settled ones share a path
// and a single canvas call, so they cannot be interleaved with clipped ones.
const PASSES = [0, 1]

// Scratch for one hatch pass, so cutting it to an outline allocates nothing.
const seg = [0, 0, 0, 0]

// Cut `seg` to a convex outline in place; false if nothing is left. The inward
// side of each edge is whichever side the outline's own centre sits on, so the
// winding never has to be known. This is here rather than a canvas clip per
// square because a clip costs far more than four dot products.
function clipSegPoly(pts, n, gx, gy) {
  const ax = seg[0], ay = seg[1]
  const dx = seg[2] - ax, dy = seg[3] - ay
  let t0 = 0, t1 = 1
  for (let k = 0; k < n; k++) {
    const m = (k + 1) % n
    const px = pts[k * 2], py = pts[k * 2 + 1]
    const ex = pts[m * 2] - px, ey = pts[m * 2 + 1] - py
    let nx = -ey, ny = ex
    if (nx * (gx - px) + ny * (gy - py) < 0) { nx = -nx; ny = -ny }
    const d = nx * dx + ny * dy
    const q = nx * (ax - px) + ny * (ay - py)
    if (d === 0) {
      if (q < 0) return false
      continue
    }
    const t = -q / d
    if (d > 0) {
      if (t > t0) t0 = t
    } else if (t < t1) {
      t1 = t
    }
    if (t0 > t1) return false
  }
  seg[0] = ax + dx * t0
  seg[1] = ay + dy * t0
  seg[2] = ax + dx * t1
  seg[3] = ay + dy * t1
  return true
}

// A square's wobble seed, keyed to the plane and the lattice square so a
// hand-drawn hatch stays welded to its square while the camera moves.
function seedOf(i, j, ax, p) {
  return i * 733 + j * 37 + ax * 9173 + p * 251
}

function mod(a, n) {
  return ((a % n) + n) % n
}

// Sutherland-Hodgman against the single plane z = -NEAR. A convex quad yields
// at most 5 points, so `dst` never overruns.
function clipPolyNear(src, count, dst) {
  let m = 0
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count
    const ax = src[i * 3], ay = src[i * 3 + 1], az = src[i * 3 + 2]
    const bx = src[j * 3], by = src[j * 3 + 1], bz = src[j * 3 + 2]
    const ina = az < -NEAR, inb = bz < -NEAR
    if (ina) { dst[m * 3] = ax; dst[m * 3 + 1] = ay; dst[m * 3 + 2] = az; m++ }
    if (ina !== inb) {
      const t = (-NEAR - az) / (bz - az)
      dst[m * 3] = ax + (bx - ax) * t
      dst[m * 3 + 1] = ay + (by - ay) * t
      dst[m * 3 + 2] = -NEAR
      m++
    }
  }
  return m
}
