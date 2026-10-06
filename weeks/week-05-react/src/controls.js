// Drag with damping.
//
// Two stages, so the motion has weight:
//   1. the pointer drives a `target`, which keeps coasting after release
//      under exponential friction (momentum);
//   2. the value actually handed to the camera eases toward that target,
//      so it always lags slightly behind the finger (damping).

const FRICTION = 0.93   // per 1/60 s
const EASE = 0.12       // per 1/60 s
const ZOOM_EASE = 0.11  // per 1/60 s
const MAX = 1
const STALL_MS = 90     // pause before release = no fling

export class DragCamera {
  constructor() {
    this.tx = 0; this.ty = 0
    this.x = 0; this.y = 0
    this.vx = 0; this.vy = 0
    this.dragging = false
    this.lastMove = 0
    // 0 = fully pulled back, 1 = pushed all the way in.
    this.zoomTarget = 0
    this.zoom = 0
  }

  // One wheel notch is roughly deltaY 100; trackpads send many small deltas.
  zoomBy(deltaY, lineMode) {
    const px = lineMode ? deltaY * 16 : deltaY
    this.zoomTarget = clamp01(this.zoomTarget - px * 0.0012)
  }

  down() {
    this.dragging = true
    this.vx = 0
    this.vy = 0
    this.lastMove = performance.now()
  }

  move(dx, dy, w, h) {
    if (!this.dragging) return
    const nx = dx / (w * 0.5)
    const ny = dy / (h * 0.5)
    this.tx = clamp(this.tx + nx)
    this.ty = clamp(this.ty + ny)
    this.vx = nx
    this.vy = ny
    this.lastMove = performance.now()
  }

  up() {
    this.dragging = false
    if (performance.now() - this.lastMove > STALL_MS) {
      this.vx = 0
      this.vy = 0
    }
  }

  // Returns false once everything has settled, so the caller can park the RAF loop.
  step(dt) {
    const frames = Math.min(dt * 60, 4) // clamp after a background tab stall
    if (!this.dragging) {
      const fr = Math.pow(FRICTION, frames)
      this.tx = clamp(this.tx + this.vx * (1 - fr) / (1 - FRICTION))
      this.ty = clamp(this.ty + this.vy * (1 - fr) / (1 - FRICTION))
      this.vx *= fr
      this.vy *= fr
      if (Math.abs(this.vx) < 1e-5) this.vx = 0
      if (Math.abs(this.vy) < 1e-5) this.vy = 0
    }
    const k = 1 - Math.pow(1 - EASE, frames)
    this.x += (this.tx - this.x) * k
    this.y += (this.ty - this.y) * k

    const zk = 1 - Math.pow(1 - ZOOM_EASE, frames)
    this.zoom += (this.zoomTarget - this.zoom) * zk

    return (
      this.dragging ||
      this.vx !== 0 || this.vy !== 0 ||
      Math.abs(this.tx - this.x) > 1e-4 ||
      Math.abs(this.ty - this.y) > 1e-4 ||
      Math.abs(this.zoomTarget - this.zoom) > 1e-4
    )
  }
}

function clamp(v) {
  return v < -MAX ? -MAX : v > MAX ? MAX : v
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
