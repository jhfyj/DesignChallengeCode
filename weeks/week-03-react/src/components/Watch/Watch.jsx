import { useEffect, useState } from 'react'
import ListeningScreen from './ListeningScreen.jsx'
import RingScreen from './RingScreen.jsx'
import ProcessingScreen from './ProcessingScreen.jsx'
import CompleteScreen from './CompleteScreen.jsx'
import DirectionCard from './DirectionCard.jsx'
import RimMorph, { RIM_MORPH_MS, RIM_SETTLE_MS } from './RimMorph.jsx'
import './Watch.css'

export default function Watch({ flow }) {
  const {
    phase,
    checkpointIndex,
    elapsedSeconds,
    cycleId,
    micBootId,
    tasks,
    onListenStart,
    onListenStop,
    onRingSequenceDone,
    onConfirmAccept,
    onConfirmDecline,
  } = flow

  // 'off' | 'morph' | 'settle'. Declining hands the rim and both of its
  // protrusions to RimMorph as one shape while the card and the listening
  // screen crossfade underneath it — the phase flips immediately rather
  // than after a wing animation, because there is no longer a per-wing
  // animation to wait on. 'settle' is the short beat where RimMorph fades
  // off the listening screen's own (identical, by then) wing.
  const [rimStage, setRimStage] = useState('off')

  useEffect(() => {
    if (rimStage === 'off') return undefined
    const next = rimStage === 'morph' ? 'settle' : 'off'
    const id = setTimeout(
      () => setRimStage(next),
      rimStage === 'morph' ? RIM_MORPH_MS : RIM_SETTLE_MS,
    )
    return () => clearTimeout(id)
  }, [rimStage])

  const handleDecline = (event) => {
    setRimStage('morph')
    onConfirmDecline(event)
  }

  return (
    <div className="watch">
      <div className="watch__band watch__band--top" />
      <div className="watch__band watch__band--bottom" />

      <div className="watch__case">
        <div className="watch__bezel">
          <div className="watch__screen">
            {/* The default face — ticking hands over the white/gradient
                dial — doubles as the listening screen: pressing the mic
                doesn't cut to a different screen, it just starts recording
                on the one that's already showing, so nothing "jumps." */}
            <ListeningScreen
              visible={phase === 'idle' || phase === 'listening' || phase === 'unclear'}
              onStart={onListenStart}
              onStop={onListenStop}
              micBootId={micBootId}
              wingHidden={rimStage === 'morph'}
            />

            <RingScreen
              visible={phase === 'ring'}
              taskCount={tasks.length}
              onSequenceDone={onRingSequenceDone}
            />

            <ProcessingScreen
              visible={phase === 'progress'}
              tasks={tasks}
              checkpointIndex={checkpointIndex}
              cycleId={cycleId}
              elapsedSeconds={elapsedSeconds}
            />

            <CompleteScreen visible={phase === 'complete'} />

            <DirectionCard
              visible={phase === 'confirm'}
              onAccept={onConfirmAccept}
              onDecline={handleDecline}
            />

            {/* Above every screen: the rim and its protrusions as one
                shape, for as long as it takes the card's two to merge into
                the listening screen's one. See rimShape.js. */}
            <RimMorph stage={rimStage} />
          </div>
        </div>
      </div>
    </div>
  )
}
