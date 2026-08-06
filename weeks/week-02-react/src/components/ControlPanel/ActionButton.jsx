export default function ActionButton({ icon: Icon, label, onClick, accent = false }) {
  return (
    <button
      type="button"
      className={`action-button${accent ? ' action-button--accent' : ''}`}
      onClick={onClick}
    >
      <span>{label.toUpperCase()}</span>
      {Icon && <Icon size={16} />}
    </button>
  )
}
