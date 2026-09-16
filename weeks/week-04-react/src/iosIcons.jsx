import { useId } from 'react'

function sheen(id) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#fff" stopOpacity="0.32" />
      <stop offset="45%" stopColor="#fff" stopOpacity="0" />
      <stop offset="100%" stopColor="#000" stopOpacity="0.1" />
    </linearGradient>
  )
}

export function PhoneIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="ios-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#64DE7A" />
          <stop offset="100%" stopColor="#1DB954" />
        </linearGradient>
        {sheen(`${uid}-sheen`)}
      </defs>
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-bg)`} />
      <path
        d="M63 21c1.2-.5 2.6 0 3.3 1.1l6.2 9.6c.7 1.1.4 2.6-.6 3.4l-8 6.2c-1 .8-1.2 2.2-.5 3.3 4.8 7.4 11 13.6 18.6 18.2 1.1.7 1.5 2.1.8 3.2l-6.6 8.4c-.8 1-2.3 1.3-3.4.6C57.6 66.6 36 62.2 24.2 41.8 18 31.2 20.6 20.4 28.8 16.4c1.1-.5 2.5-.2 3.2.9l6.4 8.6c.7 1 .5 2.4-.4 3.2l-7.6 6c-1 .8-1.2 2.2-.4 3.3 3.6 5.6 8.2 10.4 13.8 14 1.1.7 2.5.5 3.3-.4l6.2-8c.8-1 2.3-1.3 3.4-.6L63 21Z"
        fill="#fff"
      />
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function SafariIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="ios-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-bg`} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#64D2FF" />
          <stop offset="55%" stopColor="#0A84FF" />
          <stop offset="100%" stopColor="#0040C8" />
        </radialGradient>
        {sheen(`${uid}-sheen`)}
      </defs>
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-bg)`} />
      <circle cx="50" cy="50" r="33" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.25" />
      {Array.from({ length: 12 }, (_, i) => (
        <line
          key={i}
          x1="50"
          y1="20"
          x2="50"
          y2={i % 3 === 0 ? 26 : 23.5}
          stroke="rgba(255,255,255,0.8)"
          strokeWidth={i % 3 === 0 ? 1.6 : 1}
          strokeLinecap="round"
          transform={`rotate(${i * 30} 50 50)`}
        />
      ))}
      <path d="M50 21 62 62 50 54 38 62Z" fill="#FF3B30" />
      <path d="M50 79 38 38 50 46 62 38Z" fill="#F2F2F7" />
      <circle cx="50" cy="50" r="3" fill="#1C1C1E" />
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function PhotosIcon() {
  const uid = useId().replace(/:/g, '')
  const petals = ['#FF453A', '#FF9F0A', '#FFD60A', '#30D158', '#64D2FF', '#0A84FF', '#BF5AF2', '#FF375F']
  return (
    <svg className="ios-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>{sheen(`${uid}-sheen`)}</defs>
      <rect width="100" height="100" rx="22.4" fill="#fff" />
      <g transform="translate(50 50)">
        {petals.map((color, i) => (
          <ellipse
            key={color}
            cx="0"
            cy="-16.5"
            rx="8.2"
            ry="16.6"
            fill={color}
            opacity="0.94"
            transform={`rotate(${i * 45})`}
          />
        ))}
        <circle r="5.5" fill="#fff" />
      </g>
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function MailIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="ios-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7DD8FF" />
          <stop offset="100%" stopColor="#0A84FF" />
        </linearGradient>
        {sheen(`${uid}-sheen`)}
      </defs>
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-bg)`} />
      <rect x="14" y="28" width="72" height="46" rx="8" fill="#fff" />
      <path d="M16 32 50 54 84 32" fill="none" stroke="#0A84FF" strokeWidth="4.4" strokeLinejoin="round" />
      <path d="M18 70 38 52M82 70 62 52" fill="none" stroke="#64D2FF" strokeWidth="3" />
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function MusicIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="ios-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF6B8A" />
          <stop offset="100%" stopColor="#FC3C44" />
        </linearGradient>
        {sheen(`${uid}-sheen`)}
      </defs>
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-bg)`} />
      <path
        d="M36 74a11 11 0 1 1-4.5-8.8V27.5c0-2.2 1.6-4 3.7-4.3l30-4.6C68.2 18.2 70 20.4 70 23v36.4A11 11 0 1 1 65.5 51V32.2L40 36.2V66A11 11 0 0 1 36 74Z"
        fill="#fff"
      />
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function MessagesIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="ios-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#64DE7A" />
          <stop offset="100%" stopColor="#1DB954" />
        </linearGradient>
        {sheen(`${uid}-sheen`)}
      </defs>
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-bg)`} />
      <path
        d="M21 34c0-8.3 8.5-15 19-15h20c10.5 0 19 6.7 19 15v16c0 8.3-8.5 15-19 15H49L34 78V65H40c-10.5 0-19-6.7-19-15V34Z"
        fill="#fff"
      />
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function NotesIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="ios-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-top`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE58A" />
          <stop offset="100%" stopColor="#FFD60A" />
        </linearGradient>
        {sheen(`${uid}-sheen`)}
      </defs>
      <rect width="100" height="100" rx="22.4" fill="#FFF6C2" />
      <rect width="100" height="28" fill={`url(#${uid}-top)`} />
      <path d="M24 46h52M24 58h52M24 70h34" stroke="#C7A008" strokeWidth="4" strokeLinecap="round" />
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function FilesIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="ios-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#64D2FF" />
          <stop offset="100%" stopColor="#0A84FF" />
        </linearGradient>
        {sheen(`${uid}-sheen`)}
      </defs>
      <rect width="100" height="100" rx="22.4" fill="#EBEBF0" />
      <path
        d="M16 39c0-4.4 3.6-8 8-8h15.2c2 0 3.9.9 5.1 2.5l3.6 4.6c1.2 1.6 3.1 2.5 5.1 2.5H76c4.4 0 8 3.6 8 8V73c0 4.4-3.6 8-8 8H24c-4.4 0-8-3.6-8-8V39Z"
        fill="#7DDBFF"
      />
      <path d="M16 50h68v23c0 4.4-3.6 8-8 8H24c-4.4 0-8-3.6-8-8V50Z" fill={`url(#${uid}-bg)`} />
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function PdfIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="ios-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>{sheen(`${uid}-sheen`)}</defs>
      <rect width="100" height="100" rx="22.4" fill="#F2F2F7" />
      <path d="M29 12h28l21 21v53c0 4.4-3.6 8-8 8H29c-4.4 0-8-3.6-8-8V20c0-4.4 3.6-8 8-8Z" fill="#fff" />
      <path d="M57 12v17c0 2.2 1.8 4 4 4h18" fill="#E5E5EA" />
      <rect x="20" y="58" width="60" height="22" rx="6" fill="#FF3B30" />
      <text
        x="50"
        y="74"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill="#fff"
        fontFamily="Helvetica, Arial, sans-serif"
      >
        PDF
      </text>
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function PagesIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="ios-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFB340" />
          <stop offset="100%" stopColor="#FF6B00" />
        </linearGradient>
        {sheen(`${uid}-sheen`)}
      </defs>
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-bg)`} />
      <rect x="26" y="18" width="48" height="64" rx="6" fill="#fff" />
      <path d="M36 36h28M36 46h28M36 56h18" stroke="#FF9F0A" strokeWidth="3.4" strokeLinecap="round" />
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function CameraIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="ios-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D1D1D6" />
          <stop offset="100%" stopColor="#8E8E93" />
        </linearGradient>
        {sheen(`${uid}-sheen`)}
      </defs>
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-bg)`} />
      <rect x="16" y="32" width="68" height="46" rx="12" fill="#1C1C1E" />
      <circle cx="50" cy="55" r="14" fill="#3A3A3C" />
      <circle cx="50" cy="55" r="8" fill="#0A84FF" />
      <rect x="24" y="24" width="16" height="10" rx="3" fill="#1C1C1E" />
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function ClockIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="ios-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>{sheen(`${uid}-sheen`)}</defs>
      <rect width="100" height="100" rx="22.4" fill="#1C1C1E" />
      <circle cx="50" cy="50" r="32" fill="#F2F2F7" />
      <line x1="50" y1="50" x2="50" y2="28" stroke="#1C1C1E" strokeWidth="3.2" strokeLinecap="round" />
      <line x1="50" y1="50" x2="68" y2="50" stroke="#1C1C1E" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="50" cy="50" r="2.6" fill="#FF3B30" />
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function WeatherIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="ios-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#64D2FF" />
          <stop offset="100%" stopColor="#0A84FF" />
        </linearGradient>
        {sheen(`${uid}-sheen`)}
      </defs>
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-bg)`} />
      <circle cx="38" cy="40" r="14" fill="#FFD60A" />
      <path d="M34 64h36a14 14 0 0 0 0-28 18 18 0 0 0-34 6A12 12 0 0 0 34 64Z" fill="#fff" />
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function CalendarIcon() {
  const uid = useId().replace(/:/g, '')
  const day = new Date().getDate()
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  return (
    <svg className="ios-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>{sheen(`${uid}-sheen`)}</defs>
      <rect width="100" height="100" rx="22.4" fill="#F2F2F7" />
      <rect width="100" height="28" fill="#FF3B30" />
      <text
        x="50"
        y="20"
        textAnchor="middle"
        fill="#fff"
        fontSize="12"
        fontWeight="700"
        fontFamily="Helvetica, Arial, sans-serif"
      >
        {weekday}
      </text>
      <text
        x="50"
        y="72"
        textAnchor="middle"
        fill="#1C1C1E"
        fontSize="42"
        fontWeight="600"
        fontFamily="Helvetica, Arial, sans-serif"
      >
        {day}
      </text>
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

const APP_ICONS = {
  phone: PhoneIcon,
  safari: SafariIcon,
  photos: PhotosIcon,
  mail: MailIcon,
  music: MusicIcon,
  messages: MessagesIcon,
  notes: NotesIcon,
  files: FilesIcon,
  pdf: PdfIcon,
  pages: PagesIcon,
  camera: CameraIcon,
  clock: ClockIcon,
  weather: WeatherIcon,
  calendar: CalendarIcon,
}

export function IosAppIcon({ name }) {
  const Icon = APP_ICONS[name] ?? FilesIcon
  return <Icon />
}

export function IosFolderIcon({ apps }) {
  return (
    <div className="ios-folder">
      {apps.slice(0, 9).map((name, index) => (
        <span key={`${name}-${index}`} className="ios-folder-cell">
          <IosAppIcon name={name} />
        </span>
      ))}
    </div>
  )
}

export function IosPhotoIcon({ tint, gid }) {
  const skies = {
    warm: ['#FFB347', '#FF6B6B'],
    cool: ['#74C0FC', '#3B5BDB'],
    studio: ['#E599F7', '#7950F2'],
    night: ['#1B3358', '#0B1026'],
  }
  const [a, b] = skies[tint] ?? skies.warm
  const uid = useId().replace(/:/g, '')
  const grad = gid ?? `${uid}-photo`
  return (
    <svg className="ios-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={a} />
          <stop offset="100%" stopColor={b} />
        </linearGradient>
        {sheen(`${uid}-sheen`)}
      </defs>
      <rect width="100" height="100" rx="22.4" fill={`url(#${grad})`} />
      <circle cx="72" cy="26" r="10" fill="rgba(255,255,255,0.88)" />
      <path d="M0 68l22-18 18 14 24-28 36 24v40H0V68Z" fill="rgba(0,0,0,0.22)" />
      <path d="M0 78l28-16 16 12 22-20 34 18v28H0V78Z" fill="rgba(255,255,255,0.28)" />
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function IosFileIcon({ name }) {
  if (name.endsWith('.pdf')) return <PdfIcon />
  if (name.endsWith('.md') || name.endsWith('.ai')) return <PagesIcon />
  if (name.toLowerCase().includes('note')) return <NotesIcon />
  return <FilesIcon />
}
