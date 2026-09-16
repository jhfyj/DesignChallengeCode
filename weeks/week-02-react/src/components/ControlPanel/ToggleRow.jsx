import SegmentedRow from './SegmentedRow.jsx'

// A fixed Off/On SegmentedRow — same markup/CSS/sliding-pill motion, just
// mapped to a boolean instead of an arbitrary options list.
export default function ToggleRow({ label, value, onChange }) {
  return (
    <SegmentedRow
      label={label}
      value={value ? 'On' : 'Off'}
      options={['Off', 'On']}
      onChange={(opt) => onChange(opt === 'On')}
    />
  )
}
