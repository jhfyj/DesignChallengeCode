import { useId } from 'react'
import { motion } from 'motion/react'
import { EASE_STANDARD, DURATION_BASE } from '../../motionTokens.js'

// Generic N-option segmented toggle (Dither: Low/Med/High, etc.) — reuses
// ToggleRow's exact button-group markup/CSS, just driven by an options list
// and a string value instead of being hardcoded to an Off/On boolean.
// `icons` (optional): option -> Carbon icon component, for rows that read
// better as glyphs than words (e.g. Info Position's Below/Above/Left/Right —
// see SelectedElementPanel.jsx). Falls back to the option's own text when an
// option has no icon, so existing text-only rows (Dither, etc.) are unaffected.
//
// Same sliding-pill technique as TabBar.jsx: one motion.span with a
// layoutId relocates into whichever button is active instead of each
// button hard-cutting its own background — useId() keeps this instance's
// pill independent of every other SegmentedRow/TabBar on screen.
export default function SegmentedRow({ label, value, options, onChange, icons }) {
  const pillId = useId()
  return (
    <div className="field-row toggle-row">
      <span className="field-row__label">{label}</span>
      <div className="toggle-row__buttons">
        {options.map((opt) => {
          const Icon = icons?.[opt]
          const isActive = value === opt
          return (
            <button
              key={opt}
              type="button"
              className={isActive ? 'is-active' : ''}
              onClick={() => onChange(opt)}
              aria-label={Icon ? opt : undefined}
            >
              {isActive && (
                <motion.span
                  layoutId={`${pillId}-pill`}
                  className="toggle-row__pill"
                  transition={{ duration: DURATION_BASE, ease: EASE_STANDARD }}
                />
              )}
              <span className="toggle-row__label">{Icon ? <Icon size={14} /> : opt}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
