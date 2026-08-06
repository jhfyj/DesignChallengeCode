import { ChevronDown } from '@carbon/icons-react'
import ImageUpload from './ImageUpload.jsx'
import TextRow from './TextRow.jsx'

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
          <TextRow nested placeholder="Title" value={speaker.title} onChange={(title) => onChange({ title })} />
          <TextRow nested placeholder="Role" value={speaker.role} onChange={(role) => onChange({ role })} />
          <TextRow nested placeholder="Company" value={speaker.company} onChange={(company) => onChange({ company })} />
        </div>
      )}
    </div>
  )
}
