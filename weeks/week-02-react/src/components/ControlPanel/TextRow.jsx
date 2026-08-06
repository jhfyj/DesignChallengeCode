import { Return } from '@carbon/icons-react'

function Row({ value, onChange, placeholder, tall }) {
  if (tall) {
    return (
      <div className="field-row field-row--textarea">
        <textarea
          className="field-row__textarea"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }

  return (
    <div className="field-row">
      <input
        className="field-row__input"
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export default function TextRow({ value, onChange, placeholder, tall = false, nested = false }) {
  const row = <Row value={value} onChange={onChange} placeholder={placeholder} tall={tall} />

  if (!nested) return row

  return (
    <div className="nested-row">
      <Return size={16} className="nested-row__icon nested-row__icon--flip" aria-hidden="true" />
      {row}
    </div>
  )
}
