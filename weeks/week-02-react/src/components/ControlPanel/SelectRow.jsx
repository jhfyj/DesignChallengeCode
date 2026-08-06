import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Checkmark } from '@carbon/icons-react'

export default function SelectRow({ label, value, onChange, options, compact = false }) {
  const [open, setOpen] = useState(false)
  const rowRef = useRef(null)

  // Native <select> popups can't be themed cross-browser, so the option list
  // is a custom popover instead — needs its own outside-click/Escape
  // handling since there's no longer a native popup for the browser to
  // dismiss for us.
  useEffect(() => {
    if (!open) return
    function handlePointerDown(e) {
      if (!rowRef.current?.contains(e.target)) setOpen(false)
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function selectOption(opt) {
    onChange(opt)
    setOpen(false)
  }

  return (
    <div className={`field-row select-row${compact ? ' select-row--compact' : ''}`} ref={rowRef}>
      {label && <span className="field-row__label">{label}</span>}
      <button
        type="button"
        className={`field-row__value select-row__trigger${label ? '' : ' select-row__display--flush'}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label || 'Select'}
      >
        <span>{value}</span>
        <ChevronDown size={compact ? 12 : 16} className="select-row__chevron" />
      </button>
      {open && (
        <div className="select-row__popover" role="listbox">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={opt === value}
              className={`select-row__option${opt === value ? ' is-selected' : ''}`}
              onClick={() => selectOption(opt)}
            >
              <span>{opt}</span>
              {opt === value && <Checkmark size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
