import { useRef, useState } from 'react'

// A divider line you can drag. It's the 1px line already there, with a slim
// invisible strip over it to catch the pointer. `value` is the size it
// controls, in px; `onChange` gets the new size, which the owner clamps.
// Arrow keys nudge it, a double-click puts it back.

const STEP = 16

export default function Splitter({ orientation, value, min, max, onChange, onReset, label }) {
  const drag = useRef(null)
  const [dragging, setDragging] = useState(false)
  const sideways = orientation === 'vertical' // a vertical line moves sideways
  const pos = (e) => (sideways ? e.clientX : e.clientY)

  const end = () => {
    drag.current = null
    setDragging(false)
    document.documentElement.classList.remove('is-resizing')
  }

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      tabIndex={0}
      className={`split ${sideways ? 'split-col' : 'split-row'}${dragging ? ' is-dragging' : ''}`}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.preventDefault()
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // A synthetic pointer can't be captured; dragging still works.
        }
        drag.current = { from: pos(e), value }
        setDragging(true)
        // Keep the cursor while the pointer runs ahead of the line.
        document.documentElement.classList.add('is-resizing', sideways ? 'is-col' : 'is-row')
        document.documentElement.classList.remove(sideways ? 'is-row' : 'is-col')
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (d) onChange(d.value + pos(e) - d.from)
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const back = sideways ? 'ArrowLeft' : 'ArrowUp'
        const on = sideways ? 'ArrowRight' : 'ArrowDown'
        const step = e.shiftKey ? STEP * 3 : STEP
        if (e.key === back || e.key === on) {
          e.preventDefault()
          onChange(value + (e.key === on ? step : -step))
        } else if (e.key === 'Home') {
          e.preventDefault()
          onReset()
        }
      }}
    />
  )
}
