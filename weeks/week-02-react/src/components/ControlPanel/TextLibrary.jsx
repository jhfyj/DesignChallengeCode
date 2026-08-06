import { Close } from '@carbon/icons-react'

const SIZES = [12, 14, 16, 20, 24, 32, 36, 40, 48]

const GROUPS = [
  { role: 'Header', family: 'Orbitron' },
  { role: 'Body', family: 'Figtree' },
  { role: 'Accent', family: 'Fira Mono' },
]

function TextStyleRow({ family, size, onSelect }) {
  return (
    <button
      type="button"
      className="text-style-row"
      style={{ fontFamily: family }}
      onClick={() => onSelect({ family, size })}
    >
      <span className="text-style-row__glyph" style={{ fontSize: size }}>Ag</span>
      <span className="text-style-row__size">{size}px</span>
    </button>
  )
}

export default function TextLibrary({ onClose, onSelect = () => {} }) {
  return (
    <div className="text-library">
      <div className="text-library__header">
        <span>Text styles</span>
        <button type="button" className="text-library__close" onClick={onClose} aria-label="Close text styles">
          <Close size={16} />
        </button>
      </div>
      <div className="text-library__list">
        {GROUPS.map(({ role, family }) => (
          <div key={role} className="text-library__group">
            <div className="text-library__group-label">{role} · {family}</div>
            {SIZES.map((size) => (
              <TextStyleRow key={`${role}-${size}`} family={family} size={size} onSelect={onSelect} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
