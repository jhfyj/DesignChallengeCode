import { View, ViewOff } from '@carbon/icons-react'

export default function FrameLabel({ name, gridVisible, onToggleGrid }) {
  const Icon = gridVisible ? View : ViewOff
  return (
    <div className="frame-label">
      <span className="frame-label__name">{name}</span>
      <button
        type="button"
        className="frame-label__toggle"
        onClick={onToggleGrid}
        aria-label={gridVisible ? 'Hide grid' : 'Show grid'}
        aria-pressed={gridVisible}
      >
        <Icon size={16} />
      </button>
    </div>
  )
}
