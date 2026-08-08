import { createContext, useContext, useMemo, useRef, useState } from 'react'
import { getPageDimensions, computeGrid, applyCustomTrackSizes } from '../canvas/gridMath.js'
import { generateCustomGridLines, linesToTrackSizes, createGridLine, boundingLineIds } from '../canvas/customGrid.js'
import { buildOccupancy, placeElement } from '../canvas/placementEngine.js'
import { buildFieldStates } from '../canvas/fieldSelectors.js'
import { shuffleDesign } from '../canvas/shuffleEngine.js'

const DesignContext = createContext(null)

function emptySpeaker() {
  return { image: null, title: '', role: '', company: '' }
}

export function DesignProvider({ children }) {
  const [pageSize, setPageSize] = useState('Instagram Square (1x1)')
  const [customWidth, setCustomWidth] = useState(540)
  const [customHeight, setCustomHeight] = useState(540)
  const [gap, setGap] = useState(12)
  const [margin, setMargin] = useState(6)
  const [canvasColor, setCanvasColor] = useState('#ffffff')
  const [canvasPattern, setCanvasPattern] = useState('No Background Pattern')
  // 'Swiss' biases shuffle's typography/color/pattern pools toward the
  // Müller-Brockmann discipline (one grotesque typeface, big scale jumps,
  // restrained white/near-black/one-accent palette, no decorative pattern) —
  // a soft bias, not a hard lock: manual per-element overrides still work.
  const [styleMode, setStyleMode] = useState('Free')
  // Grid Type (Design > Grid): 'Uniform' is today's evenly-spaced grid;
  // 'Custom' is a real Swiss-style asymmetric grid — customGridLines holds
  // the actual divider lines (see customGrid.js), folded into baseGrid below.
  // Independent of styleMode — switching styleMode to Swiss doesn't force
  // this to Custom (a soft bias, same philosophy as styleMode itself); only
  // Shuffle enforces the Swiss-implies-Custom pairing (see shuffle() below).
  const [gridType, setGridTypeState] = useState('Uniform')
  const [customGridLines, setCustomGridLines] = useState([])
  // Dots/Grid Lines: spacing (px) between elements, and their own color —
  // bigger value, bigger/sparser pattern.
  const [patternSize, setPatternSize] = useState(18)
  const [dotColor, setDotColor] = useState('#000000')
  const [gridColor, setGridColor] = useState('#000000')
  // Gradient Overlay: a two-stop linear gradient (color + transparency per
  // end, plus an angle) — modeled on Figma's gradient controls rather than a
  // single flat scrim color.
  const [gradientColor1, setGradientColor1] = useState('#000000')
  const [gradientOpacity1, setGradientOpacity1] = useState(0)
  const [gradientColor2, setGradientColor2] = useState('#000000')
  const [gradientOpacity2, setGradientOpacity2] = useState(60)
  const [gradientAngle, setGradientAngle] = useState(180)
  const [fileType, setFileType] = useState('JPEG')
  const [resMultiplier, setResMultiplier] = useState(1)
  // Custom colors (Branding > Colors in the Assets panel) starts empty — the
  // user builds it up via the "+ Add Color" button or by pulling swatches out
  // of a Palette in the Color Library. Everything downstream that used to
  // assume a fixed 3-slot palette (colorForRole, DuotoneFilter, ImageElement,
  // shuffleEngine) falls back to colorContrast.js's DEFAULT_COLORS when empty.
  const [colors, setColors] = useState([])
  // Any per-element color picker (SingleColorRow's Custom tab) calls this
  // when the user commits a freshly-picked color, so it graduates into a
  // Brand swatch instead of only ever living on that one element — "create
  // once, pick from Brand from then on" instead of rebuilding it from
  // scratch every time. Same dedupe rule as ColorLibrary.jsx's own
  // Add Color button.
  function addBrandColor(value) {
    setColors((prev) => (prev.includes(value) ? prev : [...prev, value]))
  }
  const [activeTab, setActiveTab] = useState('Design')
  // Palettes (colorPalettes.js's PALETTES) are otherwise static token tables —
  // double-clicking a swatch in the Color Library edits it in place, stored
  // here (not locally in ColorLibrary) so the edit also reaches shuffle
  // (e.g. a customized Swiss accent actually changes what Swiss-mode shuffle
  // draws from). Shape: { [paletteName]: { [categoryName]: { [entryKey]: hex } } }.
  const [paletteOverrides, setPaletteOverrides] = useState({})
  function setPaletteColor(paletteName, categoryName, key, value) {
    setPaletteOverrides((prev) => ({
      ...prev,
      [paletteName]: {
        ...prev[paletteName],
        [categoryName]: { ...prev[paletteName]?.[categoryName], [key]: value },
      },
    }))
  }

  // Real pixel size + base grid shape, derived here (not just inside Canvas)
  // so any panel — Assets' "add to canvas" placement, Export's resolution
  // label — can read the same current grid without duplicating gridMath calls.
  const { width: pixelWidth, height: pixelHeight } = getPageDimensions(pageSize, customWidth, customHeight)
  // baseUniformGrid: today's plain evenly-spaced grid, unchanged. baseGrid
  // (what every consumer actually reads) layers Custom-mode track sizing on
  // top when active, otherwise passes the uniform grid straight through —
  // every existing baseGrid consumer (Canvas.jsx, placementEngine.js,
  // shuffleEngine.js, addAssetPlacement below) is unaffected either way.
  const baseUniformGrid = useMemo(
    () => computeGrid(pixelWidth, pixelHeight, gap, margin),
    [pixelWidth, pixelHeight, gap, margin]
  )
  const baseGrid = useMemo(() => {
    if (gridType !== 'Custom') return baseUniformGrid
    const colSizes = linesToTrackSizes(customGridLines.filter((l) => l.axis === 'col'), baseUniformGrid.usableWidth)
    const rowSizes = linesToTrackSizes(customGridLines.filter((l) => l.axis === 'row'), baseUniformGrid.usableHeight)
    return applyCustomTrackSizes(baseUniformGrid, colSizes, rowSizes)
  }, [baseUniformGrid, gridType, customGridLines])

  // DOM node of the rendered artboard (set by Canvas/Artboard), read by the
  // Export folder's Download action to rasterize exactly what's on screen.
  const artboardRef = useRef(null)

  const [content, setContent] = useState({
    title: 'Club Fest Kickoff',
    subtitle: '',
    description: '',
    startTime: '',
    endTime: '',
    date: null,
    location: '',
  })
  function updateContent(patch) {
    setContent((c) => ({ ...c, ...patch }))
  }

  const [image, setImage] = useState({
    backgroundImage: null,
    speakersOn: true,
    speakers: Array.from({ length: 4 }, emptySpeaker),
    images: [],
  })
  function updateImage(patch) {
    setImage((s) => ({ ...s, ...patch }))
  }

  // "Element count" the Custom grid's line generator scales with — the same
  // filled-field filter shuffleEngine.js's own per-field loop already applies.
  const filledElementCount = buildFieldStates(content, image).filter((f) => f.filled).length

  function updateGridLine(id, patch) {
    setCustomGridLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  // Manual line management (double-click to add, select+Backspace/Delete to
  // remove — see Canvas.jsx) — independent of the algorithmic generator
  // above, same "user's explicit edit" precedent as a dragged/locked line.
  function addGridLine(axis, position) {
    const line = createGridLine(axis, position)
    setCustomGridLines((prev) => [...prev, line])
    return line.id
  }
  function removeGridLine(id) {
    setCustomGridLines((prev) => prev.filter((l) => l.id !== id))
  }

  // Unlocked lines only ever regenerate on an explicit call to this (switching
  // into Custom fresh, the Regenerate action, or a Shuffle that rolls Custom)
  // — never as a side effect of content changing, per the "on-demand only"
  // requirement. Locked lines always survive untouched (see customGrid.js).
  function regenerateCustomGrid() {
    setCustomGridLines((prev) => generateCustomGridLines(filledElementCount, baseUniformGrid, prev))
  }

  // Switching TO Custom for the first time (no lines yet) generates a fresh
  // layout once; toggling back to Custom later reuses whatever lines already
  // exist instead of silently discarding dragged/locked work.
  function setGridType(next) {
    setGridTypeState(next)
    if (next === 'Custom' && customGridLines.length === 0) {
      setCustomGridLines(generateCustomGridLines(filledElementCount, baseUniformGrid, []))
    }
  }

  // The background image isn't a Content-tab field (it has no row/col — it
  // covers the whole canvas), so it can't flow through usePlacementEngine's
  // normal empty->filled placement logic. It's still stored as an ordinary
  // entry in `placements` (key 'background', flagged isBackground) so it can
  // reuse every existing image control in SelectedElementPanel (fill mode,
  // alignment, preset/dither/brightness/contrast) via the same updatePlacement
  // path everything else already uses — only creating/removing the entry
  // needs its own function, same reasoning as addAssetPlacement/removeAssetPlacement.
  function setBackgroundImage(value) {
    setImage((s) => ({ ...s, backgroundImage: value }))
    setPlacements((prev) => {
      if (!value) {
        if (!prev.background) return prev
        const next = { ...prev }
        delete next.background
        return next
      }
      const existing = prev.background
      return {
        ...prev,
        background: {
          fieldKey: 'background',
          role: 'background',
          isBackground: true,
          imageUrl: value.url,
          rotation: 0,
          manual: true,
          alignH: existing?.alignH ?? 'center',
          alignV: existing?.alignV ?? 'middle',
          fillMode: existing?.fillMode ?? 'Fill Width/Height',
          imageScale: existing?.imageScale ?? 100,
          preset: existing?.preset,
          preserveColor: existing?.preserveColor,
          dither: existing?.dither,
          brightness: existing?.brightness,
          contrast: existing?.contrast,
        },
      }
    })
  }

  // Canvas element placements (fieldKey -> {row, col, colSpan, rowSpan,
  // fontSize, rotation, manual}). Lives here (not local to the Canvas
  // component) so the right panel's selected-element section can read/edit
  // the same entries a canvas drag would produce.
  const [placements, setPlacements] = useState({})
  function updatePlacement(key, patch) {
    setPlacements((prev) => {
      if (!prev[key]) return prev
      return {
        ...prev,
        [key]: {
          ...prev[key],
          ...patch,
          manual: true,
        },
      }
    })
  }

  // Locking an element (SelectionOverlay's lock toggle) is supposed to mean
  // "shuffling changes nothing about it" — true for its row/col indices
  // (shuffleEngine.js reserves a locked placement's cells), but on a Custom
  // grid the LINES bounding that cell can still move on the next regenerate/
  // shuffle, shifting the locked element's actual on-screen position/size
  // even though its indices never changed. Locking the element now also
  // locks whichever grid lines currently sit on its cell's edges, so a
  // regenerate can't move them out from under it. Unlocking the element
  // deliberately does NOT auto-unlock those lines back — the user locked
  // them (even if indirectly), so leaving them locked until an explicit
  // unlock (on the line itself, or the Grid panel) avoids silently
  // discarding what might be relied on by something else's layout too.
  function toggleElementLock(key) {
    const placement = placements[key]
    if (!placement) return
    const nextLocked = !placement.locked
    updatePlacement(key, { locked: nextLocked })
    if (nextLocked && gridType === 'Custom') {
      const colLineIds = boundingLineIds(customGridLines, 'col', placement.col, placement.colSpan, baseGrid.cols)
      const rowLineIds = boundingLineIds(customGridLines, 'row', placement.row, placement.rowSpan, baseGrid.rows)
      const idsToLock = new Set([...colLineIds, ...rowLineIds])
      if (idsToLock.size) {
        setCustomGridLines((prev) => prev.map((l) => (idsToLock.has(l.id) ? { ...l, locked: true } : l)))
      }
    }
  }

  // Assets-tab items (locked library assets + user uploads) place themselves
  // directly onto the canvas grid on "Add", using the same first-fit scan the
  // content-field placement engine uses — but keyed/flagged separately
  // (isAsset: true) since they aren't driven by a Content-tab field and must
  // survive usePlacementEngine's per-field reconciliation untouched.
  function addAssetPlacement({ key, imageUrl, glyph, name, size }) {
    setPlacements((prev) => {
      if (prev[key]) return prev
      const occupancy = buildOccupancy(prev, baseGrid)
      const { row, col, colSpan, rowSpan } = placeElement(occupancy, baseGrid, 'asset', { span: size, allowGrow: false })
      return {
        ...prev,
        [key]: {
          fieldKey: key,
          role: 'asset',
          row, col, colSpan, rowSpan,
          rotation: 0,
          manual: true,
          isAsset: true,
          imageUrl: imageUrl || null,
          glyph: glyph || null,
          name: name || '',
          alignH: 'center',
          alignV: 'middle',
          fillMode: 'Fill Width/Height',
          imageScale: 100,
        },
      }
    })
  }
  function removeAssetPlacement(key) {
    setPlacements((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  // One-step Shuffle undo: a ref (not state) since restoring it doesn't need
  // to trigger its own render, just snapshot-then-restore of placements/
  // canvasColor/pattern settings. A second shuffle simply overwrites the
  // snapshot.
  const preShuffleSnapshotRef = useRef(null)
  const [canUndoShuffle, setCanUndoShuffle] = useState(false)

  function shuffle() {
    const fieldStates = buildFieldStates(content, image)
    preShuffleSnapshotRef.current = {
      placements, canvasColor, canvasPattern, patternSize, dotColor, gridColor,
      gradientColor1, gradientOpacity1, gradientColor2, gradientOpacity2, gradientAngle,
      gridType, customGridLines,
    }
    const result = shuffleDesign({
      fieldStates, placements, baseGrid: baseUniformGrid, colors, canvasColor, styleMode, paletteOverrides,
      customGridLines, elementCount: filledElementCount,
    })
    setPlacements(result.placements)
    // Raw state setter, not the setGridType wrapper — shuffleDesign already
    // computed the right customGridLines for whichever gridType it landed
    // on, so there's no "generate a fresh layout" step to also trigger here.
    setGridTypeState(result.gridType)
    setCustomGridLines(result.customGridLines)
    setCanvasColor(result.canvasColor)
    setCanvasPattern(result.canvasPattern)
    setPatternSize(result.patternSize)
    setDotColor(result.dotColor)
    setGridColor(result.gridColor)
    setGradientColor1(result.gradientColor1)
    setGradientOpacity1(result.gradientOpacity1)
    setGradientColor2(result.gradientColor2)
    setGradientOpacity2(result.gradientOpacity2)
    setGradientAngle(result.gradientAngle)
    setCanUndoShuffle(true)
  }

  function undoShuffle() {
    if (!preShuffleSnapshotRef.current) return
    const snap = preShuffleSnapshotRef.current
    setPlacements(snap.placements)
    setGridTypeState(snap.gridType)
    setCustomGridLines(snap.customGridLines)
    setCanvasColor(snap.canvasColor)
    setCanvasPattern(snap.canvasPattern)
    setPatternSize(snap.patternSize)
    setDotColor(snap.dotColor)
    setGridColor(snap.gridColor)
    setGradientColor1(snap.gradientColor1)
    setGradientOpacity1(snap.gradientOpacity1)
    setGradientColor2(snap.gradientColor2)
    setGradientOpacity2(snap.gradientOpacity2)
    setGradientAngle(snap.gradientAngle)
    preShuffleSnapshotRef.current = null
    setCanUndoShuffle(false)
  }

  // Dismissing the toast (its X button) just hides it — the shuffle result
  // stays as-is, only the "Undo" affordance goes away, same as if the
  // snapshot had never been offered.
  function dismissShuffleToast() {
    setCanUndoShuffle(false)
  }

  // selectedKey drives the canvas boundary/highlight only. inspectorOpen
  // additionally decides whether the right panel switches away from the
  // active tab to show SelectedElementPanel — true when the selection came
  // from clicking an element on the canvas, false when it came from typing
  // into a Content-tab field (so the panel the user is actively typing in
  // doesn't get yanked out from under them the moment their text becomes
  // non-empty and gets a placement).
  const [selectedKey, setSelectedKeyState] = useState(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)

  function setSelectedKey(key) {
    setSelectedKeyState(key)
    setInspectorOpen(false)
  }

  function selectAndInspect(key) {
    setSelectedKeyState(key)
    setInspectorOpen(key != null)
  }

  const value = {
    pageSize, setPageSize,
    customWidth, setCustomWidth,
    customHeight, setCustomHeight,
    gap, setGap,
    margin, setMargin,
    canvasColor, setCanvasColor,
    canvasPattern, setCanvasPattern,
    styleMode, setStyleMode,
    gridType, setGridType, customGridLines, updateGridLine, regenerateCustomGrid,
    addGridLine, removeGridLine,
    patternSize, setPatternSize,
    dotColor, setDotColor,
    gridColor, setGridColor,
    gradientColor1, setGradientColor1,
    gradientOpacity1, setGradientOpacity1,
    gradientColor2, setGradientColor2,
    gradientOpacity2, setGradientOpacity2,
    gradientAngle, setGradientAngle,
    fileType, setFileType,
    resMultiplier, setResMultiplier,
    colors, setColors, addBrandColor,
    paletteOverrides, setPaletteColor,
    activeTab, setActiveTab,
    pixelWidth, pixelHeight, baseGrid,
    artboardRef,
    content, updateContent,
    image, updateImage, setBackgroundImage,
    placements, setPlacements, updatePlacement, toggleElementLock,
    addAssetPlacement, removeAssetPlacement,
    selectedKey, setSelectedKey,
    inspectorOpen, selectAndInspect,
    shuffle, undoShuffle, canUndoShuffle, dismissShuffleToast,
  }

  return <DesignContext.Provider value={value}>{children}</DesignContext.Provider>
}

export function useDesignState() {
  const ctx = useContext(DesignContext)
  if (!ctx) throw new Error('useDesignState must be used within DesignProvider')
  return ctx
}
