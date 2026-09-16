import { useId } from 'react'
import { motion } from 'motion/react'
import { EASE_STANDARD, DURATION_BASE } from '../../motionTokens.js'

// The active tab's background is a single shared `motion.span` that
// relocates itself (via layoutId) into whichever button is currently
// active, instead of each button separately snapping its own background
// on/off — that's what makes it visibly SLIDE between tabs rather than
// hard-cutting. useId() keeps this instance's layoutId from colliding with
// any other TabBar mounted at the same time (e.g. SingleColorRow's Brand/
// Custom toggle reuses this same component).
export default function TabBar({ tabs, active, onChange }) {
  const pillId = useId()
  return (
    <div className="control-panel__tabbar">
      {tabs.map((tab) => {
        const isActive = tab === active
        return (
          <button
            key={tab}
            type="button"
            className={`control-panel__tab${isActive ? ' is-active' : ''}`}
            onClick={() => onChange(tab)}
          >
            {isActive && (
              <motion.span
                layoutId={`${pillId}-pill`}
                className="control-panel__tab-pill"
                transition={{ duration: DURATION_BASE, ease: EASE_STANDARD }}
              />
            )}
            <span className="control-panel__tab-label">{tab}</span>
          </button>
        )
      })}
    </div>
  )
}
