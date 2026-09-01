import { useCallback, useRef } from 'react'

// Wraps getUserMedia + an AnalyserNode so callers can pull the live
// time-domain waveform while recording, without ever persisting the audio
// itself. If the mic is unavailable or permission is denied, start()
// resolves false so the caller can fall back to a simulated animation
// instead.
export default function useMicAnalyser() {
  const streamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const dataRef = useRef(null)

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) return false

    const getMic = navigator.mediaDevices.getUserMedia({ audio: true })
    // Long enough for a human to actually respond to a permission prompt —
    // too short a race here silently falls back before they've even had a
    // chance to click "Allow".
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 8000))

    try {
      const stream = await Promise.race([getMic, timeout])
      if (!stream) return false

      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioCtx()
      // Browsers commonly create a new AudioContext in a "suspended" state —
      // without resuming it, the analyser silently receives no audio at all,
      // which is exactly what "not responding to my voice" looks like.
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      // Time-domain (oscilloscope-style), not frequency magnitude — fftSize
      // sets how many raw waveform samples getByteTimeDomainData returns.
      // 2048 is the standard size real waveform visualizers use (it's what
      // MDN's own oscilloscope example uses): enough samples that a real
      // voice's actual up/down oscillation is visible once downsampled,
      // instead of a single lump of "energy" per band.
      analyser.fftSize = 2048
      source.connect(analyser)

      streamRef.current = stream
      audioCtxRef.current = ctx
      analyserRef.current = analyser
      dataRef.current = new Uint8Array(analyser.fftSize)
      return true
    } catch {
      return false
    }
  }, [])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {})
    }
    streamRef.current = null
    audioCtxRef.current = null
    analyserRef.current = null
    dataRef.current = null
  }, [])

  // Returns `pointCount` samples of the actual live waveform, each in
  // -1..1 and centered on 0 (128 in the raw byte data is silence) — real
  // oscilloscope-style time-domain data, not frequency magnitude. This is
  // what makes the line genuinely go both up AND down: frequency-magnitude
  // data is inherently non-negative (it's energy, not signed pressure), so
  // any "up vs down" derived from it has to be faked with a heuristic —
  // one was tried here before (alternating by band position, then leaning
  // by spectral centroid) and both still visibly favored one direction for
  // real voice. The actual waveform doesn't have that problem: volume
  // shows up as how far each sample swings from 0, and pitch as how
  // quickly it swings back and forth, both for free from the real signal.
  // Returns null if there's no analyser.
  const sampleWaveform = useCallback((pointCount) => {
    const analyser = analyserRef.current
    const data = dataRef.current
    if (!analyser || !data) return null

    analyser.getByteTimeDomainData(data)
    const step = data.length / pointCount
    const points = []
    for (let i = 0; i < pointCount; i++) {
      const idx = Math.min(data.length - 1, Math.floor(i * step))
      points.push((data[idx] - 128) / 128)
    }
    return points
  }, [])

  return { start, stop, sampleWaveform }
}
