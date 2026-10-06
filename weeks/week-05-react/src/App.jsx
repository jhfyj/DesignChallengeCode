import { useEffect, useRef, useState } from 'react'
import { APERTURE, SCENE, buildScene } from './scene.js'
import { DEFAULT_WEIGHT, Renderer } from './renderer.js'
import { DragCamera } from './controls.js'
import './App.css'

// How far the drag range slides the camera.
//
// The camera translates and never rotates. That is structural, not a setting:
// nothing in the drag or zoom path writes an orientation, so no gesture can
// tilt the view. It is also why the graph-paper sheet stays flat and square --
// a plane parallel to the image plane translates without keystoning, while any
// rotation would immediately keystone the page.
const SWAY_X = 6
const SWAY_Y = 6

// Half the aperture, as a fraction of each viewport axis, when pulled fully
// back. The camera settles at whichever distance satisfies the tighter of the
// two, which is what leaves the generous run of graph paper all around it.
const FIT_X = 0.095
const FIT_Y = 0.18

// Zoom limits, in world units along the view axis. The sheet is the plane z = 0.
// Closest approach when not lined up with the opening. The renderer sets the
// real stop, from how coarse the paper's own squares have become; this is only
// a floor under it, so pressing right up against the sheet stays impossible
// however the field of view is retuned.
const NEAR_Z = 2.5
const DEEP_Z = -12 // deepest point inside the corridor
const ENTER_Z = 2 // where the walls begin funnelling the drag range in
// The walkway inside. These are not just where the massing is -- they are how
// close you are allowed to get to it. The clear channel is a unit either side
// of the centre, but stopping at 0.6 left only 0.4 to the wall, and at this
// field of view a face that close fills the frame and its near edge runs off
// screen, which reads as having gone through it. Backing off to 0.35 keeps
// most of a unit of air in front of every surface. Vertically the tight spots
// are the header above and the right mass's top, not the floor and ceiling.
const WALK_X = 0.35 // half-width of the clear walkway inside
const WALK_Y = 2.2
const ALIGN_MARGIN = 0.5 // how far inside the rim you must be to pass through

// A second press this soon after the first, and this close to it, is the second
// half of a double-click. The browser's own dblclick event is no use here: it
// only arrives once the gesture is over, and this one has to be known at press
// time so that the press can paint instead of pan.
const DOUBLE_MS = 320
const DOUBLE_SLOP = 18 // CSS px

export default function App() {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const rendererRef = useRef(null)
  const requestRef = useRef(null)
  const [weight, setWeight] = useState(DEFAULT_WEIGHT)
  const [sketch, setSketch] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const scene = buildScene(SCENE)
    const renderer = new Renderer(canvas, scene)
    const ctrl = new DragCamera()
    const cam = { x: 0, y: 0, z: 16, fov: 0.95 }
    rendererRef.current = renderer

    let fitZ = 16
    let lastZ = 16

    // Drag pulls the world with the finger, so the camera slides the other way.
    // Zoom then pushes it along the view axis, gated on the opening.
    const applyCamera = () => {
      const t = ctrl.zoom

      // How far through the opening the camera already is decides how much room
      // the drag has. Outside, it roams the whole sheet; once through, it is
      // funnelled down to the clear walkway. This reads last frame's depth on
      // purpose -- depth depends on alignment and alignment depends on the
      // range, so something has to break the cycle, and a one-frame-old depth
      // is invisible under the damping.
      const enter = clamp01((ENTER_Z - lastZ) / ENTER_Z)
      const limX = SWAY_X + (WALK_X - SWAY_X) * enter
      const limY = SWAY_Y + (WALK_Y - SWAY_Y) * enter

      const x = clampAbs(-ctrl.x * SWAY_X, limX)
      const y = clampAbs(ctrl.y * SWAY_Y, limY)

      // You can only pass through the sheet where there is a hole in it. Lined
      // up with the aperture, zooming carries you into the corridor; anywhere
      // else it stops short of the paper. Testing the funnelled position rather
      // than the raw drag is what stops a hard drag from ejecting you once you
      // are already inside.
      const aligned =
        Math.abs(x) < APERTURE.AX - ALIGN_MARGIN &&
        Math.abs(y) < APERTURE.AY - ALIGN_MARGIN
      const wanted = fitZ + (DEEP_Z - fitZ) * t
      const near = Math.max(NEAR_Z, renderer.paperZoomLimit(cam))
      const z = Math.max(wanted, aligned ? DEEP_Z : near)

      lastZ = z
      cam.x = x
      cam.y = y
      cam.z = z
    }

    const draw = () => {
      applyCamera()
      renderer.render(cam)
    }

    // Style changes repaint through here rather than through kick(): the loop is
    // parked whenever nothing is moving, and a parked loop waiting on a
    // throttled rAF (background tab, occluded window) would swallow the change.
    requestRef.current = draw

    let raf = 0
    let running = false
    let last = performance.now()

    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const moving = ctrl.step(dt)
      draw()
      if (moving || renderer.animating(now)) {
        raf = requestAnimationFrame(frame)
      } else {
        running = false
      }
    }

    // Nothing is animating most of the time; only spin the loop when it matters.
    const kick = () => {
      if (running) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }

    let px = 0, py = 0

    // A press either pans or paints, never both. Panning is the default; the
    // second press of a double-click paints instead, and holding it turns that
    // flip into a trail. Suppressing the pan for that one gesture is the whole
    // trick -- otherwise the paper would slide out from under the trail.
    let lastDownAt = 0, lastDownX = 0, lastDownY = 0
    let painting = null // the state the trail is laying down, or null to pan
    let originX = 0, originY = 0 // canvas origin, read once per gesture

    const onDown = (e) => {
      canvas.setPointerCapture(e.pointerId)

      const now = performance.now()
      const second =
        now - lastDownAt < DOUBLE_MS &&
        Math.abs(e.clientX - lastDownX) < DOUBLE_SLOP &&
        Math.abs(e.clientY - lastDownY) < DOUBLE_SLOP
      lastDownAt = now
      lastDownX = e.clientX
      lastDownY = e.clientY

      if (second) {
        const r = canvas.getBoundingClientRect()
        originX = r.left
        originY = r.top
        const state = renderer.flipAt(cam, e.clientX - originX, e.clientY - originY)
        if (state !== null) {
          painting = state
          px = e.clientX; py = e.clientY
          lastDownAt = 0 // a third press starts a fresh double-click
          canvas.style.cursor = 'crosshair'
          kick()
          return
        }
      }

      px = e.clientX; py = e.clientY
      ctrl.down()
      kick()
    }

    const onMove = (e) => {
      if (painting !== null) {
        renderer.paintTrail(
          cam,
          px - originX, py - originY,
          e.clientX - originX, e.clientY - originY,
          painting,
        )
        px = e.clientX; py = e.clientY
        kick()
        return
      }
      if (!ctrl.dragging) return
      ctrl.move(e.clientX - px, e.clientY - py, renderer.w, renderer.h)
      px = e.clientX; py = e.clientY
      kick()
    }

    const onUp = (e) => {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
      if (painting !== null) {
        painting = null
        canvas.style.cursor = ''
        return
      }
      ctrl.up()
      kick()
    }
    const onWheel = (e) => {
      e.preventDefault() // the canvas owns the gesture; the page must not scroll
      ctrl.zoomBy(e.deltaY, e.deltaMode === 1)
      kick()
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    // Sizing has to be self-healing: a first measurement of zero (observer firing
    // before layout) must not leave the canvas stuck at its default 300x150, and
    // ResizeObserver is not guaranteed to fire again on its own.
    let sizeRaf = 0
    const syncSize = () => {
      const r = wrap.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) {
        cancelAnimationFrame(sizeRaf)
        sizeRaf = requestAnimationFrame(syncSize)
        return
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (!renderer.resize(r.width, r.height, dpr)) return
      // Pull the camera back until the aperture fits both axes, so a phone in
      // portrait frames it the same way a wide window does.
      const focal = (renderer.h * 0.5) / Math.tan(cam.fov * 0.5)
      fitZ = Math.max(
        (APERTURE.AY * focal) / (FIT_Y * renderer.h),
        (APERTURE.AX * focal) / (FIT_X * renderer.w),
      )
      draw()
    }
    syncSize()

    const ro = new ResizeObserver(syncSize)
    ro.observe(wrap)
    window.addEventListener('resize', syncSize)

    return () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(sizeRaf)
      ro.disconnect()
      window.removeEventListener('resize', syncSize)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('wheel', onWheel)
      rendererRef.current = null
      requestRef.current = null
    }
  }, [])

  // Clearing is a one-shot command, not state React owns: the squares live on
  // the renderer, so this empties them and repaints once.
  const clearAll = () => {
    const renderer = rendererRef.current
    if (renderer && renderer.clearCells()) requestRef.current()
  }

  // Style lives on the renderer, not in React state that the frame loop reads.
  // Changing it repaints once, immediately.
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return
    renderer.setStyle({ lineWidth: weight, sketch })
    requestRef.current()
  }, [weight, sketch])

  return (
    <main className={sketch ? 'app is-sketch' : 'app'} ref={wrapRef}>
      <canvas ref={canvasRef} className="stage" />
      <div className="panel">
        <label className="dial">
          <span className="dial-name">line</span>
          <input
            type="range"
            min="0.25"
            max="2.5"
            step="0.05"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
          />
          <span className="dial-value">{weight.toFixed(2)}</span>
        </label>
        <button
          type="button"
          className={sketch ? 'toggle is-on' : 'toggle'}
          aria-pressed={sketch}
          onClick={() => setSketch((v) => !v)}
        >
          hand-drawn
        </button>
        <span className="hint">drag &middot; scroll to zoom &middot; double-click to fill</span>
      </div>
      <button type="button" className="clear" onClick={clearAll}>
        clear all
      </button>
    </main>
  )
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function clampAbs(v, lim) {
  return v < -lim ? -lim : v > lim ? lim : v
}
