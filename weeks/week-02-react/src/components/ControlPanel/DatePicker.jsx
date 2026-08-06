import { useState } from 'react'
import { ChevronDown } from '@carbon/icons-react'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function buildDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)
  return days
}

export default function DatePicker({ value, onChange }) {
  const today = new Date()
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(value ? value.getFullYear() : today.getFullYear())
  const [viewMonth, setViewMonth] = useState(value ? value.getMonth() : today.getMonth())

  const label = value
    ? `${MONTH_NAMES[value.getMonth()]} ${value.getDate()}, ${value.getFullYear()}`
    : 'Date'

  function changeMonth(delta) {
    let m = viewMonth + delta
    let y = viewYear
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    setViewMonth(m)
    setViewYear(y)
  }

  function selectDay(day) {
    onChange(new Date(viewYear, viewMonth, day))
    setOpen(false)
  }

  return (
    <div className="field-row date-picker">
      <button type="button" className="field-row__value date-picker__trigger" onClick={() => setOpen((o) => !o)}>
        <span className={value ? '' : 'date-picker__placeholder'}>{label}</span>
        <ChevronDown size={16} className="date-picker__chevron" />
      </button>
      {open && (
        <div className="date-picker__popover">
          <div className="date-picker__header">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">‹</button>
            <span>{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">›</button>
          </div>
          <div className="date-picker__weekdays">
            {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
          </div>
          <div className="date-picker__days">
            {buildDays(viewYear, viewMonth).map((day, i) => {
              if (day === null) return <span key={`blank-${i}`} />
              const isSelected =
                value &&
                value.getFullYear() === viewYear &&
                value.getMonth() === viewMonth &&
                value.getDate() === day
              return (
                <button
                  key={day}
                  type="button"
                  className={`date-picker__day${isSelected ? ' is-selected' : ''}`}
                  onClick={() => selectDay(day)}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
