import { useDesignState } from '../../../state/DesignContext.jsx'
import Folder from '../Folder.jsx'
import TextRow from '../TextRow.jsx'
import TimeRangeRow from '../TimeRangeRow.jsx'
import DatePicker from '../DatePicker.jsx'
import ImageSection from '../ImageSection.jsx'

export default function ContentPanel() {
  const { content, updateContent, setSelectedKey } = useDesignState()
  const { title, subtitle, description, startTime, endTime, date, location } = content

  // Selecting the field's placement key whenever it has content (and
  // deselecting when clearing it back to empty removes the placement) makes
  // whatever the user just typed/added immediately visible on canvas with
  // its selection boundary, instead of silently landing somewhere unseen.
  function selectIfFilled(key, hasContent) {
    setSelectedKey(hasContent ? key : null)
  }

  return (
    <div className="control-panel__sections">
      <Folder title="Text Content">
        <TextRow
          value={title}
          placeholder="Title"
          onChange={(v) => {
            updateContent({ title: v })
            selectIfFilled('title', v.trim() !== '')
          }}
        />
        <TextRow
          value={subtitle}
          placeholder="Subtitle"
          onChange={(v) => {
            updateContent({ subtitle: v })
            selectIfFilled('subtitle', v.trim() !== '')
          }}
        />
        <TextRow
          value={description}
          placeholder="Description"
          onChange={(v) => {
            updateContent({ description: v })
            selectIfFilled('description', v.trim() !== '')
          }}
          tall
        />
        <DatePicker
          value={date}
          onChange={(v) => {
            updateContent({ date: v })
            selectIfFilled('date', v != null)
          }}
        />
        <TimeRangeRow
          startTime={startTime}
          endTime={endTime}
          onStartChange={(v) => {
            updateContent({ startTime: v })
            selectIfFilled('time', v.trim() !== '' || endTime.trim() !== '')
          }}
          onEndChange={(v) => {
            updateContent({ endTime: v })
            selectIfFilled('time', startTime.trim() !== '' || v.trim() !== '')
          }}
        />
        <TextRow
          value={location}
          placeholder="Location"
          onChange={(v) => {
            updateContent({ location: v })
            selectIfFilled('location', v.trim() !== '')
          }}
        />
      </Folder>
      <ImageSection />
    </div>
  )
}
