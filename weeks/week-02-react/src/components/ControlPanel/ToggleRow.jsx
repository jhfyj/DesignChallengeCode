export default function ToggleRow({ label, value, onChange }) {
  return (
    <div className="field-row toggle-row">
      <span className="field-row__label">{label}</span>
      <div className="toggle-row__buttons">
        <button type="button" className={!value ? 'is-active' : ''} onClick={() => onChange(false)}>
          Off
        </button>
        <button type="button" className={value ? 'is-active' : ''} onClick={() => onChange(true)}>
          On
        </button>
      </div>
    </div>
  )
}
