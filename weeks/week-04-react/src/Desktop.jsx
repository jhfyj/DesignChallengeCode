import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { foamMaskStyle } from './foamMask'
import { LIFT_MS, foamScreenMetrics, itemToCell } from './foamLayout'
import './Desktop.css'

const DESK_W = 88
const DESK_H = 120
const DESK_GLYPH = 72
const PAD_X = 51
const PAD_Y = 87
const COL_PITCH = 108
const DOCK_ICON = 36
const DOCK_GAP = 9
const DOCK_PAD = 8
const DOCK_BOTTOM = 4
const DOCK_HEIGHT = 55
const DOCK_RULE = 11
const DOCK_MAG_MAX = 2
const DOCK_MAG_SPAN = 240
const DOCK_MAG_LERP = 0.28

const DESKTOP_STARTER = [
  { id: 'folder-studio', icon: 'folder', name: 'Studio' },
  { id: 'folder-briefs', icon: 'folder', name: 'Briefs' },
  { id: 'trash-desk', icon: 'trash-full', name: 'Trash' },
  { id: 'safari-desk', icon: 'safari', name: 'Safari' },
  { id: 'mail-desk', icon: 'mail', name: 'Mail' },
  { id: 'notes-desk', icon: 'notes', name: 'Notes' },
]

const EXTRA_FOLDER_COLS = [
  [
    { id: 'folder-aesthetics', name: 'Aesthetics' },
    { id: 'folder-design', name: 'Design' },
    { id: 'folder-inspo', name: 'Inspo' },
    { id: 'folder-moodboard', name: 'Moodboard' },
    { id: 'folder-type', name: 'Type' },
    { id: 'folder-color', name: 'Color' },
  ],
  [
    { id: 'folder-challenge', name: 'Design Challenge' },
    { id: 'folder-critique', name: 'Critique' },
    { id: 'folder-research', name: 'Research' },
    { id: 'folder-figma', name: 'Figma' },
    { id: 'folder-refs', name: 'Refs' },
    { id: 'folder-archive', name: 'Archive' },
  ],
]

const DOCK_APPS = [
  { id: 'finder', name: 'Finder', icon: 'finder' },
  { id: 'launchpad', name: 'Launchpad', icon: 'launchpad' },
  { id: 'safari', name: 'Safari', icon: 'safari' },
  { id: 'messages', name: 'Messages', icon: 'messages' },
  { id: 'mail', name: 'Mail', icon: 'mail' },
  { id: 'maps', name: 'Maps', icon: 'maps' },
  { id: 'photos', name: 'Photos', icon: 'photos' },
  { id: 'facetime', name: 'FaceTime', icon: 'facetime' },
  { id: 'phone', name: 'Phone', icon: 'phone' },
  { id: 'calendar', name: 'Calendar', icon: 'calendar' },
  { id: 'contacts', name: 'Contacts', icon: 'contacts' },
  { id: 'notes', name: 'Notes', icon: 'notes' },
  { id: 'tv', name: 'Apple TV', icon: 'tv' },
  { id: 'music', name: 'Music', icon: 'music' },
  { id: 'keynote', name: 'Keynote', icon: 'keynote' },
  { id: 'pages', name: 'Pages', icon: 'pages' },
  { id: 'numbers', name: 'Numbers', icon: 'numbers' },
  { id: 'appstore', name: 'App Store', icon: 'appstore' },
  { id: 'games', name: 'Games', icon: 'games' },
  { id: 'mirroring', name: 'iPhone Mirroring', icon: 'mirroring' },
  { id: 'siri', name: 'Siri', icon: 'siri' },
  { id: 'settings', name: 'System Settings', icon: 'settings' },
  { id: 'custom', name: 'Photos', icon: 'custom' },
  { id: 'downloads', name: 'Downloads', icon: 'folder', afterRule: true },
  { id: 'trash', name: 'Trash', icon: 'trash' },
]

const MENUS = ['File', 'Edit', 'View', 'Item', 'Window', 'Help']

function randomPop() {
  const angle = Math.random() * Math.PI * 2
  const dist = 4 + Math.random() * 8
  const sign = Math.random() < 0.5 ? -1 : 1
  const spin = sign * (3 + Math.random() * 4)
  return {
    hopX: Math.round(Math.cos(angle) * dist),
    hopY: Math.round(Math.sin(angle) * dist),
    spin,
    rotate: sign * (2 + Math.random() * 3),
  }
}

function hashNudge(id) {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 17 + id.charCodeAt(i)) | 0
  return {
    x: (hash % 21) - 10,
    y: -28 - Math.abs(hash % 22),
  }
}

function dockExit(entry) {
  if (entry.home !== 'dock' || entry.free) return null
  const nudge = hashNudge(entry.id)
  const x = entry.x + nudge.x
  const y = entry.y + nudge.y
  return {
    x,
    y,
    fromX: entry.x - x,
    fromY: entry.y - y,
  }
}

function dockMagScale(center, mouseX) {
  if (mouseX == null) return 1
  const minX = mouseX - DOCK_MAG_SPAN / 2
  const maxX = mouseX + DOCK_MAG_SPAN / 2
  if (center < minX || center > maxX) return 1
  const theta = ((center - minX) / DOCK_MAG_SPAN) * Math.PI * 2
  return 1 + ((1 - Math.cos(theta)) / 2) * (DOCK_MAG_MAX - 1)
}

function dockWidth() {
  const n = DOCK_APPS.length
  return DOCK_PAD * 2 + n * DOCK_ICON + (n - 1) * DOCK_GAP + DOCK_RULE
}

function desktopPitch(height) {
  const rows = Math.max(DESKTOP_STARTER.length, ...EXTRA_FOLDER_COLS.map((col) => col.length))
  const available = height - PAD_Y - DOCK_BOTTOM - DOCK_HEIGHT - 20
  if (available >= rows * DESK_H) return DESK_H
  return Math.max(96, available / rows)
}

function deskIcon(item, colFromRight, row, width, pitch) {
  return {
    ...item,
    home: 'desktop',
    free: false,
    popping: false,
    landed: false,
    rotate: 0,
    width: DESK_W,
    height: Math.min(DESK_H, Math.floor(pitch)),
    glyph: DESK_GLYPH,
    x: width - PAD_X - DESK_W - colFromRight * COL_PITCH,
    y: PAD_Y + row * pitch,
  }
}

function seedItems(width, height) {
  const extraCols = EXTRA_FOLDER_COLS.length
  const pitch = desktopPitch(height)
  const desktop = [
    ...DESKTOP_STARTER.map((item, row) => deskIcon(item, extraCols, row, width, pitch)),
    ...EXTRA_FOLDER_COLS.flatMap((column, index) =>
      column.map((item, row) =>
        deskIcon({ ...item, icon: 'folder' }, extraCols - 1 - index, row, width, pitch),
      ),
    ),
  ]

  const split = DOCK_APPS.findIndex((item) => item.afterRule)
  const dock = DOCK_APPS.map((item, index) => ({
    ...item,
    id: `dock-${item.id}`,
    home: 'dock',
    free: false,
    popping: false,
    landed: false,
    rotate: 0,
    width: DOCK_ICON,
    height: DOCK_ICON,
    glyph: DOCK_ICON,
    x:
      (width - dockWidth()) / 2 +
      DOCK_PAD +
      index * (DOCK_ICON + DOCK_GAP) +
      (index >= split && split >= 0 ? DOCK_RULE : 0),
    y: height - DOCK_BOTTOM - DOCK_HEIGHT + DOCK_PAD,
  }))

  return [...desktop, ...dock]
}

function menuParts() {
  const now = new Date()
  return {
    date: now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  }
}

function MacIcon({ name, size }) {
  return (
    <img
      className="mac-asset"
      src={`/mac/${name}.png`}
      alt=""
      width={size}
      height={size}
      draggable="false"
    />
  )
}

export default function Desktop({ liftPlan, mask }) {
  const boardRef = useRef(null)
  const itemsRef = useRef([])
  const dragRef = useRef(null)
  const planRef = useRef(null)
  const timers = useRef([])
  const itemNodes = useRef(new Map())
  const dockMouseX = useRef(null)
  const dockScales = useRef(new Map())
  const dockMagRaf = useRef(0)
  const sizeRef = useRef({ width: window.innerWidth, height: window.innerHeight })
  const [clock, setClock] = useState(menuParts)
  const [size, setSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
  const [items, setItems] = useState(() => seedItems(window.innerWidth, window.innerHeight))
  const [drag, setDrag] = useState(null)

  itemsRef.current = items
  dragRef.current = drag
  sizeRef.current = size

  const measure = useCallback(() => {
    const node = boardRef.current
    if (!node) return
    setSize({ width: node.clientWidth, height: node.clientHeight })
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    const tick = window.setInterval(() => setClock(menuParts()), 30_000)
    return () => {
      window.removeEventListener('resize', measure)
      window.clearInterval(tick)
    }
  }, [measure])

  useEffect(() => {
    const next = seedItems(size.width, size.height)
    const byId = new Map(next.map((item) => [item.id, item]))
    setItems((prev) =>
      prev.map((item) => {
        if (item.free || item.popping || item.landed) return item
        const seeded = byId.get(item.id)
        if (!seeded) return item
        return {
          ...item,
          x: seeded.x,
          y: seeded.y,
          width: seeded.width,
          height: seeded.height,
        }
      }),
    )
  }, [size.height, size.width])

  const applyDockMag = useCallback(() => {
    const docked = itemsRef.current.filter(
      (item) => item.home === 'dock' && !item.free && !item.popping,
    )
    const mouseX = dockMouseX.current
    let moving = false
    const extras = []

    docked.forEach((item) => {
      const target = dockMagScale(item.x + item.width / 2, mouseX)
      const prev = dockScales.current.get(item.id) ?? 1
      let scale = prev + (target - prev) * DOCK_MAG_LERP
      if (Math.abs(scale - target) < 0.003) scale = target
      if (Math.abs(scale - 1) > 0.003 || Math.abs(target - 1) > 0.003) moving = true
      dockScales.current.set(item.id, scale)
      extras.push({
        item,
        scale,
        extra: DOCK_ICON * (scale - 1),
      })
    })

    extras.sort((a, b) => a.item.x - b.item.x)
    const totalExtra = extras.reduce((sum, entry) => sum + entry.extra, 0)
    let extraBefore = 0

    extras.forEach((entry) => {
      const node = itemNodes.current.get(entry.item.id)
      const size = DOCK_ICON + entry.extra
      const left = entry.item.x - entry.extra / 2 + extraBefore - totalExtra / 2
      const top = entry.item.y - entry.extra
      extraBefore += entry.extra
      if (!node) return
      node.style.left = `${left}px`
      node.style.top = `${top}px`
      node.style.width = `${size}px`
      node.style.height = `${size}px`
      node.style.zIndex = String(13 + Math.round((entry.scale - 1) * 24))
      const icon = node.querySelector('.desk-icon')
      if (icon) {
        icon.style.width = `${size}px`
        icon.style.height = `${size}px`
      }
    })

    if (moving) {
      dockMagRaf.current = window.requestAnimationFrame(applyDockMag)
    } else {
      dockMagRaf.current = 0
    }
  }, [])

  const startDockMag = useCallback(() => {
    if (dockMagRaf.current) return
    dockMagRaf.current = window.requestAnimationFrame(applyDockMag)
  }, [applyDockMag])

  const onDockPointerMove = useCallback(
    (event) => {
      if (dragRef.current) return
      const node = boardRef.current
      if (!node) return
      const box = node.getBoundingClientRect()
      const y = event.clientY - box.top
      const hot = box.height - DOCK_BOTTOM - DOCK_HEIGHT - 56
      const hasDocked = itemsRef.current.some(
        (item) => item.home === 'dock' && !item.free && !item.popping,
      )
      if (!hasDocked || y < hot) {
        if (dockMouseX.current != null) {
          dockMouseX.current = null
          startDockMag()
        }
        return
      }
      dockMouseX.current = event.clientX - box.left
      startDockMag()
    },
    [startDockMag],
  )

  const onDockPointerLeave = useCallback(() => {
    if (dockMouseX.current == null) return
    dockMouseX.current = null
    startDockMag()
  }, [startDockMag])

  useEffect(
    () => () => {
      if (dockMagRaf.current) window.cancelAnimationFrame(dockMagRaf.current)
    },
    [],
  )

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id))
    },
    [],
  )

  useEffect(() => {
    if (!liftPlan?.length) return
    if (planRef.current === liftPlan) return
    planRef.current = liftPlan

    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []

    const metrics = foamScreenMetrics(size.width, size.height)
    const byKey = new Map(liftPlan.map((step) => [step.key, step]))

    itemsRef.current.forEach((item) => {
      const cell = itemToCell(item, metrics)
      if (!cell) return
      const step = byKey.get(cell.key)
      if (!step) return
      const id = window.setTimeout(() => {
        const latest = itemsRef.current.find((entry) => entry.id === item.id)
        if (!latest) return
        const startPop = () => {
          setItems((prev) =>
            prev.map((entry) => {
              if (entry.id !== item.id) return entry
              const popCycle = (entry.popCycle ?? 0) + 1
              const pop = randomPop()
              const exit = dockExit(entry)
              return {
                ...entry,
                popping: true,
                landed: false,
                popCycle,
                rotate: pop.rotate,
                spin: pop.spin,
                hopX: pop.hopX,
                hopY: pop.hopY,
                fromX: exit?.fromX ?? 0,
                fromY: exit?.fromY ?? 0,
                ...(exit ? { x: exit.x, y: exit.y } : {}),
              }
            }),
          )
        }
        if (latest.popping) {
          setItems((prev) =>
            prev.map((entry) =>
              entry.id === item.id ? { ...entry, popping: false } : entry,
            ),
          )
          window.requestAnimationFrame(() => window.requestAnimationFrame(startPop))
          return
        }
        startPop()
      }, step.delay)
      timers.current.push(id)
    })
  }, [liftPlan, size.height, size.width])

  const onPopEnd = (item) => {
    setItems((prev) =>
      prev.map((entry) => {
        if (entry.id !== item.id) return entry
        const grow = entry.home === 'dock' && entry.width === DOCK_ICON
        return {
          ...entry,
          popping: false,
          landed: true,
          free: true,
          home: 'canvas',
          fromX: 0,
          fromY: 0,
          ...(grow
            ? {
                width: 72,
                height: 56,
                x: entry.x - (72 - entry.width) / 2,
              }
            : {}),
        }
      }),
    )
  }

  const onPointerDown = (event, item) => {
    if (event.button !== 0) return
    if (item.popping) return
    if (item.home === 'dock' && !item.free) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const node = boardRef.current
    const box = node.getBoundingClientRect()
    const next = {
      id: item.id,
      pointerId: event.pointerId,
      grabX: event.clientX - (box.left + item.x),
      grabY: event.clientY - (box.top + item.y),
      x: event.clientX,
      y: event.clientY,
    }
    dragRef.current = next
    setDrag(next)
  }

  const onPointerMove = (event) => {
    const current = dragRef.current
    if (!current || event.pointerId !== current.pointerId) return
    const next = { ...current, x: event.clientX, y: event.clientY }
    dragRef.current = next
    setDrag(next)
  }

  const onPointerUp = (event) => {
    const current = dragRef.current
    if (!current || event.pointerId !== current.pointerId) return
    const node = boardRef.current
    const box = node.getBoundingClientRect()
    const x = event.clientX - box.left - current.grabX
    const y = event.clientY - box.top - current.grabY
    setItems((prev) =>
      prev.map((item) =>
        item.id === current.id
          ? {
              ...item,
              x,
              y,
              free: true,
              home: 'canvas',
            }
          : item,
      ),
    )
    dragRef.current = null
    setDrag(null)
  }

  const boardBox = boardRef.current?.getBoundingClientRect()
  const dockedCount = items.filter((item) => item.home === 'dock' && !item.free).length
  const dockMask = useMemo(() => foamMaskStyle(mask), [mask])
  const dockGone = Boolean(mask && mask.paths.length === 0)

  return (
    <div
      className="desktop"
      ref={boardRef}
      onPointerMove={onDockPointerMove}
      onPointerLeave={onDockPointerLeave}
    >
      <div className="mac-menubar">
        <div className="mac-menubar-leading">
          <span className="mac-apple-wrap" aria-label="Apple">
            <svg className="mac-apple" viewBox="0 0 16 20" aria-hidden="true">
              <path
                fill="currentColor"
                d="M13.2 10.6c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-1.9-1.5-.2-3 .9-3.7.9-.8 0-2-.9-3.3-.8-1.7 0-3.3 1-4.1 2.5-1.8 3.1-.5 7.6 1.2 10.1.9 1.2 1.9 2.6 3.2 2.5 1.3 0 1.8-.8 3.3-.8s2 .8 3.4.8c1.4 0 2.3-1.2 3.1-2.4.96-1.4 1.4-2.7 1.4-2.8-.1 0-2.6-1-2.6-4.4ZM11.1 3.2c.7-.9 1.2-2.1 1-3.2-1 .1-2.2.7-2.9 1.5-.6.8-1.2 2-1 3.1 1.1.1 2.2-.5 2.9-1.4Z"
              />
            </svg>
          </span>
          <span className="mac-app-name">Finder</span>
          {MENUS.map((item) => (
            <span key={item} className="mac-menu-item">
              {item}
            </span>
          ))}
        </div>
        <div className="mac-menubar-trailing">
          <span className="mac-wifi" aria-hidden="true" />
          <span className="mac-spotlight" aria-label="Spotlight">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M9.8 9.8 13.2 13.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
          <span className="mac-control" aria-hidden="true" />
          <span className="mac-datetime">
            <span>{clock.date}</span>
            <span>{clock.time}</span>
          </span>
        </div>
      </div>

      {items.map((item) => {
        const isDrag = drag?.id === item.id
        const left = isDrag
          ? drag.x - (boardBox?.left ?? 0) - drag.grabX
          : item.x
        const top = isDrag
          ? drag.y - (boardBox?.top ?? 0) - drag.grabY
          : item.y
        const showLabel = item.home !== 'dock' || item.free
        const glyph = item.glyph
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.name}
            ref={(node) => {
              if (node) itemNodes.current.set(item.id, node)
              else itemNodes.current.delete(item.id)
            }}
            className={[
              'canvas-item',
              item.home === 'dock' && !item.free ? 'is-docked' : 'is-loose',
              item.popping ? 'is-popping' : '',
              item.landed && !item.popping ? 'is-landed' : '',
              isDrag ? 'is-dragging' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              left,
              top,
              width: item.width,
              height: item.height,
              '--land-rot': `${item.rotate}deg`,
              '--spin': `${item.spin ?? item.rotate}deg`,
              '--pop-ms': `${LIFT_MS}ms`,
              '--pop-cycle': String(item.popCycle ?? 0),
              '--hop-x': `${item.hopX ?? 0}px`,
              '--hop-y': `${item.hopY ?? 0}px`,
              '--from-x': `${item.fromX ?? 0}px`,
              '--from-y': `${item.fromY ?? 0}px`,
            }}
            onPointerDown={(event) => onPointerDown(event, item)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onAnimationEnd={(event) => {
              if (event.animationName !== 'icon-foam-pop') return
              const current = itemsRef.current.find((entry) => entry.id === item.id)
              if (current?.popping) onPopEnd(current)
            }}
          >
            <span className="desk-icon" style={{ width: glyph, height: glyph }}>
              <MacIcon name={item.icon} size={glyph} />
            </span>
            {showLabel && <span className="desk-name">{item.name}</span>}
          </button>
        )
      })}

      <div
        className={`dock-layer${mask ? ' is-on-mat' : ''}${dockGone ? ' is-gone' : ''}`}
        style={dockMask}
      >
        <nav
          className={`desk-dock${dockedCount === 0 ? ' is-empty' : ''}`}
          aria-label="Dock"
          aria-hidden={dockGone}
          style={{ width: dockWidth() }}
        >
          {DOCK_APPS.map((app) => (
            <span
              key={app.id}
              className={`desk-dock-slot${app.afterRule ? ' has-rule' : ''}`}
              aria-hidden="true"
            />
          ))}
        </nav>
      </div>
    </div>
  )
}
