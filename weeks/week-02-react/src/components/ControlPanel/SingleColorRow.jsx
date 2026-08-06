import { useEffect, useRef, useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { Close, Eyedropper } from '@carbon/icons-react'
import { paletteByName, applyPaletteOverrides, addableHexSwatches } from '../../canvas/colorPalettes.js'

function hexToRgb(hex) {
  const m = hex.replace('#', '')
  return {
    r: parseInt(m.slice(0, 2), 16) || 0,
    g: parseInt(m.slice(2, 4), 16) || 0,
    b: parseInt(m.slice(4, 6), 16) || 0,
  }
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('')
}

// Uncontrolled draft so a half-typed number (e.g. clearing the field to type
// "128") doesn't get clamped/overwritten on every keystroke — only commits
// (and repaints the swatch/picker) on blur or Enter.
function RgbField({ label, value, onCommit }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])

  function commit() {
    const n = Math.max(0, Math.min(255, Math.round(Number(draft)) || 0))
    setDraft(String(n))
    if (n !== value) onCommit(n)
  }

  return (
    <label className="single-color-row__rgb-field">
      <input
        type="number"
        min={0}
        max={255}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <span>{label}</span>
    </label>
  )
}

function SwatchGrid({ label, swatches, current, onPick }) {
  if (!swatches.length) return null
  return (
    <div className="single-color-row__group">
      <div className="single-color-row__group-label">{label}</div>
      <div className="single-color-row__brand-grid">
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            className={`single-color-row__brand-swatch${c === current ? ' is-selected' : ''}`}
            style={{ background: c }}
            title={c}
            aria-label={c}
            onClick={() => onPick(c)}
          />
        ))}
      </div>
    </div>
  )
}

export default function SingleColorRow({ label, color, onChange, onReset, customColors = [], onAddCustomColor, paletteOverrides }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('Brand')
  const rowRef = useRef(null)
  // HexColorPicker's onChange fires continuously while dragging (same as a
  // native range input) — this tracks the latest value so the drag's final
  // color is what gets graduated into Custom, not every intermediate frame.
  const latestCustomColorRef = useRef(color)

  useEffect(() => {
    latestCustomColorRef.current = color
  }, [color])

  // Same outside-click/Escape pattern as SelectRow.jsx's popover.
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

  function pickSwatch(value) {
    onChange(value)
    setOpen(false)
  }

  function handleCustomChange(value) {
    latestCustomColorRef.current = value
    onChange(value)
  }

  function commitCustomColor() {
    onAddCustomColor?.(latestCustomColorRef.current)
  }

  function updateRgbChannel(channel, n) {
    const rgb = hexToRgb(color)
    const hex = rgbToHex(...['r', 'g', 'b'].map((c) => (c === channel ? n : rgb[c])))
    onChange(hex)
    onAddCustomColor?.(hex)
  }

  async function pickWithEyedropper() {
    if (!window.EyeDropper) return
    try {
      const result = await new window.EyeDropper().open()
      onChange(result.sRGBHex)
      onAddCustomColor?.(result.sRGBHex)
    } catch {
      // User backed out of the eyedropper (Escape/right-click) — nothing to do.
    }
  }

  // Deduped — the same hex legitimately backs more than one named token
  // within a palette (e.g. Editorial's black100/Text.primary/Border.strong
  // are all #000000), which would otherwise show as repeated, redundant
  // swatches in a quick-pick grid that only cares about the color itself.
  const editorial = [...new Set(addableHexSwatches(applyPaletteOverrides(paletteByName('Editorial'), paletteOverrides?.Editorial)))]
  const swiss = [...new Set(addableHexSwatches(applyPaletteOverrides(paletteByName('Swiss'), paletteOverrides?.Swiss)))]
  const rgb = hexToRgb(color)

  return (
    <div className="field-row single-color-row" ref={rowRef}>
      <button
        type="button"
        className="single-color-row__swatch"
        style={{ background: color }}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
      />
      <span className="field-row__label">{label}</span>
      {onReset && (
        <button type="button" className="single-color-row__reset" onClick={onReset} aria-label={`Reset ${label}`}>
          <Close size={14} />
        </button>
      )}
      {open && (
        <div className="single-color-row__popover">
          {/* Reuses the Design/Content/Assets tab bar's own look — the same
              toggle style everywhere in the app reads as "pick a mode". */}
          <div className="control-panel__tabbar">
            <button
              type="button"
              className={`control-panel__tab${mode === 'Brand' ? ' is-active' : ''}`}
              onClick={() => setMode('Brand')}
            >
              Brand
            </button>
            <button
              type="button"
              className={`control-panel__tab${mode === 'Custom' ? ' is-active' : ''}`}
              onClick={() => setMode('Custom')}
            >
              Custom
            </button>
          </div>

          {mode === 'Brand' ? (
            <div className="single-color-row__groups">
              <SwatchGrid label="Editorial" swatches={editorial} current={color} onPick={pickSwatch} />
              <SwatchGrid label="Swiss" swatches={swiss} current={color} onPick={pickSwatch} />
              <SwatchGrid label="Custom" swatches={customColors} current={color} onPick={pickSwatch} />
            </div>
          ) : (
            // Built in-house (react-colorful) instead of the native
            // <input type="color"> picker — the native one opens as its own
            // floating OS/browser dialog outside our layout; this renders as
            // normal DOM, so it sits inside the popover like everything else.
            <div className="single-color-row__custom" onPointerUp={commitCustomColor}>
              <HexColorPicker color={color} onChange={handleCustomChange} className="single-color-row__picker" />
              <div className="single-color-row__custom-footer">
                {typeof window !== 'undefined' && window.EyeDropper && (
                  <button
                    type="button"
                    className="single-color-row__eyedropper"
                    onClick={pickWithEyedropper}
                    aria-label="Pick a color from the screen"
                  >
                    <Eyedropper size={16} />
                  </button>
                )}
                <span className="single-color-row__custom-preview" style={{ background: color }} />
                <div className="single-color-row__rgb">
                  <RgbField label="R" value={rgb.r} onCommit={(n) => updateRgbChannel('r', n)} />
                  <RgbField label="G" value={rgb.g} onCommit={(n) => updateRgbChannel('g', n)} />
                  <RgbField label="B" value={rgb.b} onCommit={(n) => updateRgbChannel('b', n)} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
