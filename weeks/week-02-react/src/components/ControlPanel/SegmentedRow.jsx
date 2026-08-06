// Generic N-option segmented toggle (Dither: Low/Med/High, etc.) — reuses
// ToggleRow's exact button-group markup/CSS, just driven by an options list
// and a string value instead of being hardcoded to an Off/On boolean.
export default function SegmentedRow({ label, value, options, onChange }) {
  return (
    <div className="field-row toggle-row">
      <span className="field-row__label">{label}</span>
      <div className="toggle-row__buttons">
        {options.map((opt) => (
          <button key={opt} type="button" className={value === opt ? 'is-active' : ''} onClick={() => onChange(opt)}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}
