import { useCallback, useEffect, useState } from 'react'

// Placeholder task breakdown for "help me find the nearest restaurant that
// you think I'll like" — none of this is real, just stand-in steps for the
// mockup. Durations are deliberately uneven — a real step-by-step process
// doesn't move at one steady pace, some steps are quick lookups and others
// take a while.
export const TASKS = [
  { label: 'Researching', durationMs: 2200 },
  { label: 'Locating', durationMs: 4500 },
  { label: 'Comparing', durationMs: 3000 },
  { label: 'Filtering', durationMs: 5000 },
  { label: 'Confirming', durationMs: 2600 },
]

// How long the ring sits fully closed on "Complete" before handing off to
// the direction card — long enough to actually read as its own screen
// instead of a flicker between the last task and the card.
const COMPLETE_MS = 1100
// A press held for less than this almost certainly isn't real speech —
// there's no actual speech recognition here, so hold duration is the
// stand-in signal for "didn't catch that." Exported so ListeningScreen can
// decide whether a stop is worth playing the wave-to-ring morph over
// (there's no point dissolving into a loading ring for a request that's
// about to land on "didn't catch that" instead of processing).
export const MIN_COHERENT_HOLD_MS = 500
const UNCLEAR_HOLD_MS = 2800

function wait(ms, bag) {
  return new Promise((resolve) => {
    const id = setTimeout(resolve, ms)
    bag.push(id)
  })
}

// Phases: idle -> listening -> ring -> progress -> complete -> confirm -> idle
//
// "ring" and "progress" are deliberately two separate screens/components
// (RingScreen, then ProcessingScreen), not one continuous state — the ring
// is a generic "please wait" beat with no task content yet (continuing
// straight on from ListeningScreen's wave-to-ring morph), and only once
// that beat is done does the real, task-labeled progress screen take over.
export default function useAssistantFlow() {
  const [phase, setPhase] = useState('idle')
  // -1 means "no task active yet."
  const [checkpointIndex, setCheckpointIndex] = useState(-1)
  // Bumped on every reset so the progress arc's segments (which stay
  // permanently filled once a checkpoint completes, rather than resetting
  // themselves) know to remount fresh for the next request instead of
  // still showing the previous cycle's arc already complete.
  const [cycleId, setCycleId] = useState(0)
  // A real running clock for whichever task is currently active — resets
  // to 0 the moment a task starts and counts up for as long as it's in
  // progress, instead of showing a fixed preset value.
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const onListenStart = useCallback(() => setPhase('listening'), [])
  const onListenStop = useCallback((durationMs) => {
    setPhase(durationMs < MIN_COHERENT_HOLD_MS ? 'unclear' : 'ring')
  }, [])

  // ring -> progress. RingScreen itself owns the timing here (spin -> close
  // into a full circle -> collapse to a dot -> checkpoint dots pop in one
  // by one) and calls this once that whole sequence finishes, rather than
  // this hook cutting away on a flat timer — the same pattern ListeningScreen
  // already uses for its own wave-to-ring morph via onStop.
  const onRingSequenceDone = useCallback(() => setPhase('progress'), [])

  // Cycles through each task's label + a running timer, then hands off to
  // a brief "Complete" beat (see below) rather than cutting straight to
  // the confirm card the instant the last task's ring segment closes.
  useEffect(() => {
    if (phase !== 'progress') return
    let cancelled = false
    const timeouts = []
    const intervals = []

    async function run() {
      for (let i = 0; i < TASKS.length; i++) {
        if (cancelled) return
        const duration = TASKS[i].durationMs

        setCheckpointIndex(i)
        setElapsedSeconds(0)

        const tickId = setInterval(() => setElapsedSeconds((s) => s + 1), 1000)
        intervals.push(tickId)

        await wait(duration, timeouts)
        clearInterval(tickId)
        if (cancelled) return
      }
      if (!cancelled) setPhase('complete')
    }

    run()
    return () => {
      cancelled = true
      timeouts.forEach(clearTimeout)
      intervals.forEach(clearInterval)
    }
  }, [phase])

  // complete -> confirm, once the closed ring has had its moment.
  useEffect(() => {
    if (phase !== 'complete') return
    const id = setTimeout(() => setPhase('confirm'), COMPLETE_MS)
    return () => clearTimeout(id)
  }, [phase])

  // unclear -> idle, giving up on the mic automatically if the user doesn't
  // just press it again to retry.
  useEffect(() => {
    if (phase !== 'unclear') return
    const id = setTimeout(() => setPhase('idle'), UNCLEAR_HOLD_MS)
    return () => clearTimeout(id)
  }, [phase])

  // confirm -> idle, resetting everything for the next request. Accept vs.
  // decline is only meaningful to whatever would consume it in a real app —
  // there's no actual navigation to start here, so both just reset.
  const resetToIdle = useCallback(() => {
    setPhase('idle')
    setCheckpointIndex(-1)
    setElapsedSeconds(0)
    setCycleId((c) => c + 1)
  }, [])

  // Bumped only on decline, never on accept — this is what tells
  // ListeningScreen to replay its mic-wing grow-in instead of leaving it at
  // its already-settled state. DirectionCard's own two wings play their
  // "collapse toward center" animation first and only call onConfirmDecline
  // once that finishes (see DirectionCard.jsx), so by the time this fires
  // and ListeningScreen crossfades in, the big wing growing in reads as a
  // continuation of the two small ones converging rather than an unrelated
  // second animation.
  const [micBootId, setMicBootId] = useState(0)
  const onConfirmDecline = useCallback(() => {
    setMicBootId((id) => id + 1)
    resetToIdle()
  }, [resetToIdle])

  return {
    phase,
    checkpointIndex,
    elapsedSeconds,
    cycleId,
    micBootId,
    tasks: TASKS,
    onListenStart,
    onListenStop,
    onRingSequenceDone,
    onConfirmAccept: resetToIdle,
    onConfirmDecline,
  }
}
