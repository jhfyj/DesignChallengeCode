import {
  AlignHorizontalLeft, AlignHorizontalCenter, AlignHorizontalRight,
  AlignVerticalTop, AlignVerticalCenter, AlignVerticalBottom,
} from '@carbon/icons-react'

const H_OPTIONS = [
  { value: 'left', Icon: AlignHorizontalLeft, label: 'Align left' },
  { value: 'center', Icon: AlignHorizontalCenter, label: 'Align center' },
  { value: 'right', Icon: AlignHorizontalRight, label: 'Align right' },
]
const V_OPTIONS = [
  { value: 'top', Icon: AlignVerticalTop, label: 'Align top' },
  { value: 'middle', Icon: AlignVerticalCenter, label: 'Align middle' },
  { value: 'bottom', Icon: AlignVerticalBottom, label: 'Align bottom' },
]

export default function AlignmentRow({ alignH, alignV, onChangeH, onChangeV }) {
  return (
    <div className="field-row alignment-row">
      <div className="alignment-row__group">
        {H_OPTIONS.map(({ value, Icon, label }) => (
          <button
            key={value}
            type="button"
            className={value === alignH ? 'is-active' : ''}
            onClick={() => onChangeH(value)}
            aria-label={label}
            aria-pressed={value === alignH}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
      <div className="alignment-row__group">
        {V_OPTIONS.map(({ value, Icon, label }) => (
          <button
            key={value}
            type="button"
            className={value === alignV ? 'is-active' : ''}
            onClick={() => onChangeV(value)}
            aria-label={label}
            aria-pressed={value === alignV}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
    </div>
  )
}
