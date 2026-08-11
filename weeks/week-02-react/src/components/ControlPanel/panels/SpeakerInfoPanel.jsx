import { ArrowLeft } from '@carbon/icons-react'
import { useDesignState } from '../../../state/DesignContext.jsx'
import { getPageDimensions, computeGrid } from '../../../canvas/gridMath.js'
import { computeSpeakerInfoGeometry } from '../../../canvas/speakerInfoLayout.js'
import { FONT_FAMILIES } from '../../../canvas/fieldSelectors.js'
import { resolveTriad, relativeLuminance, hexToRgba } from '../../../canvas/colorContrast.js'
import Folder from '../Folder.jsx'
import SliderRow from '../SliderRow.jsx'
import SelectRow from '../SelectRow.jsx'
import TextRow from '../TextRow.jsx'
import SingleColorRow from '../SingleColorRow.jsx'
import AlignmentRow from '../AlignmentRow.jsx'
import { SIZE_PRESETS } from './SelectedElementPanel.jsx'

const INFO_KEY_RE = /^speaker-(\d+)-info$/

function sizeOptionsFor(current) {
  return SIZE_PRESETS.includes(current) ? SIZE_PRESETS : [...SIZE_PRESETS, current].sort((a, b) => a - b)
}

function familyOptionsFor(current) {
  return !current || FONT_FAMILIES.includes(current) ? FONT_FAMILIES : [...FONT_FAMILIES, current]
}

// One collapsible per-line section (Name/Company/Role) — same font/size/
// color controls the generic text panel's "Details" folder offers a whole
// text element, just scoped to one line of the info block instead. Starts
// collapsed (defaultOpen=false): three lines' worth of controls open at once
// would be a lot of vertical noise for what's usually a quick tweak.
function TextSubsection({
  title, textValue, placeholder, onTextChange,
  fontFamily, fontWeight, fontSize, onFontFamily, onFontWeight, onFontSize,
  color, defaultColor, onColor, onColorReset,
  colors, addBrandColor, paletteOverrides,
}) {
  return (
    <Folder title={title} defaultOpen={false}>
      <TextRow value={textValue} placeholder={placeholder} onChange={onTextChange} />
      <SelectRow value={fontFamily} options={familyOptionsFor(fontFamily)} onChange={onFontFamily} />
      <div className="details-row">
        <SelectRow
          value={fontWeight >= 700 ? 'Bold' : 'Normal'}
          options={['Normal', 'Bold']}
          onChange={(v) => onFontWeight(v === 'Bold' ? 700 : 400)}
        />
        <SelectRow
          value={`${fontSize}px`}
          options={sizeOptionsFor(fontSize).map((s) => `${s}px`)}
          onChange={(v) => onFontSize(Number(v.replace('px', '')))}
        />
      </div>
      <SingleColorRow
        label="Color"
        color={color || defaultColor}
        onChange={onColor}
        onReset={color ? onColorReset : null}
        customColors={colors}
        onAddCustomColor={addBrandColor}
        paletteOverrides={paletteOverrides}
      />
    </Folder>
  )
}

export default function SpeakerInfoPanel({ infoKey }) {
  const {
    setSelectedKey, placements, image, updateSpeaker,
    pageSize, customWidth, customHeight, gap, margin, colors, addBrandColor, paletteOverrides, canvasColor,
  } = useDesignState()

  const match = infoKey.match(INFO_KEY_RE)
  const index = match ? Number(match[1]) : -1
  const speaker = image.speakers[index]
  const photoPlacement = placements[`speaker-${index}`]
  if (!speaker || !photoPlacement) return null

  const { width, height } = getPageDimensions(pageSize, customWidth, customHeight)
  const grid = computeGrid(width, height, gap, margin)
  const geometry = computeSpeakerInfoGeometry(photoPlacement, speaker.captionPosition || 'Below', grid, {
    colSpanOverride: speaker.infoColSpanOverride,
    rowSpanOverride: speaker.infoRowSpanOverride,
  })

  function patchSpeaker(patch) {
    updateSpeaker(index, patch)
  }

  const { light, mid, dark } = resolveTriad(colors)
  const canvasIsDark = relativeLuminance(canvasColor || '#ffffff') < 0.5
  const nameDefaultColor = canvasIsDark ? light : dark
  const companyDefaultColor = mid
  const roleDefaultColor = hexToRgba(mid, 0.65)

  return (
    <>
      <button type="button" className="selected-element-panel__back" onClick={() => setSelectedKey(null)}>
        <ArrowLeft size={16} />
        <span>Back</span>
      </button>
      <div className="selected-element-panel__title">Speaker Info</div>

      <div className="speaker-info-panel__sections">
        <TextSubsection
          title="Name"
          textValue={speaker.title}
          placeholder="Name"
          onTextChange={(title) => patchSpeaker({ title })}
          fontFamily={speaker.nameFontFamily || 'Figtree'}
          fontWeight={speaker.nameFontWeight || 700}
          fontSize={speaker.nameFontSizeOverride || 12}
          onFontFamily={(v) => patchSpeaker({ nameFontFamily: v })}
          onFontWeight={(v) => patchSpeaker({ nameFontWeight: v })}
          onFontSize={(v) => patchSpeaker({ nameFontSizeOverride: v })}
          color={speaker.nameColorOverride}
          defaultColor={nameDefaultColor}
          onColor={(v) => patchSpeaker({ nameColorOverride: v })}
          onColorReset={() => patchSpeaker({ nameColorOverride: null })}
          colors={colors}
          addBrandColor={addBrandColor}
          paletteOverrides={paletteOverrides}
        />
        <TextSubsection
          title="Company"
          textValue={speaker.company}
          placeholder="Company"
          onTextChange={(company) => patchSpeaker({ company })}
          fontFamily={speaker.companyFontFamily || 'Figtree'}
          fontWeight={speaker.companyFontWeight || 600}
          fontSize={speaker.companyFontSizeOverride || 10.5}
          onFontFamily={(v) => patchSpeaker({ companyFontFamily: v })}
          onFontWeight={(v) => patchSpeaker({ companyFontWeight: v })}
          onFontSize={(v) => patchSpeaker({ companyFontSizeOverride: v })}
          color={speaker.companyColorOverride}
          defaultColor={companyDefaultColor}
          onColor={(v) => patchSpeaker({ companyColorOverride: v })}
          onColorReset={() => patchSpeaker({ companyColorOverride: null })}
          colors={colors}
          addBrandColor={addBrandColor}
          paletteOverrides={paletteOverrides}
        />
        <TextSubsection
          title="Role"
          textValue={speaker.role}
          placeholder="Role"
          onTextChange={(role) => patchSpeaker({ role })}
          fontFamily={speaker.roleFontFamily || 'Figtree'}
          fontWeight={speaker.roleFontWeight || 400}
          fontSize={speaker.roleFontSizeOverride || 9.5}
          onFontFamily={(v) => patchSpeaker({ roleFontFamily: v })}
          onFontWeight={(v) => patchSpeaker({ roleFontWeight: v })}
          onFontSize={(v) => patchSpeaker({ roleFontSizeOverride: v })}
          color={speaker.roleColorOverride}
          defaultColor={roleDefaultColor}
          onColor={(v) => patchSpeaker({ roleColorOverride: v })}
          onColorReset={() => patchSpeaker({ roleColorOverride: null })}
          colors={colors}
          addBrandColor={addBrandColor}
          paletteOverrides={paletteOverrides}
        />
      </div>

      <div className="selected-element-panel__section-label">Alignment</div>
      <AlignmentRow
        alignH={speaker.infoAlignH || 'left'}
        alignV={speaker.infoAlignV || 'middle'}
        onChangeH={(infoAlignH) => patchSpeaker({ infoAlignH })}
        onChangeV={(infoAlignV) => patchSpeaker({ infoAlignV })}
      />

      <SliderRow
        label="Rotation"
        value={speaker.infoRotation || 0}
        min={-180}
        max={180}
        step={15}
        unit="°"
        onChange={(v) => patchSpeaker({ infoRotation: Math.round(v / 15) * 15 })}
      />
      <SliderRow
        label="Width"
        value={geometry ? geometry.colSpan : 1}
        min={1}
        max={grid.cols}
        step={1}
        onChange={(colSpan) => patchSpeaker({ infoColSpanOverride: colSpan })}
      />
      <SliderRow
        label="Height"
        value={geometry ? geometry.rowSpan : 1}
        min={1}
        max={grid.rows}
        step={1}
        onChange={(rowSpan) => patchSpeaker({ infoRowSpanOverride: rowSpan })}
      />
    </>
  )
}
