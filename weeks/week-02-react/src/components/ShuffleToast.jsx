import { Close } from '@carbon/icons-react'
import { useDesignState } from '../state/DesignContext.jsx'
import './ShuffleToast.css'

export default function ShuffleToast() {
  const { canUndoShuffle, undoShuffle, dismissShuffleToast } = useDesignState()
  if (!canUndoShuffle) return null

  return (
    <div className="shuffle-toast">
      <span className="shuffle-toast__label">Shuffled</span>
      <button type="button" className="shuffle-toast__undo" onClick={undoShuffle}>
        Undo
      </button>
      <button type="button" className="shuffle-toast__close" onClick={dismissShuffleToast} aria-label="Dismiss">
        <Close size={16} />
      </button>
    </div>
  )
}
