import { ArrowLeft } from '@carbon/icons-react'
import { useDesignState } from '../../../state/DesignContext.jsx'
import { getPageDimensions, computeGrid } from '../../../canvas/gridMath.js'
import { colorForRole, FONT_BY_ROLE, SWISS_FONT_BY_ROLE, FONT_FAMILIES } from '../../../canvas/fieldSelectors.js'
import { resolveTriad, relativeLuminance, isSvgUrl } from '../../../canvas/colorContrast.js'
import Folder from '../Folder.jsx'
import SliderRow from '../SliderRow.jsx'
import SelectRow from '../SelectRow.jsx'
import TextRow from '../TextRow.jsx'
import SingleColorRow from '../SingleColorRow.jsx'
import AlignmentRow from '../AlignmentRow.jsx'
import ToggleRow from '../ToggleRow.jsx'
import SegmentedRow from '../SegmentedRow.jsx'

const TEXT_ROLES = new Set(['title', 'subtitle', 'body', 'accent'])
// Photo elements (keynote/speaker images) get the preset filter + Details
// treatment section; Assets-tab items (logos, uploads placed as decor) get
// everything else an image has (alignment/fill/size) but not that — a
// tech@nyu logo mark isn't a photo that wants brightness/dither controls.
const PHOTO_ROLES = new Set(['image-hero', 'image-card', 'background'])
const DITHER_OPTIONS = ['Low', 'Med', 'High']
// Selecting a preset applies this whole bundle to Details at once; each
// Details control stays independently editable afterward.
const PRESETS = {
  None: { preserveColor: true, dither: 'Low', brightness: 50, contrast: 50 },
  'Preset 1': { preserveColor: true, dither: 'Low', brightness: 24, contrast: 24 },
  'Preset 2': { preserveColor: false, dither: 'Med', brightness: 50, contrast: 60 },
  'Preset 3': { preserveColor: false, dither: 'High', brightness: 40, contrast: 75 },
}
const PRESET_OPTIONS = Object.keys(PRESETS)
const ROLE_DISPLAY = { title: 'Header', subtitle: 'Header', body: 'Body', accent: 'Accent' }
const ROLE_FROM_DISPLAY = { Header: 'title', Body: 'body', Accent: 'accent' }
const SIZE_PRESETS = [12, 14, 16, 20, 24, 32, 36, 40, 48, 56, 64]
const EDITABLE_CONTENT_FIELD = { title: 'title', subtitle: 'subtitle', description: 'description' }
// Mirrors Figma's image-fill model: "Fill Width/Height" is Figma's Fill
// (scale-to-cover, crop overflow), "Fill Width"/"Fill Height" pin one axis
// and let the other run past or short of the box, and "Original Ratio" is
// Figma's Fit plus a manual zoom — the image never stretches off-ratio in
// any of the four, only the crop/empty-space behavior differs.
const FILL_MODES = ['Fill Width', 'Fill Height', 'Fill Width/Height', 'Original Ratio']

function labelForKey(key) {
  if (key.startsWith('speaker-')) return `Headshot ${Number(key.split('-')[1]) + 1}`
  const labels = {
    title: 'Title', subtitle: 'Subtitle', description: 'Description',
    date: 'Date', time: 'Time', location: 'Location',
  }
  return labels[key] || key
}

export default function SelectedElementPanel() {
  const {
    selectedKey, setSelectedKey, placements, updatePlacement,
    pageSize, customWidth, customHeight, gap, margin, colors, addBrandColor, paletteOverrides, canvasColor, content, updateContent, styleMode,
  } = useDesignState()

  const placement = placements[selectedKey]
  if (!placement) return null

  const { width, height } = getPageDimensions(pageSize, customWidth, customHeight)
  const grid = computeGrid(width, height, gap, margin)
  const isText = TEXT_ROLES.has(placement.role)
  const isPhoto = PHOTO_ROLES.has(placement.role)
  const isBackground = placement.role === 'background'
  const panelTitle = isBackground ? 'Background Image' : isText ? 'Text' : isPhoto ? 'Image' : 'Asset'
  // Only locked-asset SVGs are masked/tinted marks (see ImageElement.jsx) —
  // a plain photo dropped in via Upload has real baked-in colors, so it
  // doesn't get a flat "Color" control the way a logo mark does.
  const isAssetLogoMark = placement.role === 'asset' && isSvgUrl(placement.imageUrl)
  const { light: assetLight, dark: assetDark } = resolveTriad(colors)
  const assetCanvasIsDark = relativeLuminance(canvasColor || '#ffffff') < 0.5
  const isBarcodeAsset = /barcode/i.test(placement.name || '')
  const defaultAssetColor = isBarcodeAsset
    ? (assetCanvasIsDark ? '#ffffff' : '#000000')
    : (assetCanvasIsDark ? assetLight : assetDark)
  const defaultFontFamily = (styleMode === 'Swiss' ? SWISS_FONT_BY_ROLE : FONT_BY_ROLE)[placement.role]
  // Shuffle (and the info/date-time-location group) can assign fonts outside
  // this dropdown's curated FONT_FAMILIES list (e.g. 'Inter' via the info
  // group's own pool, or every role in Swiss mode) — same class of bug as
  // sizeOptions below: a <select> whose current value isn't among its
  // <option>s silently shows a different one, so the panel's displayed font
  // stops matching what's actually rendered on the canvas.
  const currentFontFamily = placement.fontFamily || defaultFontFamily
  const familyOptions = FONT_FAMILIES.includes(currentFontFamily) ? FONT_FAMILIES : [...FONT_FAMILIES, currentFontFamily]
  const contentField = EDITABLE_CONTENT_FIELD[selectedKey]
  // Shuffle draws from its own, wider size pool (shuffleEngine.js's
  // SHUFFLE_SIZE_POOL) than this dropdown's curated presets — without this,
  // a shuffled size missing from SIZE_PRESETS wouldn't match any <option>,
  // and the dropdown would silently default to showing the first preset
  // instead of the size actually applied to the text.
  const currentSize = placement.fontSizeOverride || placement.fontSize || 16
  const sizeOptions = SIZE_PRESETS.includes(currentSize)
    ? SIZE_PRESETS
    : [...SIZE_PRESETS, currentSize].sort((a, b) => a - b)

  function resetOverrides(patch) {
    updatePlacement(selectedKey, { fontFamily: null, fontWeight: null, fontSizeOverride: null, colorOverride: null, ...patch })
  }

  return (
    <>
      <button type="button" className="selected-element-panel__back" onClick={() => setSelectedKey(null)}>
        <ArrowLeft size={16} />
        <span>Back</span>
      </button>
      <div className="selected-element-panel__title">{panelTitle}</div>

      {isPhoto && (
        <SelectRow
          value={placement.preset || 'Preset 1'}
          options={PRESET_OPTIONS}
          onChange={(v) => updatePlacement(selectedKey, { preset: v, ...PRESETS[v] })}
        />
      )}

      {isText && (
        <>
          <SelectRow
            value={ROLE_DISPLAY[placement.role]}
            options={['Header', 'Body', 'Accent']}
            onChange={(display) => resetOverrides({ role: ROLE_FROM_DISPLAY[display] })}
          />

          {contentField && (
            <TextRow
              value={content[contentField]}
              placeholder={labelForKey(selectedKey)}
              onChange={(v) => updateContent({ [contentField]: v })}
            />
          )}

          <Folder title="Details">
            <SelectRow
              value={currentFontFamily}
              options={familyOptions}
              onChange={(v) => updatePlacement(selectedKey, { fontFamily: v })}
            />
            <div className="details-row">
              <SelectRow
                value={(placement.fontWeight || (placement.role === 'title' || placement.role === 'subtitle' ? 700 : 400)) === 700 ? 'Bold' : 'Normal'}
                options={['Normal', 'Bold']}
                onChange={(v) => updatePlacement(selectedKey, { fontWeight: v === 'Bold' ? 700 : 400 })}
              />
              <SelectRow
                value={`${currentSize}px`}
                options={sizeOptions.map((s) => `${s}px`)}
                onChange={(v) => updatePlacement(selectedKey, { fontSizeOverride: Number(v.replace('px', '')) })}
              />
            </div>
            <SingleColorRow
              label="Color"
              color={placement.colorOverride || colorForRole(placement.role, colors, canvasColor)}
              onChange={(v) => updatePlacement(selectedKey, { colorOverride: v })}
              onReset={placement.colorOverride ? () => updatePlacement(selectedKey, { colorOverride: null }) : null}
              customColors={colors}
              onAddCustomColor={addBrandColor}
              paletteOverrides={paletteOverrides}
            />
          </Folder>
        </>
      )}

      <div className="selected-element-panel__section-label">Alignment</div>
      <AlignmentRow
        alignH={placement.alignH || 'left'}
        alignV={placement.alignV || 'top'}
        onChangeH={(alignH) => updatePlacement(selectedKey, { alignH })}
        onChangeV={(alignV) => updatePlacement(selectedKey, { alignV })}
      />

      {!isText && (
        <>
          <SelectRow
            value={placement.fillMode || 'Fill Width/Height'}
            options={FILL_MODES}
            onChange={(v) => updatePlacement(selectedKey, { fillMode: v })}
          />
          {(placement.fillMode || 'Fill Width/Height') === 'Original Ratio' && (
            <SliderRow
              label="Scale"
              value={placement.imageScale ?? 100}
              min={25}
              max={300}
              step={5}
              unit="%"
              onChange={(imageScale) => updatePlacement(selectedKey, { imageScale })}
            />
          )}
        </>
      )}

      {isAssetLogoMark && (
        <SingleColorRow
          label="Color"
          color={placement.colorOverride || defaultAssetColor}
          onChange={(v) => updatePlacement(selectedKey, { colorOverride: v })}
          onReset={placement.colorOverride ? () => updatePlacement(selectedKey, { colorOverride: null }) : null}
          customColors={colors}
          onAddCustomColor={addBrandColor}
          paletteOverrides={paletteOverrides}
        />
      )}

      {!isBackground && (
        <>
          <SliderRow
            label="Rotation"
            value={placement.rotation || 0}
            min={-180}
            max={180}
            step={15}
            unit="°"
            // Round even when the value comes from typing an exact number (the
            // Details/Rotation double-click edit), not just from dragging the
            // slider — 15° is a hard constraint, not just the drag increment.
            onChange={(v) => updatePlacement(selectedKey, { rotation: Math.round(v / 15) * 15 })}
          />
          <SliderRow
            label="Width"
            value={placement.colSpan}
            min={1}
            // Fixed to the grid's total column count (not "columns remaining
            // from here to the edge") — the fill bar represents how wide the
            // element is relative to the whole grid, so it shouldn't visually
            // jump depending on which column the element happens to start at.
            max={grid.cols}
            step={1}
            onChange={(colSpan) => {
              // An explicit width request (drag or type-to-edit) should always
              // take effect when it geometrically fits somewhere — if the box
              // is flush against the right edge, shift it left rather than
              // silently shrinking the requested size back down to whatever
              // fit from the old position (that read as "typing doesn't save").
              const clampedColSpan = Math.min(colSpan, grid.cols)
              const col = Math.min(placement.col, grid.cols - clampedColSpan)
              updatePlacement(selectedKey, { colSpan: clampedColSpan, col })
            }}
          />
          <SliderRow
            label="Height"
            value={placement.rowSpan}
            min={1}
            max={grid.rows}
            step={1}
            onChange={(rowSpan) => {
              const clampedRowSpan = Math.min(rowSpan, grid.rows)
              const row = Math.min(placement.row, grid.rows - clampedRowSpan)
              updatePlacement(selectedKey, { rowSpan: clampedRowSpan, row })
            }}
          />
        </>
      )}

      {isPhoto && (
        <Folder title="Details">
          <SegmentedRow
            label="Dither"
            value={placement.dither || 'Low'}
            options={DITHER_OPTIONS}
            onChange={(dither) => updatePlacement(selectedKey, { dither })}
          />
          <ToggleRow
            label="Preserve Color"
            value={placement.preserveColor ?? true}
            onChange={(preserveColor) => updatePlacement(selectedKey, { preserveColor })}
          />
          <SliderRow
            label="Brightness"
            value={placement.brightness ?? 24}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(brightness) => updatePlacement(selectedKey, { brightness })}
          />
          <SliderRow
            label="Contrast"
            value={placement.contrast ?? 24}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(contrast) => updatePlacement(selectedKey, { contrast })}
          />
        </Folder>
      )}
    </>
  )
}
