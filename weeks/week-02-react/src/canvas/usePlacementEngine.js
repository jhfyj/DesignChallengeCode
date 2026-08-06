import { useEffect, useRef } from 'react'
import { useDesignState } from '../state/DesignContext.jsx'
import { buildOccupancy, placeElement, placeGroupMember, pickSize } from './placementEngine.js'

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

// Assigns each field a stable grid placement the moment it transitions from
// empty to filled, and keeps that placement while the user keeps editing
// (only a fresh empty->filled transition gets a new random placement —
// re-randomizing on every keystroke would be distracting, not "unexpected").
// Placements the user has manually moved/resized/rotated (placement.manual)
// are never re-randomized by this engine — they're only clamped back into
// bounds if the grid shape changes underneath them (e.g. a page-size swap).
export function usePlacementEngine(fieldStates, grid) {
  const { placements, setPlacements } = useDesignState()
  const prevFieldStatesRef = useRef([])
  const prevGridShapeRef = useRef(null)

  // fieldStates is rebuilt fresh every render (new array/object references),
  // so depending on it directly would re-run this effect (and call
  // setPlacements) on every render forever, even when nothing about which
  // fields are filled actually changed. Depending on this derived string
  // instead means the effect only re-runs when a field's filled status
  // genuinely flips — which also means typing into an already-filled field
  // never re-triggers placement, satisfying the stability requirement.
  const filledSignature = fieldStates.map((f) => `${f.key}:${f.filled}`).join('|')

  useEffect(() => {
    const gridShape = `${grid.cols}x${grid.rows}`
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

          // Group fields (date/time/location) stack beneath whichever of
          // their group already has a placement, reusing its column band —
          // an "autolayout" block instead of each getting its own scattered
          // grid cell. If nothing in the group is placed yet, or the next
          // slot in the band is unexpectedly occupied, fall back to a normal
          // independent placement (this field becomes the group's anchor).
          let placed = null
          if (field.group) {
            const groupMembers = Object.values(next).filter((p) => p.group === field.group)
            if (groupMembers.length > 0) {
              const anchor = groupMembers[0]
              const nextRow = Math.max(...groupMembers.map((p) => p.row)) + 1
              placed = placeGroupMember(occupancy, workingGrid, anchor.col, anchor.colSpan, nextRow, 1, { allowGrow: false })
            }
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
  }, [filledSignature, grid.cols, grid.rows, grid.gapPx, grid.marginPx])

  return placements
}
