export default function ButtonRow({ label, buttonLabel, onClick }) {
  return (
    <div className="field-row button-row">
      <span className="field-row__label">{label}</span>
      <button type="button" className="button-row__btn" onClick={onClick}>
        {buttonLabel}
      </button>
    </div>
  )
}
