import { ArrowLeft } from '@carbon/icons-react'
import { useDesignState } from '../../../state/DesignContext.jsx'
import { resolveTriad, relativeLuminance } from '../../../canvas/colorContrast.js'
import SliderRow from '../SliderRow.jsx'
import SegmentedRow from '../SegmentedRow.jsx'
import SingleColorRow from '../SingleColorRow.jsx'

const STROKE_STYLES = ['Solid', 'Dashed']

export default function LinePanel({ selectedKey, placement }) {
  const { setSelectedKey, updatePlacement, colors, addBrandColor, paletteOverrides, canvasColor } = useDesignState()

  const { light, dark } = resolveTriad(colors)
  const canvasIsDark = relativeLuminance(canvasColor || '#ffffff') < 0.5
  const defaultColor = canvasIsDark ? light : dark

  return (
    <>
      <button type="button" className="selected-element-panel__back" onClick={() => setSelectedKey(null)}>
        <ArrowLeft size={16} />
        <span>Back</span>
      </button>
      <div className="selected-element-panel__title">Line</div>

      <SliderRow
        label="Stroke Width"
        value={placement.strokeWidth ?? 2}
        min={1}
        max={24}
        step={1}
        unit="px"
        onChange={(strokeWidth) => updatePlacement(selectedKey, { strokeWidth })}
      />
      <SegmentedRow
        label="Stroke Style"
        value={placement.strokeStyle || 'Solid'}
        options={STROKE_STYLES}
        onChange={(strokeStyle) => updatePlacement(selectedKey, { strokeStyle })}
      />
      <SingleColorRow
        label="Color"
        color={placement.colorOverride || defaultColor}
        onChange={(v) => updatePlacement(selectedKey, { colorOverride: v })}
        onReset={placement.colorOverride ? () => updatePlacement(selectedKey, { colorOverride: null }) : null}
        customColors={colors}
        onAddCustomColor={addBrandColor}
        paletteOverrides={paletteOverrides}
      />
    </>
  )
}
