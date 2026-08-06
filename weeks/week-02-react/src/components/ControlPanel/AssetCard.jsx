import { Add, Close } from '@carbon/icons-react'

export default function AssetCard({ name, thumbnail, glyph, locked = false, onAdd, onRemove }) {
  return (
    <div className="asset-card">
      <div className="asset-card__thumb">
        {thumbnail && <img src={thumbnail} alt="" className="asset-card__image" />}
        {!thumbnail && glyph && <span className="asset-card__glyph" aria-hidden="true">{glyph}</span>}
        {locked ? (
          // Locked assets can be added any number of times (each click drops
          // a new instance on the canvas), so this is always "Add", never a
          // toggle — removing an instance happens on the canvas itself
          // (select it, press Backspace/Delete).
          <button type="button" className="asset-card__badge" onClick={onAdd} aria-label={`Add ${name}`}>
            <Add size={14} />
          </button>
        ) : (
          <button type="button" className="asset-card__badge" onClick={onRemove} aria-label={`Remove ${name}`}>
            <Close size={14} />
          </button>
        )}
      </div>
      <span className="asset-card__name">{name}</span>
    </div>
  )
}
