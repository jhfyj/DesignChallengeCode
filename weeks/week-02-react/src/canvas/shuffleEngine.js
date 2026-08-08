import {
  placeElement, placeGroupMember, scanFirstFit, markOccupied, pickSpan,
  READABLE_FLOOR, DEFAULT_HEADER_CEILING,
} from './placementEngine.js'
import { sumTrackRange, applyCustomTrackSizes } from './gridMath.js'
import { generateCustomGridLines, linesToTrackSizes } from './customGrid.js'
import { rowsNeededForText, ensureColSpanFitsWidestWord, placeTextFitted, capRowSpanForHeadroom } from './textFit.js'
import { FONT_FAMILIES, FONT_WEIGHT_BY_ROLE, SWISS_FONT_FAMILIES } from './fieldSelectors.js'
import { rankSwatchesByContrast, readableSwatches, ensureColors } from './colorContrast.js'
import { allSignatureColors, paletteByName, previewSwatches, applyPaletteOverrides } from './colorPalettes.js'
import { estimateTextBlockHeight } from './textMeasure.js'
import { LOCKED_ASSETS } from '../components/ControlPanel/panels/AssetsPanel.jsx'

// Font size variety pool for shuffle only — distinct from placementEngine.js's
// SIZE_POOL, which is deliberately fixed to a single default per role (40/24/16)
// so font size stays put while the user types. That rule is about typing; this
// is a separate, deliberate action, so introducing variety here doesn't conflict.
const SHUFFLE_SIZE_POOL = {
  title: [40, 48, 56, 64], // never below 40px
  subtitle: [18, 20, 24, 28, 32],
  body: [13, 14, 16, 18],
  accent: [12, 14, 16],
}

// Swiss/Müller-Brockmann style mode: real scale JUMPS for hierarchy (a
// signature move — big numerals/titles, small captions, nothing in between)
// instead of SHUFFLE_SIZE_POOL's more modest, evenly-spread range.
const SWISS_SIZE_POOL = {
  title: [64, 96, 128],
  subtitle: [24, 32],
  body: [14, 16],
  accent: [12, 14],
}

// Top-left dominates — the Swiss/editorial default most designs land on —
// but shuffle should occasionally try other alignments rather than always
// preserving whatever the field happened to have before (previously
// alignH/alignV were carried over via `prev.align* ?? 'left'/'top'`, so they
// never actually rerolled on shuffle the way position/size/rotation/color do).
const ALIGN_H_POOL = ['left', 'center', 'right']
const ALIGN_H_WEIGHTS = [0.7, 0.15, 0.15]
const ALIGN_V_POOL = ['top', 'middle', 'bottom']
const ALIGN_V_WEIGHTS = [0.7, 0.15, 0.15]

function pickAlignH() {
  return weightedPick(ALIGN_H_POOL, ALIGN_H_WEIGHTS)
}
function pickAlignV() {
  return weightedPick(ALIGN_V_POOL, ALIGN_V_WEIGHTS)
}

const ROTATION_POOL = [0, 90, 180, 270]
const ROTATION_WEIGHTS = [0.88, 0.04, 0.04, 0.04] // 0° dominates — rotation is a rare accent, not the norm

// Text elements (title/subtitle/non-group body/accent) never flip upside
// down — 180° reads fine on a decorative image or asset, but upside-down
// text is just unreadable. 180's weight is redistributed across 90/270.
const TEXT_ROTATION_POOL = [0, 90, 270]
const TEXT_ROTATION_WEIGHTS = [0.88, 0.06, 0.06]

const INFO_FONT_POOL = ['Figtree', 'Inter', 'Fira Mono']
const INFO_FONT_WEIGHTS = [0.85, 0.075, 0.075] // date/time/location almost always Figtree

const ASSET_PRESENCE_CHANCE = 0.25 // each locked asset slot independently ~1-in-4 to appear

function weightedPick(items, weights) {
  const r = Math.random()
  let cumulative = 0
  for (let i = 0; i < items.length; i++) {
    cumulative += weights[i]
    if (r < cumulative) return items[i]
  }
  return items[items.length - 1]
}

function pickBackgroundColor(colors, mode) {
  // Swiss mode's restrained palette is white/near-black + one accent — the
  // accent lives in text/pattern color, never the canvas itself, so background
  // never draws a random custom color the way Free mode occasionally does.
  if (mode === 'Swiss') return Math.random() < 0.5 ? '#ffffff' : '#1a1a1a'
  const r = Math.random()
  if (r < 0.45) return '#ffffff'
  if (r < 0.9) return '#1a1a1a' // dark grey, not flat black — a little softer, and still reads as "dark"
  return colors[Math.floor(Math.random() * colors.length)]
}

// "No Background Pattern" dominates — a pattern/gradient overlay is a rare
// accent (same shape as ROTATION_WEIGHTS above), not something every shuffle
// should slap on.
const PATTERN_POOL = ['No Background Pattern', 'Dots', 'Grid Lines', 'Gradient Overlay']
const PATTERN_WEIGHTS = [0.7, 0.1, 0.1, 0.1]

function pickCanvasPattern(mode) {
  // The discipline is grid + type + restraint, not decoration — no dot/grid/
  // gradient texture ever competes with the column structure in Swiss mode.
  if (mode === 'Swiss') return 'No Background Pattern'
  return weightedPick(PATTERN_POOL, PATTERN_WEIGHTS)
}

function pickPatternColor(colors) {
  return colors[Math.floor(Math.random() * colors.length)]
}

// Matches the Pattern Size slider's range (DesignPanel.jsx: 8-60, step 2).
function pickPatternSize() {
  return 8 + Math.floor(Math.random() * 27) * 2
}

function pickOpacity(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

// Clean multiples of 45° read as an intentional choice; an arbitrary angle
// like 137° would look like a mistake.
function pickAngle() {
  return Math.floor(Math.random() * 8) * 45
}

function pickRotation(group) {
  if (group === 'info') return 0
  return weightedPick(ROTATION_POOL, ROTATION_WEIGHTS)
}

function pickTextRotation() {
  return weightedPick(TEXT_ROTATION_POOL, TEXT_ROTATION_WEIGHTS)
}

function pickFontFamily(mode) {
  const pool = mode === 'Swiss' ? SWISS_FONT_FAMILIES : FONT_FAMILIES
  return pool[Math.floor(Math.random() * pool.length)]
}

function pickInfoFontFamily(mode) {
  if (mode === 'Swiss') return SWISS_FONT_FAMILIES[0]
  return weightedPick(INFO_FONT_POOL, INFO_FONT_WEIGHTS)
}

// Same header-dominance clamp shape as placementEngine.js's pickSize, but
// drawing from the shuffle-only SHUFFLE_SIZE_POOL instead of the fixed
// placement-time defaults.
function pickShuffleFontSize(role, placedHeaderSizes, mode) {
  let pool = (mode === 'Swiss' ? SWISS_SIZE_POOL[role] : SHUFFLE_SIZE_POOL[role]) || [16]
  if (role === 'body' || role === 'accent') {
    const headerMin = placedHeaderSizes.length ? Math.min(...placedHeaderSizes) : DEFAULT_HEADER_CEILING
    const filtered = pool.filter((s) => s < headerMin)
    pool = filtered.length ? filtered : [Math.max(READABLE_FLOOR, headerMin - 4)]
  }
  return pool[Math.floor(Math.random() * pool.length)]
}

// tier: 0 = highest-contrast swatch (title), 1 = 2nd (subtitle), 2 = lowest (body).
// ~80% follows the tier, ~20% picks randomly among all 3 — "usually", not absolute.
// Custom (the Color Library's user-managed list) can be any length, so tier
// is clamped to whatever's actually available instead of assuming 3+.
function pickTieredSwatch(tier, ranked) {
  const clampedTier = Math.min(tier, ranked.length - 1)
  if (Math.random() < 0.8) return ranked[clampedTier]
  return ranked[Math.floor(Math.random() * ranked.length)]
}

// date/time/location: uniform between the top-2 ranked swatches only, never the lowest.
function pickInfoSwatch(ranked) {
  return ranked[Math.floor(Math.random() * Math.min(2, ranked.length))]
}

// Same fitted-height idea as placeTextFitted (imported from textFit.js), but
// stacked beneath an anchor
// (title, or the info-group's first member) in that anchor's exact column
// band, via placeGroupMember's now-parametrized rowSpan. Also never grows —
// shrinks the row span to whatever's left in the band before giving up and
// returning null (caller falls back to an independent spot).
function placeStackedTextFitted(occupancy, grid, anchorCol, anchorColSpan, nextRow, text, fontFamily, fontWeight, fontSize) {
  const roomBelow = Math.max(1, grid.rows - nextRow)
  let rowSpan = capRowSpanForHeadroom(Math.min(rowsNeededForText(text, fontFamily, fontWeight, fontSize, anchorColSpan, grid), roomBelow), grid)
  while (rowSpan >= 1) {
    const placed = placeGroupMember(occupancy, grid, anchorCol, anchorColSpan, nextRow, rowSpan, { allowGrow: false })
    if (placed) return placed
    rowSpan -= 1
  }
  return null
}

// Reserves one contiguous colSpan x specs.length region up front for a group
// of info fields (in order), one row per member — the placement equivalent
// of a single fixed-size autolayout block, matching a single stacked chip
// rather than independently-sized boxes. Fixed at 1 row per member (instead
// of a text-measured height) both because accent/info text is short by
// design and because a predictable, always-touching block is the point:
// placing members one at a time and hoping there's still room below the
// previous one (the old approach) could silently fail whenever the group's
// first member happened to land near the bottom edge of the grid — shuffle
// never grows the grid, so "no room below" meant the rest of the group fell
// back to independent random placement and scattered across the canvas.
// Returns null (never partial) if even this minimal footprint doesn't fit
// anywhere, so the caller can retry with a smaller group instead.
function reserveStackedBand(occupancy, grid, specs) {
  const { colSpan: pickedColSpan } = pickSpan('accent', grid.cols, grid.rows)
  const colSpan = specs.reduce(
    (span, spec) => ensureColSpanFitsWidestWord(span, grid, spec.text, spec.fontFamily, spec.fontWeight, spec.size),
    pickedColSpan,
  )
  const spot = scanFirstFit(occupancy, grid, colSpan, specs.length)
  if (!spot) return null
  markOccupied(occupancy, spot.row, spot.col, specs.length, colSpan)

  const slots = {}
  specs.forEach((spec, i) => {
    slots[spec.key] = { row: spot.row + i, col: spot.col, colSpan, rowSpan: 1 }
  })
  return slots
}

// Places the whole date/time/location group as one contiguous block
// whenever possible. If the grid is too full for all of them together,
// splits into two smaller blocks (first two together, the rest together)
// rather than letting every member scatter independently — "same block, or
// same two blocks," never three separate spots. Falling back to fully
// independent per-field placement only happens if even a single 1-row slot
// can't be found anywhere, which should be exceptionally rare.
function reserveInfoGroups(occupancy, grid, specs) {
  const whole = reserveStackedBand(occupancy, grid, specs)
  if (whole) return whole

  const slots = {}
  const groups = specs.length > 2 ? [specs.slice(0, 2), specs.slice(2)] : specs.map((spec) => [spec])
  for (const group of groups) {
    const band = reserveStackedBand(occupancy, grid, group)
    if (band) {
      Object.assign(slots, band)
    } else {
      for (const spec of group) {
        slots[spec.key] = placeTextFitted(occupancy, grid, spec.role, spec.text, spec.fontFamily, spec.fontWeight, spec.size)
      }
    }
  }
  return slots
}

// Tries the fitted-height scan first; if nothing fits, tries pairing with an
// already-placed eligible (body/accent, non-group) text block — one
// top-aligned, one bottom-aligned, sharing the exact same cell — provided
// their real measured heights don't collide. Falls back to the general
// capped placer (never grows) if even that fails.
function placeBodyOrAccentWithOverlap(occupancy, grid, role, candidate, placedTextBlocks, pairedKeys) {
  const { colSpan: pickedColSpan } = pickSpan(role, grid.cols, grid.rows)
  const colSpan = ensureColSpanFitsWidestWord(pickedColSpan, grid, candidate.text, candidate.fontFamily, candidate.fontWeight, candidate.fontSize)
  let rowSpan = capRowSpanForHeadroom(Math.min(rowsNeededForText(candidate.text, candidate.fontFamily, candidate.fontWeight, candidate.fontSize, colSpan, grid), grid.rows), grid)

  while (rowSpan >= 1) {
    const spot = scanFirstFit(occupancy, grid, colSpan, rowSpan)
    if (spot) {
      markOccupied(occupancy, spot.row, spot.col, rowSpan, colSpan)
      return { row: spot.row, col: spot.col, colSpan, rowSpan, grid, overlapWith: null, alignV: null }
    }
    rowSpan -= 1
  }

  for (const existing of placedTextBlocks) {
    if (pairedKeys.has(existing.fieldKey)) continue
    // Real placed-box pixel size (existing.col/row are already known here,
    // unlike the pre-placement estimates above) — uses the actual spanned
    // tracks, which matters once columns/rows are unequal (Custom grid).
    const cellWidthPx = sumTrackRange(grid.colSizes, existing.col, existing.colSpan, grid.gapPx)
    const cellHeightPx = sumTrackRange(grid.rowSizes, existing.row, existing.rowSpan, grid.gapPx)
    const existingH = estimateTextBlockHeight({
      text: existing.text, fontFamily: existing.fontFamily, fontWeight: existing.fontWeight, fontSize: existing.fontSize, boxWidthPx: cellWidthPx,
    })
    const candidateH = estimateTextBlockHeight({
      text: candidate.text, fontFamily: candidate.fontFamily, fontWeight: candidate.fontWeight, fontSize: candidate.fontSize, boxWidthPx: cellWidthPx,
    })
    if (existingH + candidateH + 4 <= cellHeightPx) {
      pairedKeys.add(existing.fieldKey)
      const candidateAlignV = existing.alignV === 'bottom' ? 'top' : 'bottom'
      return {
        row: existing.row, col: existing.col, colSpan: existing.colSpan, rowSpan: existing.rowSpan,
        grid, overlapWith: existing.fieldKey, alignV: candidateAlignV,
      }
    }
  }

  const placed = placeElement(occupancy, grid, role, { allowGrow: false })
  return { ...placed, overlapWith: null, alignV: null }
}

// Bypasses addAssetPlacement (which always builds occupancy against baseGrid,
// never an already-grown grid) so every asset placement in this pass shares the
// same workingGrid/occupancy as everything else already placed this shuffle.
function shuffleAssets(prevPlacements, grid, occupancy) {
  let workingGrid = grid
  const next = {}

  for (let i = 0; i < LOCKED_ASSETS.length; i++) {
    if (Math.random() >= ASSET_PRESENCE_CHANCE) continue
    const key = `locked-asset-${i}-${Date.now()}-${Math.random()}`
    // A locked asset only shows up here at all because this random roll
    // happened to hit (ASSET_PRESENCE_CHANCE) — it's decorative, not user
    // content, so if the grid genuinely has no free cell left for it,
    // skipping it (allowOverlapFallback: false) beats forcing it on top of
    // something else. An upload below is the user's own content instead, so
    // that path keeps the default guaranteed-placement behavior.
    const placed = placeElement(occupancy, workingGrid, 'asset', { allowGrow: false, span: LOCKED_ASSETS[i].size, allowOverlapFallback: false })
    if (!placed) continue
    workingGrid = placed.grid
    next[key] = {
      fieldKey: key, role: 'asset', isAsset: true,
      row: placed.row, col: placed.col, colSpan: placed.colSpan, rowSpan: placed.rowSpan,
      rotation: pickRotation(null), manual: true,
      glyph: LOCKED_ASSETS[i].glyph || null, name: LOCKED_ASSETS[i].name || '',
      imageUrl: LOCKED_ASSETS[i].image || null,
      alignH: 'center', alignV: 'middle',
      fillMode: 'Fill Width/Height', imageScale: 100,
    }
  }

  for (const key of Object.keys(prevPlacements)) {
    const p = prevPlacements[key]
    if (!p.isAsset) continue
    // A locked asset (upload or manually-placed library item) keeps its
    // exact spot across a shuffle — same rule as locked content fields
    // below, its cells are already reserved in `occupancy` up front.
    if (p.locked) {
      next[key] = { ...p }
      continue
    }
    if (!key.startsWith('upload-')) continue
    const placed = placeElement(occupancy, workingGrid, 'asset', { allowGrow: false })
    workingGrid = placed.grid
    next[key] = { ...p, row: placed.row, col: placed.col, colSpan: placed.colSpan, rowSpan: placed.rowSpan, rotation: pickRotation(null), manual: true }
  }

  return { placements: next }
}

// Pure (only impurity is Math.random) — rerolls every eligible field's
// position/size/rotation/font/color and the canvas background, ignoring the
// `manual` flag entirely (shuffle always rerolls everything). Locked assets
// may be freshly added or dropped; user uploads and all content fields are
// only repositioned, never deleted.
export function shuffleDesign({
  fieldStates, placements, baseGrid, colors, canvasColor, styleMode, paletteOverrides,
  customGridLines = [], elementCount = 0,
}) {
  // Custom colors are blended with the active palette's signature colors
  // (not replaced by them) — otherwise, the moment a user adds even one
  // Custom color, shuffle would only ever draw from that single color and
  // lose the palette's character entirely. Swiss mode is the one exception:
  // its whole point is restraint, so it ignores Custom/other-palette colors
  // entirely and draws only from its own white/near-black/accent triad — but
  // still respects a user's own edit to that triad (see ColorLibrary.jsx's
  // double-click-to-edit), applied via applyPaletteOverrides.
  const withPaletteFlavor = [...new Set([...(colors || []), ...allSignatureColors()])]
  const swissPalette = applyPaletteOverrides(paletteByName('Swiss'), paletteOverrides?.Swiss)
  const workingColors = styleMode === 'Swiss' ? previewSwatches(swissPalette, 3) : ensureColors(withPaletteFlavor)
  const newCanvasColor = pickBackgroundColor(workingColors, styleMode)
  const ranked = rankSwatchesByContrast(workingColors, newCanvasColor)
  // Swiss mode's palette is only 3 swatches (white/near-black/accent), and
  // the canvas background is picked from that same light/dark pair — so
  // without this, the tier-2 (lowest-contrast) pick below regularly lands
  // body/accent text on a swatch that's practically the same color as the
  // canvas. Filtered once here so every tier below only ever sees swatches
  // that actually read against this shuffle's background.
  const readableRanked = readableSwatches(workingColors, ranked, newCanvasColor)

  const newCanvasPattern = pickCanvasPattern(styleMode)
  const newPatternSize = pickPatternSize()
  const newDotColor = pickPatternColor(workingColors)
  const newGridColor = pickPatternColor(workingColors)
  const newGradientColor1 = pickPatternColor(workingColors)
  const newGradientOpacity1 = pickOpacity(0, 40)
  const newGradientColor2 = pickPatternColor(workingColors)
  const newGradientOpacity2 = pickOpacity(40, 80)
  const newGradientAngle = pickAngle()

  // Grid type: which structure (Uniform or Custom/Swiss) this shuffle lands
  // on, and — if Custom — a freshly regenerated line layout (locked lines
  // survive untouched, per generateCustomGridLines' contract in customGrid.js).
  // Swiss styleMode always forces Custom, matching the discipline's own
  // asymmetric-grid character; Free mode rolls either, 50/50, alongside
  // every other "any style" choice shuffle already makes. `baseGrid` here is
  // always the plain uniform grid (DesignContext.jsx passes baseUniformGrid,
  // never an already-customized one) — Custom's track sizes are derived
  // fresh from it every time, never compounded from a previous shuffle's result.
  const newGridType = styleMode === 'Swiss' ? 'Custom' : (Math.random() < 0.5 ? 'Uniform' : 'Custom')
  const newCustomGridLines = newGridType === 'Custom'
    ? generateCustomGridLines(elementCount, baseGrid, customGridLines)
    // Landed on Uniform this time — leave any stored lines dormant (not
    // cleared) so switching back to Custom later restores dragged/locked
    // work instead of losing it to an unlucky coin-flip.
    : customGridLines
  const workingPlacementGrid = newGridType === 'Custom'
    ? applyCustomTrackSizes(
        baseGrid,
        linesToTrackSizes(newCustomGridLines.filter((l) => l.axis === 'col'), baseGrid.usableWidth),
        linesToTrackSizes(newCustomGridLines.filter((l) => l.axis === 'row'), baseGrid.usableHeight),
      )
    : baseGrid

  let workingGrid = workingPlacementGrid
  const occupancy = new Set()
  // Locked elements (any role, including assets/uploads — see shuffleAssets)
  // keep their exact spot across a shuffle instead of being rerolled; every
  // other element must place around them, never on top, so their cells are
  // reserved before anything else — including the info-group's own block
  // reservation just below — gets a chance to land there.
  for (const key of Object.keys(placements)) {
    const p = placements[key]
    if (p.locked) markOccupied(occupancy, p.row, p.col, p.rowSpan, p.colSpan)
  }
  const next = {}
  const placedTextBlocks = []
  const pairedKeys = new Set()
  const headerSizes = []
  let titleAnchor = null

  // Title+subtitle and date/time/location each read as one connected unit,
  // not scattered independently — placed first (in their original relative
  // order) so their reserved cells are claimed before anything else
  // (description, images) can land in the way and break them apart.
  const headerFields = fieldStates.filter((f) => f.filled && (f.role === 'title' || f.role === 'subtitle'))
  const infoFields = fieldStates.filter((f) => f.filled && f.group === 'info')
  const otherFields = fieldStates.filter((f) => f.filled && f.role !== 'title' && f.role !== 'subtitle' && f.group !== 'info')

  // Every info-group member's font/size/text is decided up front (rather
  // than lazily as each is processed below) so the whole group's height can
  // be reserved as one contiguous band before any of them are placed — see
  // reserveStackedBand's comment for why the old one-at-a-time approach
  // could scatter the group across the canvas.
  let infoFont = null
  const infoSpecs = infoFields.map((field) => ({
    key: field.key,
    role: field.role,
    fontFamily: field.key === 'location' ? pickInfoFontFamily(styleMode) : (infoFont ??= pickInfoFontFamily(styleMode)),
    fontWeight: FONT_WEIGHT_BY_ROLE.accent,
    size: pickShuffleFontSize('accent', headerSizes, styleMode),
    text: field.payload.text || '',
  }))
  const infoSlots = infoSpecs.length ? reserveInfoGroups(occupancy, workingGrid, infoSpecs) : {}

  for (const field of [...headerFields, ...infoFields, ...otherFields]) {
    const prev = placements[field.key] || {}

    if (prev.locked) {
      next[field.key] = { ...prev }
      if (prev.role === 'title' || prev.role === 'subtitle') {
        headerSizes.push(prev.fontSizeOverride ?? prev.fontSize)
        if (prev.role === 'title') {
          titleAnchor = { col: prev.col, colSpan: prev.colSpan, row: prev.row, rowSpan: prev.rowSpan }
        }
      }
      continue
    }

    if (field.group === 'info') {
      const spec = infoSpecs.find((s) => s.key === field.key)
      const placed = infoSlots[field.key]

      next[field.key] = {
        fieldKey: field.key, role: field.role, group: field.group,
        row: placed.row, col: placed.col, colSpan: placed.colSpan, rowSpan: placed.rowSpan,
        fontSize: spec.size, fontSizeOverride: null,
        rotation: 0, manual: true,
        alignH: pickAlignH(), alignV: pickAlignV(),
        fontFamily: spec.fontFamily, fontWeight: prev.fontWeight ?? null,
        colorOverride: workingColors[pickInfoSwatch(readableRanked)],
        fillMode: 'Fill Width/Height', imageScale: 100,
      }
      continue
    }

    if (field.role === 'title' || field.role === 'subtitle') {
      const size = pickShuffleFontSize(field.role, headerSizes, styleMode)
      const fontFamily = pickFontFamily(styleMode)
      const fontWeight = FONT_WEIGHT_BY_ROLE[field.role]
      const text = field.payload.text || ''

      let placed
      if (field.role === 'title') {
        placed = placeTextFitted(occupancy, workingGrid, field.role, text, fontFamily, fontWeight, size)
        titleAnchor = { col: placed.col, colSpan: placed.colSpan, row: placed.row, rowSpan: placed.rowSpan }
      } else {
        // Subtitle stacks directly beneath title, reusing the same
        // stacking mechanic as the date/time/location band, so the two
        // always read as one connected header block — falls back to an
        // independent spot only if that band is genuinely unavailable.
        placed = titleAnchor
          ? placeStackedTextFitted(occupancy, workingGrid, titleAnchor.col, titleAnchor.colSpan, titleAnchor.row + titleAnchor.rowSpan, text, fontFamily, fontWeight, size)
          : null
        if (!placed) placed = placeTextFitted(occupancy, workingGrid, field.role, text, fontFamily, fontWeight, size)
      }
      workingGrid = placed.grid
      headerSizes.push(size)
      const tier = field.role === 'title' ? 0 : 1

      next[field.key] = {
        fieldKey: field.key, role: field.role,
        row: placed.row, col: placed.col, colSpan: placed.colSpan, rowSpan: placed.rowSpan,
        fontSize: size, fontSizeOverride: null,
        rotation: pickTextRotation(), manual: true,
        alignH: pickAlignH(), alignV: pickAlignV(),
        fontFamily, fontWeight: prev.fontWeight ?? null,
        colorOverride: workingColors[pickTieredSwatch(tier, readableRanked)],
        fillMode: 'Fill Width/Height', imageScale: 100,
      }
      continue
    }

    if (field.role === 'body' || field.role === 'accent') {
      const size = pickShuffleFontSize(field.role, headerSizes, styleMode)
      const fontFamily = pickFontFamily(styleMode)
      const fontWeight = FONT_WEIGHT_BY_ROLE[field.role]
      const candidate = { fieldKey: field.key, text: field.payload.text || '', fontFamily, fontWeight, fontSize: size }
      const result = placeBodyOrAccentWithOverlap(occupancy, workingGrid, field.role, candidate, placedTextBlocks, pairedKeys)
      workingGrid = result.grid
      // A body/accent paired into an overlap (sharing a cell with another
      // block, one top- one bottom-aligned — see placeBodyOrAccentWithOverlap)
      // must keep that forced alignV or the two would collide; only an
      // unpaired block gets a fresh weighted pick like everything else.
      const alignV = result.alignV ?? pickAlignV()

      next[field.key] = {
        fieldKey: field.key, role: field.role,
        row: result.row, col: result.col, colSpan: result.colSpan, rowSpan: result.rowSpan,
        fontSize: size, fontSizeOverride: null,
        // Description (body) never rotates — it's the densest block of
        // readable text on the page and rotation would make it a chore
        // to read; accent-role fields here (non-group body/accent) still
        // follow the normal rotation odds, minus 180° (text is never
        // shown upside down).
        rotation: field.role === 'body' ? 0 : pickTextRotation(), manual: true,
        alignH: pickAlignH(), alignV,
        fontFamily, fontWeight: prev.fontWeight ?? null,
        colorOverride: workingColors[pickTieredSwatch(2, readableRanked)],
        fillMode: 'Fill Width/Height', imageScale: 100,
      }
      placedTextBlocks.push({
        fieldKey: field.key, row: result.row, col: result.col, colSpan: result.colSpan, rowSpan: result.rowSpan,
        alignV, text: candidate.text, fontFamily, fontWeight, fontSize: size,
      })
      continue
    }

    // image-hero / image-card
    const placed = placeElement(occupancy, workingGrid, field.role, { allowGrow: false })
    workingGrid = placed.grid
    next[field.key] = {
      fieldKey: field.key, role: field.role,
      row: placed.row, col: placed.col, colSpan: placed.colSpan, rowSpan: placed.rowSpan,
      rotation: pickRotation(null), manual: true,
      alignH: pickAlignH(), alignV: pickAlignV(),
      fillMode: prev.fillMode ?? 'Fill Width/Height', imageScale: prev.imageScale ?? 100,
      preset: prev.preset, preserveColor: prev.preserveColor, dither: prev.dither,
      brightness: prev.brightness, contrast: prev.contrast,
    }
  }

  const assetResult = shuffleAssets(placements, workingGrid, occupancy)
  Object.assign(next, assetResult.placements)

  // The background image isn't in fieldStates (it's not a grid cell — see
  // ImageElement.jsx), so the loop above never touches it. Without this it
  // would silently vanish after every shuffle instead of just staying put.
  if (placements.background) next.background = placements.background

  return {
    placements: next,
    gridType: newGridType,
    customGridLines: newCustomGridLines,
    canvasColor: newCanvasColor,
    canvasPattern: newCanvasPattern,
    patternSize: newPatternSize,
    dotColor: newDotColor,
    gridColor: newGridColor,
    gradientColor1: newGradientColor1,
    gradientOpacity1: newGradientOpacity1,
    gradientColor2: newGradientColor2,
    gradientOpacity2: newGradientOpacity2,
    gradientAngle: newGradientAngle,
  }
}
