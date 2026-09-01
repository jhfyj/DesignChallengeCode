import { Sun } from '@carbon/icons-react'
import useClock from '../../hooks/useClock.js'
import './DigitalClockFace.css'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad2(n) {
  return String(n).padStart(2, '0')
}

// Steps/weather are mock stats, same as TASKS/RESULTS elsewhere in this
// app — there's no real sensor or weather data behind this.
const MOCK_STEPS = '2K STEPS'
const MOCK_WEATHER = 'Sunny'

export default function DigitalClockFace() {
  const now = useClock()

  const hour24 = now.getHours()
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  const ampm = hour24 >= 12 ? 'PM' : 'AM'
  const time = `${pad2(hour12)}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`
  const date = `${pad2(now.getMonth() + 1)}/${pad2(now.getDate())}`
  const day = DAY_NAMES[now.getDay()]

  return (
    <div className="digital-face">
      <div className="digital-face__date">
        <span>{date}</span>
        <span>{day}</span>
      </div>

      <div className="digital-face__time-block">
        {/* Each line is a crisp copy plus a blurred ghost duplicate,
            stacked in the same grid cell and both masked so the crisp
            text fades to transparent while the blurred one fades in behind
            it — the digits read as dissolving into the black background
            underneath rather than just cutting off flat. */}
        <div className="digital-face__time-stack">
          <p className="digital-face__time">{time}</p>
          <p className="digital-face__time digital-face__time--blur" aria-hidden="true">
            {time}
          </p>
        </div>
        <div className="digital-face__ampm-stack">
          <p className="digital-face__ampm">{ampm}</p>
          <p className="digital-face__ampm digital-face__ampm--blur" aria-hidden="true">
            {ampm}
          </p>
        </div>
      </div>

      <div className="digital-face__stats">
        <span>{MOCK_STEPS}</span>
        <span className="digital-face__weather">
          <Sun size={20} />
          {MOCK_WEATHER}
        </span>
      </div>
    </div>
  )
}
