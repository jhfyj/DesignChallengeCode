import { Close } from '@carbon/icons-react'
import { AnimatePresence, motion } from 'motion/react'
import { useDesignState } from '../state/DesignContext.jsx'
import { EASE_ENTER, EASE_EXIT, DURATION_BASE, DURATION_MODERATE } from '../motionTokens.js'
import './ShuffleToast.css'

// Slide-from-right + opacity, per the motion-design-skill's notification
// recipe: entrance is the fuller 250ms (DURATION_MODERATE) with a
// decelerate ease so it "lands" gently; exit is the shorter 180ms
// (DURATION_BASE, ~72% of the entrance) with an accelerate ease so it
// "leaves" quickly, same directional asymmetry as every other entrance/exit
// pair in the app. AnimatePresence (not a plain conditional return) is what
// makes the exit animation possible at all — a bare `if (!x) return null`
// unmounts synchronously with no chance to animate out first.
export default function ShuffleToast() {
  const { canUndoShuffle, undoShuffle, dismissShuffleToast } = useDesignState()

  return (
    <AnimatePresence>
      {canUndoShuffle && (
        <motion.div
          key="shuffle-toast"
          className="shuffle-toast"
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0, transition: { duration: DURATION_MODERATE, ease: EASE_ENTER } }}
          exit={{ opacity: 0, x: 28, transition: { duration: DURATION_BASE, ease: EASE_EXIT } }}
        >
          <span className="shuffle-toast__label">Shuffled</span>
          <button type="button" className="shuffle-toast__undo" onClick={undoShuffle}>
            Undo
          </button>
          <button type="button" className="shuffle-toast__close" onClick={dismissShuffleToast} aria-label="Dismiss">
            <Close size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
