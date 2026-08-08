import { useEffect, useRef } from 'react'
import { useDesignState } from '../state/DesignContext.jsx'
import { buildOccupancy, placeElement, placeGroupMember, pickSize, regionFree, markOccupied } from './placementEngine.js'
import { rowsNeededForText, placeTextFitted } from './textFit.js'
import { FONT_BY_ROLE, SWISS_FONT_BY_ROLE, FONT_WEIGHT_BY_ROLE } from './fieldSelectors.js'
import { useFontsReady } from './useFontsReady.js'

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

const TEXT_ROLES = new Set(['title', 'subtitle', 'body', 'accent'])

// Assigns each field a stable grid placement the moment it transitions from
// empty to filled, and keeps that placement while the user keeps editing
// (only a fresh empty->filled transition gets a new random placement —
// re-randomizing on every keystroke would be distracting, not "unexpected").
// Placements the user has manually moved/resized/rotated (placement.manual)
// are never re-randomized by this engine — they're only clamped back into
// bounds if the grid shape changes underneath them (e.g. a page-size swap).
export function usePlacementEngine(fieldStates, grid, styleMode) {
  const { placements, setPlacements } = useDesignState()
  const prevFieldStatesRef = useRef([])
  const prevGridShapeRef = useRef(null)
  // canvas measureText (textFit.js) silently falls back to a system font
  // if the real webfont hasn't finished loading yet — on first mount, a
  // field's very first fill (e.g. the default title, placed before any font
  // has loaded) can measure narrower than the real font ends up rendering,
  // undersizing the box. The grow-to-fit effect below re-checks once fonts
  // actually finish loading so that initial misestimate gets corrected —
  // same signal TextElement.jsx already uses to force its own re-render.
  const fontsReady = useFontsReady()

  // fieldStates is rebuilt fresh every render (new array/object references),
  // so depending on it directly would re-run this effect (and call
  // setPlacements) on every render forever, even when nothing about which
  // fields are filled actually changed. Depending on this derived string
  // instead means the effect only re-runs when a field's filled status
  // genuinely flips — which also means typing into an already-filled field
  // never re-triggers placement, satisfying the stability requirement.
  const filledSignature = fieldStates.map((f) => `${f.key}:${f.filled}`).join('|')
  // Tracks SIZES too, not just cols/rows counts — a Custom grid regenerate
  // (or a dragged line) keeps the same cols/rows but changes colSizes/
  // rowSizes, and still needs to re-fit/clamp existing placements into the
  // new track bounds via the same gridChanged path below as a page-size
  // swap already does. Also feeds the effect's own dependency array, since
  // otherwise a size-only change (no cols/rows/gap/margin change) wouldn't
  // even re-run this effect in the first place.
  const trackSignature = `${grid.colSizes.join(',')}x${grid.rowSizes.join(',')}`

  useEffect(() => {
    const gridShape = `${grid.cols}x${grid.rows}:${trackSignature}`
    const gridChanged = prevGridShapeRef.current !== null && prevGridShapeRef.current !== gridShape

    // Snapshot "was this field filled before this effect run" here, in the
    // effect body — NOT inside the setPlacements updater below. React 18
    // StrictMode intentionally double-invokes state updater functions in
    // dev to catch impure reducers; an updater that mutates an external ref
    // as a side effect breaks under that double-invocation (the second call
    // sees the ref already mutated by the first and thinks nothing changed).
    // Keeping this snapshot read-only inside the updater keeps it pure.
    const prevFilledMap = {}
    if (!gridChanged) {
      for (const f of prevFieldStatesRef.current) prevFilledMap[f.key] = f.filled
    }

    prevGridShapeRef.current = gridShape
    prevFieldStatesRef.current = fieldStates.map((f) => ({ key: f.key, filled: f.filled }))

    setPlacements((prev) => {
      let next = {}
      if (gridChanged) {
        // Keep manually-placed elements (clamped into the new grid bounds)
        // across a grid-shape change; drop auto-placed ones so they
        // re-place fresh into the new shape below.
        for (const key of Object.keys(prev)) {
          const p = prev[key]
          if (p.manual) {
            const colSpan = Math.min(p.colSpan, grid.cols)
            const rowSpan = Math.min(p.rowSpan, grid.rows)
            const col = clamp(p.col, 0, grid.cols - colSpan)
            const row = clamp(p.row, 0, grid.rows - rowSpan)
            next[key] = { ...p, col, row, colSpan, rowSpan }
          }
        }
      } else {
        next = { ...prev }
      }

      // Asset-tab placements (isAsset: true) and the background image
      // (isBackground: true) aren't driven by a Content-tab field at all, so
      // they're never in fieldStates — exclude them from this "field no
      // longer exists, drop its placement" cleanup or every effect run would
      // immediately delete them.
      const currentKeys = new Set(fieldStates.map((f) => f.key))
      for (const key of Object.keys(next)) {
        if (next[key].isAsset || next[key].isBackground) continue
        if (!currentKeys.has(key)) delete next[key]
      }

      let workingGrid = grid
      const occupancy = buildOccupancy(next, workingGrid)

      for (const field of fieldStates) {
        const wasFilled = prevFilledMap[field.key] ?? false
        const alreadyPlaced = next[field.key] != null

        if (field.filled && !wasFilled && !alreadyPlaced) {
          const headerSizes = Object.values(next)
            .filter((p) => p.role === 'title' || p.role === 'subtitle')
            .map((p) => p.fontSize)
          const fontSize = pickSize(field.role, headerSizes)
          const isTextRole = TEXT_ROLES.has(field.role)
          const fontByRole = styleMode === 'Swiss' ? SWISS_FONT_BY_ROLE : FONT_BY_ROLE
          const fontFamily = fontByRole[field.role]
          const fontWeight = FONT_WEIGHT_BY_ROLE[field.role]
          const text = field.payload.text || ''

          // Group fields (date/time/location) stack beneath whichever of
          // their group already has a placement, reusing its column band —
          // an "autolayout" block instead of each getting its own scattered
          // grid cell. Fixed at 1 row per member (matching shuffleEngine.js's
          // reserveStackedBand) rather than text-fitted — the point of the
          // group is a uniform, always-touching stack, and these fields are
          // short by design (a date, a time, a location), so they're excluded
          // from the grow-to-fit effect below too. If nothing in the group is
          // placed yet, or the next slot in the band is unexpectedly
          // occupied, fall back to a normal independent placement (this
          // field becomes the group's anchor).
          let placed = null
          if (field.group) {
            const groupMembers = Object.values(next).filter((p) => p.group === field.group)
            if (groupMembers.length > 0) {
              const anchor = groupMembers[0]
              const nextRow = Math.max(...groupMembers.map((p) => p.row)) + 1
              placed = placeGroupMember(occupancy, workingGrid, anchor.col, anchor.colSpan, nextRow, 1, { allowGrow: false })
            }
          }
          // Text fields (title/subtitle/description/accent) size their box
          // from the actual text instead of a role's generic span pool, so a
          // long description gets a box tall enough to show it instead of
          // being clipped by .canvas-element's overflow:hidden — same fitted
          // placement shuffleEngine.js already uses for a full reroll.
          if (!placed && isTextRole) {
            placed = placeTextFitted(occupancy, workingGrid, field.role, text, fontFamily, fontWeight, fontSize)
          }
          if (!placed) placed = placeElement(occupancy, workingGrid, field.role, { allowGrow: false })
          const { row, col, colSpan, rowSpan, grid: maybeGrownGrid } = placed
          workingGrid = maybeGrownGrid

          next[field.key] = {
            fieldKey: field.key,
            role: field.role,
            group: field.group,
            row,
            col,
            colSpan,
            rowSpan,
            fontSize,
            rotation: 0,
            manual: false,
            alignH: 'left',
            alignV: 'top',
            // Image-only fields (keynoteImage/speaker-N) ignore these, but
            // setting them here means switching an already-placed image's
            // Fill mode always has a defined starting point.
            fillMode: 'Fill Width/Height',
            imageScale: 100,
          }
        } else if (!field.filled && wasFilled) {
          delete next[field.key]
        }
      }

      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filledSignature, grid.cols, grid.rows, grid.gapPx, grid.marginPx, trackSignature])

  // The effect above only sizes a text box once, at the moment its field
  // first goes from empty to filled — which, while actually typing character
  // by character (as opposed to a paste), means it gets sized for a single
  // letter. Without this, a description that grows into a full paragraph
  // over many keystrokes would silently overflow its 1-row box and get
  // clipped by .canvas-element's overflow:hidden. This effect re-checks on
  // every text change and grows (never shrinks, never moves) an undersized
  // box's rowSpan downward, one row at a time, as long as the next row is
  // still free and within the grid — same bounded, never-grow-the-canvas
  // philosophy as placeTextFitted itself. A manual (user-resized) or locked
  // placement is left alone — that box's size is the user's own choice.
  const textSignature = fieldStates
    .map((f) => (TEXT_ROLES.has(f.role) ? `${f.key}:${(f.payload.text || '').length}` : ''))
    .join('|')

  useEffect(() => {
    setPlacements((prev) => {
      const occupancy = buildOccupancy(prev, grid)
      const fontByRole = styleMode === 'Swiss' ? SWISS_FONT_BY_ROLE : FONT_BY_ROLE
      let next = prev
      for (const field of fieldStates) {
        if (!TEXT_ROLES.has(field.role) || field.group) continue
        const p = prev[field.key]
        if (!p || p.manual || p.locked) continue
        const text = field.payload.text || ''
        if (!text) continue

        const fontFamily = p.fontFamily || fontByRole[field.role]
        const fontWeight = p.fontWeight || FONT_WEIGHT_BY_ROLE[field.role]
        const fontSize = p.fontSizeOverride ?? p.fontSize
        const neededRowSpan = Math.min(
          rowsNeededForText(text, fontFamily, fontWeight, fontSize, p.colSpan, grid),
          grid.rows - p.row,
        )
        if (neededRowSpan <= p.rowSpan) continue

        let rowSpan = p.rowSpan
        while (rowSpan < neededRowSpan && regionFree(occupancy, p.row + rowSpan, p.col, 1, p.colSpan)) {
          markOccupied(occupancy, p.row + rowSpan, p.col, 1, p.colSpan)
          rowSpan += 1
        }
        if (rowSpan !== p.rowSpan) {
          if (next === prev) next = { ...prev }
          next[field.key] = { ...p, rowSpan }
        }
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textSignature, grid.cols, grid.rows, grid.gapPx, grid.marginPx, trackSignature, styleMode, fontsReady])

  return placements
}
