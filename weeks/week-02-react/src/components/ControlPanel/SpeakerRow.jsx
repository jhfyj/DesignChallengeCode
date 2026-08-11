import { ChevronDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Return } from '@carbon/icons-react'
import ImageUpload from './ImageUpload.jsx'
import TextRow from './TextRow.jsx'
import SegmentedRow from './SegmentedRow.jsx'

// Where the name/company/role block sits relative to the speaker photo on
// the canvas (see ImageElement.jsx's CAPTION_FLEX_DIRECTION) — content, not
// a canvas-drag-driven layout property, so it's authored here alongside
// Title/Role/Company rather than in the canvas-selection panel.
const INFO_POSITION_OPTIONS = ['Below', 'Above', 'Left', 'Right']
const INFO_POSITION_ICONS = { Below: ArrowDown, Above: ArrowUp, Left: ArrowLeft, Right: ArrowRight }

export default function SpeakerRow({ index, speaker, expanded, onToggle, onChange }) {
  return (
    <div className="speaker-row">
      <ImageUpload
        label={`Headshot ${index + 1}`}
        value={speaker.image}
        onChange={(image) => onChange({ image })}
        nested
        nestedIcon={ChevronDown}
        flipIcon={false}
        iconClassName={`speaker-row__chevron${expanded ? ' is-open' : ''}`}
        onIconClick={onToggle}
      />
      {expanded && (
        <div className="speaker-row__fields">
          <div className="nested-row">
            <Return size={16} className="nested-row__icon nested-row__icon--flip" aria-hidden="true" />
            <SegmentedRow
              label="Info Position"
              value={speaker.captionPosition || 'Below'}
              options={INFO_POSITION_OPTIONS}
              icons={INFO_POSITION_ICONS}
              onChange={(captionPosition) => onChange({ captionPosition })}
            />
          </div>
          <TextRow nested placeholder="Title" value={speaker.title} onChange={(title) => onChange({ title })} />
          <TextRow nested placeholder="Role" value={speaker.role} onChange={(role) => onChange({ role })} />
          <TextRow nested placeholder="Company" value={speaker.company} onChange={(company) => onChange({ company })} />
        </div>
      )}
    </div>
  )
}
