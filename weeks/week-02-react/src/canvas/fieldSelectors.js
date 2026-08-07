import { resolveTriad, relativeLuminance } from './colorContrast.js'

export const FONT_BY_ROLE = {
  title: 'Orbitron',
  subtitle: 'Orbitron',
  body: 'Figtree',
  accent: 'Fira Mono',
}

export const FONT_WEIGHT_BY_ROLE = { title: 700, subtitle: 700, body: 400, accent: 600 }

export const FONT_FAMILIES = ['Orbitron', 'Figtree', 'Fira Mono']

// Swiss/Müller-Brockmann style mode (DesignContext's `styleMode`): the
// discipline calls for ONE grotesque typeface throughout, not a different
// family per role — Inter is already loaded (see main.jsx) and reads as a
// real grotesque, unlike Orbitron/Fira Mono's more stylized personalities.
export const SWISS_FONT_BY_ROLE = { title: 'Inter', subtitle: 'Inter', body: 'Inter', accent: 'Inter' }
export const SWISS_FONT_FAMILIES = ['Inter']

// Every text role picks between exactly two ends of the Custom triad — the
// "normal" (dark) swatch on a light canvas, the "inverse" (light) swatch on a
// dark one — never the mid tone, which is reserved for non-text uses (e.g.
// DuotoneFilter/ImageElement). `colors` is the user's Custom list from the
// Color Library — it can be any length (even empty), so the actual light/dark
// ends are derived via resolveTriad rather than indexed directly. `canvasColor`
// is what decides which end is "normal" and which is "inverse" — otherwise
// "dark" text would land on a dark background and disappear the moment
// someone picks a black canvas.
export function colorForRole(role, colors, canvasColor = '#ffffff') {
  const { dark, light } = resolveTriad(colors)
  const canvasIsDark = relativeLuminance(canvasColor) < 0.5
  return canvasIsDark ? light : dark
}

function isFilled(value) {
  return typeof value === 'string' ? value.trim() !== '' : value != null
}

// Builds the fixed-order list of canvas-eligible fields from the shared
// document state. Order matters: headers (title/subtitle) must be processed
// before body/accent so the header-dominance size clamp sees them first.
export function buildFieldStates(content, image) {
  const fields = []

  fields.push({
    key: 'title',
    role: 'title',
    filled: isFilled(content.title),
    payload: { text: content.title },
  })
  fields.push({
    key: 'subtitle',
    role: 'subtitle',
    filled: isFilled(content.subtitle),
    payload: { text: content.subtitle },
  })
  fields.push({
    key: 'description',
    role: 'body',
    filled: isFilled(content.description),
    payload: { text: content.description },
  })
  // Date/time/location are marked as the 'info' group: unlike every other
  // field (which always gets its own individual grid cell), these three are
  // similar, usually-co-presented information and are placed stacked
  // together in one shared column band, autolayout-style, instead of
  // scattered independently around the grid.
  fields.push({
    key: 'date',
    role: 'accent',
    group: 'info',
    filled: isFilled(content.date),
    payload: { text: content.date ? formatDate(content.date) : '' },
  })
  fields.push({
    key: 'time',
    role: 'accent',
    group: 'info',
    filled: isFilled(content.startTime) || isFilled(content.endTime),
    payload: { text: formatTimeRange(content.startTime, content.endTime) },
  })
  fields.push({
    key: 'location',
    role: 'accent',
    group: 'info',
    filled: isFilled(content.location),
    payload: { text: content.location },
  })

  // Freeform gallery images (Layout > Image section) — each one uploaded is
  // already filled by construction (Add opens a file picker and appends the
  // result directly, no separate empty-slot step like Speakers), so they
  // just need a stable per-image key to plug into the same auto-placement
  // path every other field already uses.
  image.images.forEach((img) => {
    fields.push({
      key: `image-${img.id}`,
      role: 'image-hero',
      filled: img.url != null,
      payload: { image: { url: img.url } },
    })
  })

  if (image.speakersOn) {
    image.speakers.forEach((speaker, i) => {
      fields.push({
        key: `speaker-${i}`,
        role: 'image-card',
        filled: speaker.image != null,
        payload: { image: speaker.image, caption: speaker.title || speaker.role || speaker.company || '' },
      })
    })
  }

  return fields
}

function formatDate(date) {
  if (!date) return ''
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

function formatTimeRange(start, end) {
  if (start && end) return `${start} – ${end}`
  return start || end || ''
}
