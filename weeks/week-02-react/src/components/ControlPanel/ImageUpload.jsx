import { useRef } from 'react'
import { Close, Return, Upload } from '@carbon/icons-react'
import { fileToDataUrl } from '../../utils/fileToDataUrl.js'

function Row({ label, value, onChange }) {
  const inputRef = useRef(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onChange({ file, url: await fileToDataUrl(file) })
  }

  return (
    <div className="field-row image-upload">
      <span className="field-row__label">{label}</span>
      {value ? (
        <div className="image-upload__chip">
          <img src={value.url} alt="" className="image-upload__thumb" />
          <span className="image-upload__name">{value.file.name}</span>
          <button
            type="button"
            className="image-upload__remove"
            onClick={() => onChange(null)}
            aria-label="Remove image"
          >
            <Close size={14} />
          </button>
        </div>
      ) : (
        <button type="button" className="field-row__value image-upload__button" onClick={() => inputRef.current?.click()}>
          Upload
          <Upload size={14} />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="image-upload__input"
        onChange={handleFile}
      />
    </div>
  )
}

export default function ImageUpload({
  label,
  value,
  onChange,
  nested = false,
  nestedIcon: NestedIcon = Return,
  flipIcon = true,
  iconClassName = '',
  onIconClick,
}) {
  const row = <Row label={label} value={value} onChange={onChange} />

  if (!nested) return row

  const icon = (
    <NestedIcon
      size={16}
      className={`nested-row__icon${flipIcon ? ' nested-row__icon--flip' : ''} ${iconClassName}`}
      aria-hidden={!onIconClick}
    />
  )

  return (
    <div className="nested-row">
      {onIconClick ? (
        <button type="button" className="nested-row__icon-btn" onClick={onIconClick} aria-label="Toggle speaker details">
          {icon}
        </button>
      ) : (
        icon
      )}
      {row}
    </div>
  )
}
