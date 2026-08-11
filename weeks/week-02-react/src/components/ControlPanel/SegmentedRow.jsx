// Generic N-option segmented toggle (Dither: Low/Med/High, etc.) — reuses
// ToggleRow's exact button-group markup/CSS, just driven by an options list
// and a string value instead of being hardcoded to an Off/On boolean.
// `icons` (optional): option -> Carbon icon component, for rows that read
// better as glyphs than words (e.g. Info Position's Below/Above/Left/Right —
// see SelectedElementPanel.jsx). Falls back to the option's own text when an
// option has no icon, so existing text-only rows (Dither, etc.) are unaffected.
export default function SegmentedRow({ label, value, options, onChange, icons }) {
  return (
    <div className="field-row toggle-row">
      <span className="field-row__label">{label}</span>
      <div className="toggle-row__buttons">
        {options.map((opt) => {
          const Icon = icons?.[opt]
          return (
            <button
              key={opt}
              type="button"
              className={value === opt ? 'is-active' : ''}
              onClick={() => onChange(opt)}
              aria-label={Icon ? opt : undefined}
            >
              {Icon ? <Icon size={14} /> : opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}
