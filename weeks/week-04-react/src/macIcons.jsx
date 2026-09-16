import { useId } from 'react'

function sheen(id) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
      <stop offset="48%" stopColor="#fff" stopOpacity="0" />
      <stop offset="100%" stopColor="#000" stopOpacity="0.12" />
    </linearGradient>
  )
}

export function MacFolderIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="mac-glyph" viewBox="0 0 128 112" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-tab`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7DD4FF" />
          <stop offset="100%" stopColor="#4FC3F7" />
        </linearGradient>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5AC8FA" />
          <stop offset="55%" stopColor="#32ADE6" />
          <stop offset="100%" stopColor="#0A84FF" />
        </linearGradient>
        {sheen(`${uid}-sheen`)}
      </defs>
      <path
        d="M10 42c0-7 5.6-12 12.5-12h26.2c3.2 0 6.1 1.5 8 4.1l6.6 8.9H106c7 0 12.5 5.4 12.5 12V48H10V42Z"
        fill={`url(#${uid}-tab)`}
      />
      <rect x="8" y="46" width="112" height="58" rx="14" fill={`url(#${uid}-body)`} />
      <rect x="8" y="46" width="112" height="58" rx="14" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function MacNumbersIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="mac-glyph mac-doc" viewBox="0 0 88 104" aria-hidden="true">
      <defs>{sheen(`${uid}-sheen`)}</defs>
      <rect x="8" y="4" width="72" height="96" rx="8" fill="#fff" stroke="#D8D8DE" />
      <rect x="8" y="4" width="72" height="18" rx="8" fill="#34C759" />
      <rect x="8" y="14" width="72" height="8" fill="#34C759" />
      {[0, 1, 2, 3].map((row) =>
        [0, 1, 2].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={16 + col * 20}
            y={30 + row * 16}
            width="16"
            height="12"
            rx="1.5"
            fill={row === 0 ? '#D1F0D8' : '#F2F2F7'}
            stroke="#34C759"
            strokeWidth="0.8"
          />
        )),
      )}
      <rect x="8" y="4" width="72" height="96" rx="8" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function MacPagesIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="mac-glyph mac-doc" viewBox="0 0 88 104" aria-hidden="true">
      <defs>{sheen(`${uid}-sheen`)}</defs>
      <rect x="8" y="4" width="72" height="96" rx="8" fill="#fff" stroke="#D8D8DE" />
      <rect x="8" y="4" width="72" height="18" rx="8" fill="#FF9F0A" />
      <rect x="8" y="14" width="72" height="8" fill="#FF9F0A" />
      <path d="M20 36h48M20 48h48M20 60h32" stroke="#E5E5EA" strokeWidth="4" strokeLinecap="round" />
      <rect x="8" y="4" width="72" height="96" rx="8" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function MacKeynoteIcon({ src }) {
  return (
    <span className="mac-preview">
      <img src={src} alt="" />
    </span>
  )
}

export function MacPhotoIcon({ src, alt }) {
  return (
    <span className="mac-photo">
      <img src={src} alt={alt} />
    </span>
  )
}

function DockFrame({ children, fill, gid }) {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="mac-dock-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        {gid}
        {sheen(`${uid}-sheen`)}
      </defs>
      <rect width="100" height="100" rx="22.4" fill={fill} />
      {children}
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function FinderIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="mac-dock-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5AC8FA" />
          <stop offset="100%" stopColor="#0A84FF" />
        </linearGradient>
        {sheen(`${uid}-sheen`)}
      </defs>
      <rect width="100" height="100" rx="22.4" fill="#F2F2F7" />
      <path d="M8 22.4C8 14.4 14.4 8 22.4 8H50v84H22.4C14.4 92 8 85.6 8 77.6V22.4Z" fill="#F2F2F7" />
      <path d="M50 8h27.6C85.6 8 92 14.4 92 22.4v55.2c0 8-6.4 14.4-14.4 14.4H50V8Z" fill={`url(#${uid}-bg)`} />
      <path d="M28 58c6 10 16 16 22 16s16-6 22-16" fill="none" stroke="#1C1C1E" strokeWidth="5" strokeLinecap="round" />
      <circle cx="36" cy="42" r="4.2" fill="#1C1C1E" />
      <circle cx="64" cy="42" r="4.2" fill="#fff" />
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function LaunchpadIcon() {
  const colors = ['#FF453A', '#FF9F0A', '#FFD60A', '#30D158', '#64D2FF', '#0A84FF', '#BF5AF2', '#FF375F', '#8E8E93']
  return (
    <DockFrame fill="#3A3A3C">
      {colors.map((color, i) => (
        <circle key={color} cx={26 + (i % 3) * 24} cy={26 + Math.floor(i / 3) * 24} r="8.2" fill={color} />
      ))}
    </DockFrame>
  )
}

export function SafariDockIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="mac-dock-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-bg`} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#64D2FF" />
          <stop offset="100%" stopColor="#0040C8" />
        </radialGradient>
        {sheen(`${uid}-sheen`)}
      </defs>
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-bg)`} />
      <path d="M50 21 62 62 50 54 38 62Z" fill="#FF3B30" />
      <path d="M50 79 38 38 50 46 62 38Z" fill="#F2F2F7" />
      <circle cx="50" cy="50" r="3" fill="#1C1C1E" />
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function MessagesDockIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="mac-dock-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#64DE7A" />
          <stop offset="100%" stopColor="#1DB954" />
        </linearGradient>
        {sheen(`${uid}-sheen`)}
      </defs>
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-bg)`} />
      <path
        d="M22 32c0-8 8-14 18-14h20c10 0 18 6 18 14v18c0 8-8 14-18 14H50L36 76V64H40c-10 0-18-6-18-14V32Z"
        fill="#fff"
      />
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function MailDockIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="mac-dock-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7DD8FF" />
          <stop offset="100%" stopColor="#0A84FF" />
        </linearGradient>
        {sheen(`${uid}-sheen`)}
      </defs>
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-bg)`} />
      <rect x="14" y="28" width="72" height="46" rx="8" fill="#fff" />
      <path d="M16 32 50 54 84 32" fill="none" stroke="#0A84FF" strokeWidth="4.4" />
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function PhotosDockIcon() {
  const uid = useId().replace(/:/g, '')
  const petals = ['#FF453A', '#FF9F0A', '#FFD60A', '#30D158', '#64D2FF', '#0A84FF', '#BF5AF2', '#FF375F']
  return (
    <svg className="mac-dock-icon" viewBox="0 0 100 100" aria-hidden="true">
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
            transform={`rotate(${i * 45})`}
          />
        ))}
      </g>
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function CalendarDockIcon() {
  const uid = useId().replace(/:/g, '')
  const day = new Date().getDate()
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  return (
    <svg className="mac-dock-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>{sheen(`${uid}-sheen`)}</defs>
      <rect width="100" height="100" rx="22.4" fill="#F2F2F7" />
      <rect width="100" height="28" fill="#FF3B30" />
      <text x="50" y="20" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700" fontFamily="Helvetica, Arial, sans-serif">
        {weekday}
      </text>
      <text x="50" y="72" textAnchor="middle" fill="#1C1C1E" fontSize="42" fontWeight="600" fontFamily="Helvetica, Arial, sans-serif">
        {day}
      </text>
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function NotesDockIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="mac-dock-icon" viewBox="0 0 100 100" aria-hidden="true">
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

export function MusicDockIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="mac-dock-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF6B8A" />
          <stop offset="100%" stopColor="#FC3C44" />
        </linearGradient>
        {sheen(`${uid}-sheen`)}
      </defs>
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-bg)`} />
      <path d="M36 74a11 11 0 1 1-4.5-8.8V27.5c0-2.2 1.6-4 3.7-4.3l30-4.6C68.2 18.2 70 20.4 70 23v36.4A11 11 0 1 1 65.5 51V32.2L40 36.2V66A11 11 0 0 1 36 74Z" fill="#fff" />
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function SettingsDockIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="mac-dock-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D1D1D6" />
          <stop offset="100%" stopColor="#8E8E93" />
        </linearGradient>
        {sheen(`${uid}-sheen`)}
      </defs>
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-bg)`} />
      <circle cx="50" cy="50" r="16" fill="none" stroke="#F2F2F7" strokeWidth="8" />
      {[0, 45, 90, 135].map((deg) => (
        <rect
          key={deg}
          x="46"
          y="14"
          width="8"
          height="18"
          rx="2"
          fill="#F2F2F7"
          transform={`rotate(${deg} 50 50)`}
        />
      ))}
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

export function TrashIcon() {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="mac-dock-icon" viewBox="0 0 100 100" aria-hidden="true">
      <defs>{sheen(`${uid}-sheen`)}</defs>
      <rect width="100" height="100" rx="22.4" fill="#E5E5EA" />
      <rect x="30" y="28" width="40" height="8" rx="3" fill="#8E8E93" />
      <rect x="38" y="22" width="24" height="8" rx="3" fill="#8E8E93" />
      <path d="M32 38h36l-4 38H36L32 38Z" fill="#AEAEB2" />
      <rect width="100" height="100" rx="22.4" fill={`url(#${uid}-sheen)`} />
    </svg>
  )
}

const DOCK_ICONS = {
  finder: FinderIcon,
  launchpad: LaunchpadIcon,
  safari: SafariDockIcon,
  messages: MessagesDockIcon,
  mail: MailDockIcon,
  photos: PhotosDockIcon,
  calendar: CalendarDockIcon,
  notes: NotesDockIcon,
  music: MusicDockIcon,
  settings: SettingsDockIcon,
  trash: TrashIcon,
}

export function MacDockIcon({ name }) {
  const Icon = DOCK_ICONS[name] ?? FinderIcon
  return <Icon />
}

export function MacItemIcon({ item }) {
  if (item.kind === 'folder') return <MacFolderIcon />
  if (item.kind === 'image') return <MacPhotoIcon src={item.src} alt={item.name} />
  if (item.file === 'numbers') return <MacNumbersIcon />
  if (item.file === 'keynote') return <MacKeynoteIcon src={item.src} />
  if (item.file === 'pages') return <MacPagesIcon />
  return <MacPagesIcon />
}
