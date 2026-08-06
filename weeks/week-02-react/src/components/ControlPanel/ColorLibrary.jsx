import { useEffect, useRef, useState } from 'react'
import { Add, ChevronDown, Close, Checkmark, Edit } from '@carbon/icons-react'
import { PALETTES, previewSwatches, applyPaletteOverrides } from '../../canvas/colorPalettes.js'

function CustomRow({ color, onChange, onRemove }) {
  return (
    <div className="color-library-row">
      <label className="color-library-row__swatch" style={{ background: color }}>
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="color-row__input"
          aria-label={`Edit ${color}`}
        />
      </label>
      <span className="color-library-row__hex">{color}</span>
      <button type="button" className="color-library-row__remove" onClick={onRemove} aria-label={`Remove ${color}`}>
        <Close size={14} />
      </button>
    </div>
  )
}

function PaletteCategory({ paletteName, category, onEdit, copiedValue, onCopy }) {
  return (
    <div className="color-library-category">
      <div className="color-library-category__label">{category.name}</div>
      <div className="color-library-chip-grid">
        {category.entries.map((entry) => {
          const copied = copiedValue === entry.value
          return (
            <div key={entry.label} className="color-library-chip">
              {category.addable ? (
                // `addable` categories are exactly the ones whose entries are
                // flat hex colors (see colorPalettes.js's NON_ADDABLE_CATEGORIES
                // — Overlay/Gradient are the only non-addable ones, since their
                // rgba/multi-stop values aren't something a native
                // <input type="color"> can represent), so every entry here is
                // editable in place.
                <button
                  type="button"
                  className="color-library-chip__swatch"
                  style={{ background: entry.value }}
                  title={`Click to change ${entry.value}`}
                  onClick={() => onEdit(paletteName, category.name, entry.key, entry.value)}
                >
                  <span className="color-library-chip__icon">
                    <Edit size={14} />
                  </span>
                </button>
              ) : (
                // Overlay/Gradient values aren't flat colors, so there's
                // nothing to edit here — the swatch is decorative only.
                <span className="color-library-chip__swatch" style={{ background: entry.value }} />
              )}
              <button
                type="button"
                className="color-library-chip__label"
                title={`Copy ${entry.value}`}
                onClick={() => onCopy(entry.value)}
              >
                {copied ? <Checkmark size={12} /> : null}
                {copied ? 'Copied' : entry.label}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PaletteGroup({ palette, onEdit, copiedValue, onCopy }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="color-library-palette-group">
      <button
        type="button"
        className="color-library-palette"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <ChevronDown size={16} className={`color-library-palette__chevron${open ? ' is-open' : ''}`} />
        <span className="color-library-palette__swatches">
          {previewSwatches(palette).map((color, i) => (
            <span key={i} className="color-library-palette__swatch" style={{ background: color }} />
          ))}
        </span>
        <span className="color-library-palette__name">{palette.name}</span>
      </button>
      {open && (
        <div className="color-library-palette__categories">
          {palette.categories.map((category) => (
            <PaletteCategory
              key={category.name}
              paletteName={palette.name}
              category={category}
              onEdit={onEdit}
              copiedValue={copiedValue}
              onCopy={onCopy}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ColorLibrary({ colors, onChange, paletteOverrides, onEditPaletteColor, onClose }) {
  const addInputRef = useRef(null)
  const editInputRef = useRef(null)
  // Which palette entry the shared hidden input is currently targeting —
  // a ref, not state, since it never drives a render (only read inside the
  // input's own 'change' handler).
  const editingRef = useRef(null) // { paletteName, categoryName, key } | null
  const [copiedValue, setCopiedValue] = useState(null)

  function updateColor(index, value) {
    const next = colors.slice()
    next[index] = value
    onChange(next)
  }

  function removeColor(index) {
    onChange(colors.filter((_, i) => i !== index))
  }

  // A native <input type="color"> fires React's onChange (which normalizes to
  // the DOM 'input' event) continuously while the user drags across the
  // picker's gradient/hue slider — appending on every one of those would add
  // dozens of colors per pick. The DOM 'change' event only fires once, when
  // the picker is closed/committed, so it's wired up directly rather than
  // through React's onChange prop. `onChange` here is the raw setColors state
  // setter, so a functional update sidesteps any stale-closure risk too.
  useEffect(() => {
    const input = addInputRef.current
    function handleCommit(e) {
      onChange((prev) => [...prev, e.target.value])
      e.target.value = '#000000'
    }
    input.addEventListener('change', handleCommit)
    return () => input.removeEventListener('change', handleCommit)
  }, [onChange])

  // Clicking a palette swatch edits that token in place. There's no
  // dedicated input per chip (that'd be dozens of hidden inputs) — one
  // shared hidden input is repositioned/retargeted on each click, same
  // "native input, DOM 'change' event" pattern as Add Color above.
  function startEditPaletteColor(paletteName, categoryName, key, currentValue) {
    editingRef.current = { paletteName, categoryName, key }
    const input = editInputRef.current
    input.value = currentValue
    input.click()
  }

  useEffect(() => {
    const input = editInputRef.current
    function handleCommit(e) {
      const current = editingRef.current
      if (current) onEditPaletteColor(current.paletteName, current.categoryName, current.key, e.target.value)
      editingRef.current = null
    }
    input.addEventListener('change', handleCommit)
    return () => input.removeEventListener('change', handleCommit)
  }, [onEditPaletteColor])

  function copyValue(value) {
    navigator.clipboard?.writeText(value).catch(() => {})
    setCopiedValue(value)
    setTimeout(() => setCopiedValue((v) => (v === value ? null : v)), 1200)
  }

  return (
    <div className="text-library">
      <div className="text-library__header">
        <span>Colors</span>
        <button type="button" className="text-library__close" onClick={onClose} aria-label="Close colors">
          <Close size={16} />
        </button>
      </div>
      <div className="text-library__list">
        <div className="text-library__group-label">Palettes</div>
        {PALETTES.map((palette) => (
          <PaletteGroup
            key={palette.name}
            palette={applyPaletteOverrides(palette, paletteOverrides?.[palette.name])}
            onEdit={startEditPaletteColor}
            copiedValue={copiedValue}
            onCopy={copyValue}
          />
        ))}

        <div className="text-library__group-label">Custom</div>
        {colors.map((color, i) => (
          <CustomRow key={i} color={color} onChange={(value) => updateColor(i, value)} onRemove={() => removeColor(i)} />
        ))}
        <button
          type="button"
          className="color-library-add"
          onClick={() => addInputRef.current?.click()}
        >
          <Add size={16} />
          <span>Add Color</span>
        </button>
        <input
          ref={addInputRef}
          type="color"
          defaultValue="#000000"
          className="color-library-add__input"
          aria-label="Pick a new custom color"
        />
        <input
          ref={editInputRef}
          type="color"
          defaultValue="#000000"
          className="color-library-add__input"
          aria-label="Edit a palette color"
        />
      </div>
    </div>
  )
}
