export default function TimeRangeRow({ startTime, endTime, onStartChange, onEndChange }) {
  return (
    <div className="time-range-row">
      <div className="field-row time-range-row__field">
        <input
          className="field-row__input"
          type="text"
          placeholder="Start Time"
          value={startTime}
          onChange={(e) => onStartChange(e.target.value)}
        />
      </div>
      <span className="time-range-row__dash">—</span>
      <div className="field-row time-range-row__field">
        <input
          className="field-row__input"
          type="text"
          placeholder="End Time"
          value={endTime}
          onChange={(e) => onEndChange(e.target.value)}
        />
      </div>
    </div>
  )
}
