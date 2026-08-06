import { useState } from 'react'

// Ports dialkit's own tick-mark rule (see dialkit/dist/svelte/components/Slider.svelte):
// a small discrete range (<=10 steps) gets a tick at every step boundary;
// a larger/continuous-feeling range gets 9 evenly-spaced ticks (deciles) instead
// of one per step, which would be too dense to read.
function hashMarkPositions(min, max, step) {
  const discreteSteps = (max - min) / step
  if (discreteSteps <= 10) {
    return Array.from({ length: Math.max(discreteSteps - 1, 0) }, (_, i) => ((i + 1) * step / (max - min)) * 100)
  }
  return Array.from({ length: 9 }, (_, i) => (i + 1) * 10)
}

export default function SliderRow({ label, value, min, max, step = 1, unit = '', onChange, format, showFill = true }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const pct = ((value - min) / (max - min)) * 100
  const hashMarks = hashMarkPositions(min, max, step)

  function startEdit() {
    setDraft(String(value))
    setEditing(true)
  }
  function commit() {
    const n = Number(draft)
    if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
    setEditing(false)
  }
  function handleKeyDown(e) {
    if (e.key === 'Enter') commit()
    else if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div className="field-row slider-row">
      {showFill && <div className="slider-row__fill" style={{ width: `${pct}%` }} />}
      {hashMarks.length > 0 && (
        <div className="slider-row__hashmarks">
          {hashMarks.map((left, i) => (
            <span key={i} className="slider-row__hashmark" style={{ left: `${left}%` }} />
          ))}
        </div>
      )}
      <span className="field-row__label">{label}</span>
      {editing ? (
        <input
          type="number"
          className="slider-row__edit-input"
          value={draft}
          autoFocus
          onFocus={(e) => e.target.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      ) : (
        // pointer-events: none (see fields.css) — this sits visually on top of
        // the range input below it, but a mousedown starting here needs to
        // fall through and start a drag same as anywhere else on the row, so
        // it can't also be the double-click target (see the input below).
        <span className="slider-row__value">
          {format ? format(value) : `${value}${unit}`}
        </span>
      )}
      {!editing && (
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onDoubleClick={startEdit}
          className="slider-row__input"
          aria-label={label}
        />
      )}
    </div>
  )
}
