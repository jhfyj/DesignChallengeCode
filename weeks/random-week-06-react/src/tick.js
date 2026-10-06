// Feedback for each detent the scrubber clicks past.

const SOUND = true

let audio = null

function click() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') audio.resume()
    const t = audio.currentTime
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(520, t)
    osc.frequency.exponentialRampToValueAtTime(170, t + 0.03)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.035, t + 0.003)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045)
    osc.connect(gain).connect(audio.destination)
    osc.start(t)
    osc.stop(t + 0.05)
  } catch {
    // No audio available; the visual tick still plays.
  }
}

export function tick(dot) {
  if (SOUND) click()
  if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(8)
  dot?.animate([{ transform: 'scale(1.9)' }, { transform: 'none' }], {
    duration: 260,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  })
}
