import { useCallback, useEffect, useRef, useState } from 'react'
import TicketCard from './components/TicketCard'
import './App.css'

const DESIGN_WIDTH = 259
const DESIGN_HEIGHT = 661
const RESERVED_HEIGHT = 280
const TILT_MAX = 6
// how much room to leave clear at the bottom of the viewport for the
// drag-hint pill when the card is grown -- kept as one shared number so the
// scale math and the hint's CSS position can never drift out of sync with
// each other (see .drag-hint's `bottom` in App.css, which uses this same
// value)
const ACTIVE_BOTTOM_RESERVE = 110
const ACTIVE_SIDE_MARGIN = 0.92
// the QR code sits at top:453px, height:153px within the 661px-tall card
// (see TicketCard.css) -- its vertical center is (453 + 153/2) / 661. When
// grown, the card is anchored to the viewport at THIS point instead of its
// own geometric center, so the QR (the thing the user is actually zooming
// in to look at) ends up centered on screen rather than the card as a whole.
const QR_ANCHOR_PERCENT = ((453 + 153 / 2) / DESIGN_HEIGHT) * 100

const NEXT_STAGE = {
  tearing: 'thanks',
  thanks: 'thanksFade',
  thanksFade: 'reassemblePrep',
  reassemblePrep: 'reassemble',
  reassemble: 'stacked',
}

const STAGE_DURATION = {
  tearing: 650,
  thanks: 1800,
  thanksFade: 500,
  reassemblePrep: 40,
  reassemble: 850,
}

const TEAR_VOLUME_MIN = 0
const TEAR_VOLUME_MAX = 0.20
// px/ms drag speed mapped to the volume range above; tuned so virtually no
// movement is silent, a slow deliberate drag stays quiet, and a quick yank
// hits the ceiling
const TEAR_SPEED_MIN = 0.04
const TEAR_SPEED_MAX = 1.2
const COMPLETE_VOLUME = 0.25
const CLICK_VOLUME = 0.5
const SWOOSH_VOLUME = 0.45
const HOVER_VOLUME = 0.02
const POPTOP_VOLUME = 0.4
const POPBOTTOM_VOLUME = 0.4
const ENTER_VOLUME = 0.35
const HINT_DELAY = 4000

const SOUND_URLS = {
  tear: '/sfx-ticket-rip.mp3',
  complete: '/sfx-tear-complete.mp3',
  click: '/sfx-ui-click.mp3',
  swoosh: '/sfx-swoosh.mp3',
  hover: '/sfx-hover.mp3',
  popupTop: '/sfx-ui-popup-top.mp3',
  popupBottom: '/sfx-ui-popup-bottom.mp3',
  enter: '/sfx-ticket-enter.mp3',
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

// HTMLAudioElement's native `loop` isn't gapless for MP3 -- encoder padding
// at the start/end of the file causes an audible click/cut right where it
// wraps around. Decoding into an AudioBuffer and looping that via the Web
// Audio API is sample-accurate: no gap, no truncation, true duration. This
// also handles one-shot UI sounds (click, swoosh, popup) off the same
// AudioContext and buffer cache.
function useSoundEngine(urls) {
  const ctxRef = useRef(null)
  const buffersRef = useRef({})
  const tearSourceRef = useRef(null)
  const tearGainRef = useRef(null)
  const [loaded, setLoaded] = useState({})

  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      ctxRef.current = new Ctx()
    }
    return ctxRef.current
  }, [])

  useEffect(() => {
    const ctx = getContext()
    Object.entries(urls).forEach(([key, url]) => {
      fetch(url)
        .then((res) => res.arrayBuffer())
        .then((buf) => ctx.decodeAudioData(buf))
        .then((decoded) => {
          buffersRef.current[key] = decoded
          setLoaded((prev) => ({ ...prev, [key]: true }))
        })
    })
  }, [getContext, urls])

  const playOneShot = useCallback(
    (key, volume = 1) => {
      const ctx = getContext()
      if (ctx.state === 'suspended') ctx.resume()
      const buffer = buffersRef.current[key]
      if (!buffer) return
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const gain = ctx.createGain()
      gain.gain.value = volume
      source.connect(gain).connect(ctx.destination)
      source.start(0)
    },
    [getContext]
  )

  const startTear = useCallback(
    (initialVolume) => {
      const ctx = getContext()
      if (ctx.state === 'suspended') ctx.resume()
      const buffer = buffersRef.current.tear
      if (!buffer) return
      if (tearSourceRef.current) {
        try {
          tearSourceRef.current.stop()
        } catch {
          /* already stopped */
        }
      }
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true
      const gain = ctx.createGain()
      gain.gain.value = initialVolume
      source.connect(gain).connect(ctx.destination)
      source.start(0)
      tearSourceRef.current = source
      tearGainRef.current = gain
    },
    [getContext]
  )

  const setTearVolume = useCallback((value) => {
    if (tearGainRef.current) tearGainRef.current.gain.value = value
  }, [])

  const getTearVolume = useCallback(
    (fallback) => (tearGainRef.current ? tearGainRef.current.gain.value : fallback),
    []
  )

  const stopTearImmediately = useCallback(() => {
    if (tearSourceRef.current) {
      try {
        tearSourceRef.current.stop()
      } catch {
        /* already stopped */
      }
      tearSourceRef.current = null
      tearGainRef.current = null
    }
  }, [])

  const fadeOutTear = useCallback((ms = 200) => {
    const ctx = ctxRef.current
    const gain = tearGainRef.current
    const source = tearSourceRef.current
    if (!ctx || !gain || !source) return
    const now = ctx.currentTime
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.linearRampToValueAtTime(0.0001, now + ms / 1000)
    setTimeout(() => {
      try {
        source.stop()
      } catch {
        /* already stopped */
      }
    }, ms + 20)
    tearSourceRef.current = null
    tearGainRef.current = null
  }, [])

  // browsers keep a freshly-created AudioContext 'suspended' until a real
  // user gesture resumes it -- call this from directly inside a click/tap
  // handler (not an effect) so the gesture is still "live" when it fires.
  // Returns the resume promise so callers can wait for audio to actually be
  // ready (resume() has real latency -- tens to hundreds of ms -- before
  // playback can start) instead of kicking off a visual that's supposed to
  // be in sync with a sound before that sound is actually able to play.
  const unlock = useCallback(() => {
    const ctx = getContext()
    return ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()
  }, [getContext])

  return {
    startTear,
    setTearVolume,
    getTearVolume,
    stopTearImmediately,
    fadeOutTear,
    playOneShot,
    loaded,
    unlock,
  }
}

function computeScale() {
  const available = window.innerHeight - RESERVED_HEIGHT
  // No hard floor here: a floor that's bigger than what actually fits
  // forces the column taller than the viewport, which clips the heading
  // and close button top/bottom while leaving the centered card visible.
  return Math.min(1.1, Math.max(0.22, available / DESIGN_HEIGHT))
}

// lazy-initialized so the real scale is already correct on the very first
// render -- starting from a placeholder (eg. 1) and correcting a tick later
// via effect produces a visible size jump right as the entrance animation
// is playing, which reads as the ticket "changing scale" instead of a clean
// position-only slide
function useViewportScale() {
  const [scale, setScale] = useState(computeScale)
  useEffect(() => {
    const update = () => setScale(computeScale())
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return scale
}

// computed straight from the viewport -- NOT derived from the rest-state
// scale -- so it can never inherit drift from that other calculation and
// can never overflow the space the drag-hint needs at the bottom. Grown is
// also centered via its own fixed positioning (see .ticket-frame--grown in
// App.css), so this is the only number that determines its size.
function computeActiveScale() {
  const availableHeight = window.innerHeight - ACTIVE_BOTTOM_RESERVE
  const availableWidth = window.innerWidth * ACTIVE_SIDE_MARGIN
  const byHeight = availableHeight / DESIGN_HEIGHT
  const byWidth = availableWidth / DESIGN_WIDTH
  return Math.max(0.22, Math.min(byHeight, byWidth))
}

function useActiveScale() {
  const [scale, setScale] = useState(computeActiveScale)
  useEffect(() => {
    const update = () => setScale(computeActiveScale())
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return scale
}

function App() {
  const [stage, setStage] = useState('idle')
  const [dragProgress, setDragProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [focus, setFocus] = useState(null) // null | 'top' | 'bottom'
  const [showIdleHint, setShowIdleHint] = useState(false)
  const [showDragHint, setShowDragHint] = useState(false)
  const [entered, setEntered] = useState(false)
  const [started, setStarted] = useState(false)

  const scale = useViewportScale()
  const activeScale = useActiveScale()
  const dragStartX = useRef(0)
  const lineWidth = useRef(1)
  const tornTriggered = useRef(false)
  const draggingRef = useRef(false)
  const lastMoveX = useRef(0)
  const lastMoveTime = useRef(0)

  const { startTear, setTearVolume, getTearVolume, stopTearImmediately, fadeOutTear, playOneShot, loaded, unlock } =
    useSoundEngine(SOUND_URLS)

  useEffect(() => {
    const duration = STAGE_DURATION[stage]
    if (!duration) return
    const timer = setTimeout(() => setStage(NEXT_STAGE[stage]), duration)
    return () => clearTimeout(timer)
  }, [stage])

  // the entrance (slide + whoosh) waits for the tap-to-begin gate instead of
  // firing on raw mount -- browsers won't play audio before a genuine user
  // gesture, so gating on that same gesture is what lets the sound and the
  // slide-up animation actually land in sync, see handleBegin below
  useEffect(() => {
    if (!started) return
    // double-rAF: paint the pre-enter (offset) position on the first frame,
    // then flip the class on the next frame so the browser actually has a
    // "from" state to transition out of instead of skipping straight to rest
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true))
    })
    return () => cancelAnimationFrame(id)
  }, [started])

  useEffect(() => {
    if (started && loaded.enter) playOneShot('enter', ENTER_VOLUME)
  }, [started, loaded.enter, playOneShot])

  const handleBegin = useCallback(() => {
    // unlock() must be CALLED synchronously from within the gesture handler
    // itself -- resuming later (eg. from an effect) is too late for the
    // browser to still consider it "in response to" the user's tap. But we
    // wait for it to actually resolve before starting the entrance, since
    // resume() has real latency; starting the slide-up immediately would
    // make the whoosh noticeably trail the visual instead of landing with it
    unlock().then(() => setStarted(true))
  }, [unlock])

  // the swoosh plays right as the two pieces start flying back into place
  useEffect(() => {
    if (stage === 'reassemble') {
      playOneShot('swoosh', SWOOSH_VOLUME)
    }
  }, [stage, playOneShot])

  // idle hint only shows up after 5s of the user not tapping the card --
  // gated on `entered` too so the countdown can't start while the card is
  // still off screen behind the tap-to-begin gate or mid-slide-in; it should
  // only measure inactivity once the ticket is actually there to tap
  useEffect(() => {
    if (stage !== 'idle' || !entered) {
      setShowIdleHint(false)
      return
    }
    const timer = setTimeout(() => setShowIdleHint(true), HINT_DELAY)
    return () => clearTimeout(timer)
  }, [stage, entered])

  // drag hint only shows up after 5s of the user not starting the drag;
  // any dragging activity (even an aborted one) hides it and re-arms the
  // timer for the next stretch of inactivity
  useEffect(() => {
    if (stage !== 'active' || isDragging || dragProgress > 0) {
      setShowDragHint(false)
      return
    }
    const timer = setTimeout(() => setShowDragHint(true), HINT_DELAY)
    return () => clearTimeout(timer)
  }, [stage, isDragging, dragProgress])

  const onLinePointerDown = useCallback(
    (e) => {
      dragStartX.current = e.clientX
      lineWidth.current = e.currentTarget.getBoundingClientRect().width || 1
      tornTriggered.current = false
      draggingRef.current = true
      setIsDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)

      lastMoveX.current = e.clientX
      lastMoveTime.current = performance.now()

      // the drag can run longer than the clip if the user rips slowly, so
      // it loops (gaplessly) for as long as they're still mid-gesture;
      // completion and early-release both explicitly stop it below
      startTear(TEAR_VOLUME_MIN)
    },
    [startTear]
  )

  const onLinePointerMove = useCallback(
    (e) => {
      if (!draggingRef.current || tornTriggered.current) return
      const delta = Math.max(0, e.clientX - dragStartX.current)
      const progress = Math.min(1, delta / lineWidth.current)
      setDragProgress(progress)

      const now = performance.now()
      const dt = now - lastMoveTime.current
      if (dt > 0) {
        const speed = Math.abs(e.clientX - lastMoveX.current) / dt
        const normalized = clamp(
          (speed - TEAR_SPEED_MIN) / (TEAR_SPEED_MAX - TEAR_SPEED_MIN),
          0,
          1
        )
        const target = TEAR_VOLUME_MIN + normalized * (TEAR_VOLUME_MAX - TEAR_VOLUME_MIN)
        // smooth it a bit so single-frame jitter doesn't make the volume zip around
        const current = getTearVolume(TEAR_VOLUME_MIN)
        setTearVolume(current * 0.7 + target * 0.3)
        lastMoveX.current = e.clientX
        lastMoveTime.current = now
      }

      if (progress >= 1) {
        tornTriggered.current = true
        draggingRef.current = false
        setIsDragging(false)
        setStage('tearing')

        fadeOutTear(200)
        playOneShot('complete', COMPLETE_VOLUME)
      }
    },
    [getTearVolume, setTearVolume, fadeOutTear, playOneShot]
  )

  const onLinePointerUp = useCallback(() => {
    draggingRef.current = false
    setIsDragging(false)
    if (!tornTriggered.current) {
      setDragProgress(0)
      stopTearImmediately()
    }
  }, [stopTearImmediately])

  const closeFocus = useCallback(() => setFocus(null), [])

  const restart = useCallback(() => {
    setFocus(null)
    setDragProgress(0)
    setStage('idle')
  }, [])

  const handlePieceClick = useCallback(
    (which) => {
      if (stage === 'idle') {
        playOneShot('click', CLICK_VOLUME)
        setStage('active')
      } else if (stage === 'stacked') {
        playOneShot(
          which === 'top' ? 'popupTop' : 'popupBottom',
          which === 'top' ? POPTOP_VOLUME : POPBOTTOM_VOLUME
        )
        setFocus(which)
      } else if (focus) {
        closeFocus()
      }
    },
    [stage, focus, closeFocus, playOneShot]
  )

  // idle card plays the soft hover sound too; the two stacked pieces play
  // it on hover AND separately play their own distinct sound on click (see
  // handlePieceClick above)
  const handleCardHover = useCallback(() => {
    if (stage === 'idle') playOneShot('hover', HOVER_VOLUME)
  }, [stage, playOneShot])

  const handlePieceHover = useCallback(() => {
    if (stage === 'stacked') playOneShot('hover', HOVER_VOLUME)
  }, [stage, playOneShot])

  const isActive = stage === 'active'
  // grown scale holds through the fly-out (tearing/thanks/thanksFade) and
  // only eases back down once the pieces start flying back in for reassemble
  const isGrown =
    isActive ||
    stage === 'tearing' ||
    stage === 'thanks' ||
    stage === 'thanksFade' ||
    stage === 'reassemblePrep'
  const showThanks = stage === 'thanks' || stage === 'thanksFade'
  const canTilt = isActive
  const showLine = stage === 'idle' || isActive
  const showRestCaption = stage === 'stacked'

  const topTiltStyle =
    canTilt && dragProgress > 0
      ? {
          transform: `rotate(${dragProgress * TILT_MAX}deg)`,
          transition: isDragging ? 'none' : undefined,
        }
      : undefined

  const bottomTiltStyle =
    canTilt && dragProgress > 0
      ? {
          transform: `rotate(${-dragProgress * TILT_MAX}deg)`,
          transition: isDragging ? 'none' : undefined,
        }
      : undefined

  return (
    <div
      className="stage"
      style={{
        '--vscale': scale,
        '--active-scale': activeScale,
        '--qr-anchor': `${QR_ANCHOR_PERCENT}%`,
      }}
    >
      <div className="ticket-stage">
        <div className="ticket-stage__hints">
          <p
            className={`hint hint--script ticket-stage__hint${showIdleHint ? ' is-visible' : ''}`}
          >
            tap the card to continue
          </p>
          <p
            className={`hint hint--script hint--title ticket-stage__hint${showRestCaption ? ' is-visible' : ''}`}
          >
            See you at the event!
          </p>
        </div>

        <div
          className={`ticket-frame${isGrown ? ' ticket-frame--grown' : ''}${stage === 'stacked' ? ' ticket-frame--stacked' : ''}${!entered ? ' ticket-frame--pre-enter' : ''}`}
          onPointerEnter={handleCardHover}
        >
          <div className={`torn torn--${stage}`}>
            <button
              type="button"
              className={`ticket-slice ticket-slice--top${focus === 'top' ? ' ticket-slice--hidden' : ''}`}
              style={topTiltStyle}
              onClick={() => handlePieceClick('top')}
              onPointerEnter={handlePieceHover}
            >
              <TicketCard />
              {showLine && (
                <span
                  className="perforation-half perforation-half--top"
                  style={isActive ? { '--reveal': `${dragProgress * 100}%` } : undefined}
                />
              )}
            </button>
            <button
              type="button"
              className={`ticket-slice ticket-slice--bottom${focus === 'bottom' ? ' ticket-slice--hidden' : ''}`}
              style={bottomTiltStyle}
              onClick={() => handlePieceClick('bottom')}
              onPointerEnter={handlePieceHover}
            >
              <TicketCard />
              {showLine && (
                <span
                  className="perforation-half perforation-half--bottom"
                  style={isActive ? { '--reveal': `${dragProgress * 100}%` } : undefined}
                />
              )}
            </button>
            {showLine && (
              <div
                className={`perforation${isActive ? ' perforation--active' : ''}`}
                onPointerDown={isActive ? onLinePointerDown : undefined}
                onPointerMove={isActive ? onLinePointerMove : undefined}
                onPointerUp={isActive ? onLinePointerUp : undefined}
                onPointerCancel={isActive ? onLinePointerUp : undefined}
              >
                {isActive && <span className="perforation__glow" />}
              </div>
            )}
          </div>
        </div>

        <p
          className={`hint hint--script hint--title thanks-overlay${showThanks ? ' is-visible' : ''}${stage === 'thanksFade' ? ' is-fading' : ''}`}
        >
          Thanks for Registering!
        </p>

        <button
          type="button"
          className={`close-btn${stage === 'stacked' && !focus ? ' is-visible' : ''}`}
          onClick={restart}
        >
          <span className="close-btn__label">close</span>
        </button>
      </div>

      {isActive && (
        <p className={`hint hint--script drag-hint${showDragHint ? ' is-visible' : ''}`}>
          drag along the line
        </p>
      )}

      <div
        className={`inspect-backdrop${focus ? ' is-visible' : ''}`}
        onClick={closeFocus}
      />

      <div className={`inspect-popup${focus ? ' is-visible' : ''}`}>
        {focus && (
          <button
            type="button"
            className={`ticket-slice ticket-slice--popup ticket-slice--${focus}`}
            onClick={closeFocus}
          >
            <TicketCard />
          </button>
        )}
      </div>

      <button
        type="button"
        className={`enter-gate${started ? ' enter-gate--dismissed' : ''}`}
        onClick={handleBegin}
      >
        tap to begin
      </button>
    </div>
  )
}

export default App
