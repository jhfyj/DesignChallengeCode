import { createContext, useContext, useMemo, useRef, useState } from 'react'
import { getPageDimensions, computeGrid } from '../canvas/gridMath.js'
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
  const baseGrid = useMemo(
    () => computeGrid(pixelWidth, pixelHeight, gap, margin),
    [pixelWidth, pixelHeight, gap, margin]
  )

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
    }
    const result = shuffleDesign({ fieldStates, placements, baseGrid, colors, canvasColor, styleMode, paletteOverrides })
    setPlacements(result.placements)
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
    placements, setPlacements, updatePlacement,
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
