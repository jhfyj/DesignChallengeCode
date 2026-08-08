import { useState } from 'react'
import { Download, Renew } from '@carbon/icons-react'
import { toPng, toJpeg, toSvg } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { useDesignState } from '../../../state/DesignContext.jsx'
import Folder from '../Folder.jsx'
import SliderRow from '../SliderRow.jsx'
import SelectRow from '../SelectRow.jsx'
import SingleColorRow from '../SingleColorRow.jsx'
import ActionButton from '../ActionButton.jsx'

const PATTERN_OPTIONS = ['No Background Pattern', 'Dots', 'Grid Lines', 'Gradient Overlay']
const GRID_TYPE_OPTIONS = ['Uniform', 'Custom']

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

export default function DesignPanel() {
  const {
    pageSize, customWidth, setCustomWidth, customHeight, setCustomHeight,
    gap, setGap, margin, setMargin,
    gridType, setGridType, regenerateCustomGrid,
    canvasColor, setCanvasColor, canvasPattern, setCanvasPattern,
    colors, addBrandColor, paletteOverrides,
    patternSize, setPatternSize,
    dotColor, setDotColor, gridColor, setGridColor,
    gradientColor1, setGradientColor1, gradientOpacity1, setGradientOpacity1,
    gradientColor2, setGradientColor2, gradientOpacity2, setGradientOpacity2,
    gradientAngle, setGradientAngle,
    fileType, setFileType, resMultiplier, setResMultiplier,
    pixelWidth, pixelHeight, artboardRef,
  } = useDesignState()
  const [isExporting, setIsExporting] = useState(false)

  async function handleDownload() {
    const node = artboardRef.current
    if (!node || isExporting) return
    setIsExporting(true)
    const opts = { pixelRatio: resMultiplier, cacheBust: true, backgroundColor: canvasColor }
    try {
      if (fileType === 'PNG') {
        downloadDataUrl(await toPng(node, opts), 'dialkit-export.png')
      } else if (fileType === 'SVG') {
        downloadDataUrl(await toSvg(node, opts), 'dialkit-export.svg')
      } else if (fileType === 'PDF') {
        const dataUrl = await toPng(node, opts)
        const w = pixelWidth * resMultiplier
        const h = pixelHeight * resMultiplier
        const pdf = new jsPDF({ orientation: w >= h ? 'landscape' : 'portrait', unit: 'px', format: [w, h] })
        pdf.addImage(dataUrl, 'PNG', 0, 0, w, h)
        pdf.save('dialkit-export.pdf')
      } else {
        downloadDataUrl(await toJpeg(node, { ...opts, quality: 0.95 }), 'dialkit-export.jpg')
      }
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="control-panel__sections">
      {pageSize === 'Custom' && (
        <Folder title="Page Size">
          <SliderRow label="Width" value={customWidth} min={200} max={3000} step={10} unit="px" onChange={setCustomWidth} />
          <SliderRow label="Height" value={customHeight} min={200} max={3000} step={10} unit="px" onChange={setCustomHeight} />
        </Folder>
      )}
      <Folder title="Canvas">
        <SingleColorRow
          label="Background"
          color={canvasColor}
          onChange={setCanvasColor}
          onReset={() => setCanvasColor('#ffffff')}
          customColors={colors}
          onAddCustomColor={addBrandColor}
          paletteOverrides={paletteOverrides}
        />
        <SelectRow value={canvasPattern} onChange={setCanvasPattern} options={PATTERN_OPTIONS} />
        {canvasPattern === 'Dots' && (
          <>
            <SliderRow label="Pattern Size" value={patternSize} min={8} max={60} step={2} unit="px" onChange={setPatternSize} />
            <SingleColorRow
              label="Dot Color"
              color={dotColor}
              onChange={setDotColor}
              onReset={() => setDotColor('#000000')}
              customColors={colors}
              onAddCustomColor={addBrandColor}
              paletteOverrides={paletteOverrides}
            />
          </>
        )}
        {canvasPattern === 'Grid Lines' && (
          <>
            <SliderRow label="Pattern Size" value={patternSize} min={8} max={60} step={2} unit="px" onChange={setPatternSize} />
            <SingleColorRow
              label="Line Color"
              color={gridColor}
              onChange={setGridColor}
              onReset={() => setGridColor('#000000')}
              customColors={colors}
              onAddCustomColor={addBrandColor}
              paletteOverrides={paletteOverrides}
            />
          </>
        )}
        {canvasPattern === 'Gradient Overlay' && (
          // Two independently-colored stops + per-stop transparency + angle,
          // modeled on Figma's gradient panel (color + opacity per stop, plus
          // rotation) rather than a single flat scrim color.
          <>
            <SingleColorRow
              label="Color 1"
              color={gradientColor1}
              onChange={setGradientColor1}
              onReset={() => setGradientColor1('#000000')}
              customColors={colors}
              onAddCustomColor={addBrandColor}
              paletteOverrides={paletteOverrides}
            />
            <SliderRow label="Transparency 1" value={gradientOpacity1} min={0} max={100} unit="%" onChange={setGradientOpacity1} />
            <SingleColorRow
              label="Color 2"
              color={gradientColor2}
              onChange={setGradientColor2}
              onReset={() => setGradientColor2('#000000')}
              customColors={colors}
              onAddCustomColor={addBrandColor}
              paletteOverrides={paletteOverrides}
            />
            <SliderRow label="Transparency 2" value={gradientOpacity2} min={0} max={100} unit="%" onChange={setGradientOpacity2} />
            <SliderRow label="Angle" value={gradientAngle} min={0} max={360} unit="°" onChange={setGradientAngle} />
          </>
        )}
      </Folder>
      <Folder title="Grid">
        <SelectRow label="Grid Type" value={gridType} onChange={setGridType} options={GRID_TYPE_OPTIONS} />
        {gridType === 'Custom' && (
          // Lines only ever regenerate on an explicit trigger (switching
          // into Custom fresh, Shuffle, or this button) — never just from
          // editing content. Locked lines are unaffected either way.
          <ActionButton icon={Renew} label="Regenerate Lines" onClick={regenerateCustomGrid} />
        )}
        <SliderRow label="Gap" value={gap} min={0} max={48} unit="px" onChange={setGap} />
        <SliderRow label="Margin" value={margin} min={0} max={48} unit="px" onChange={setMargin} />
      </Folder>
      <Folder title="Export">
        <SelectRow label="File Type" value={fileType} onChange={setFileType} options={['JPEG', 'PNG', 'SVG', 'PDF']} />
        <SliderRow
          label="Resolution"
          value={resMultiplier}
          min={1}
          max={3}
          step={1}
          onChange={setResMultiplier}
          format={(m) => `${pixelWidth * m} x ${pixelHeight * m}`}
        />
        <ActionButton
          icon={Download}
          label={isExporting ? 'Exporting…' : 'Download'}
          onClick={handleDownload}
        />
      </Folder>
    </div>
  )
}
