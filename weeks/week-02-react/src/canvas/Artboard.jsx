import GridOverlay from './GridOverlay.jsx'
import SelectionOverlay from './SelectionOverlay.jsx'
import DuotoneFilter from './DuotoneFilter.jsx'
import TextElement from './elements/TextElement.jsx'
import ImageElement from './elements/ImageElement.jsx'
import { hexToRgba } from './colorContrast.js'

const TEXT_ROLES = new Set(['title', 'subtitle', 'body', 'accent'])

// Dots/Grid Lines/Gradient Overlay redraw their background-image inline (not
// as a static CSS rule) since every knob here — pattern size, per-pattern
// color, and the gradient's two stops + angle — needs to reach into the
// actual CSS value, which a fixed class can't parametrize.
function patternStyle(canvasPattern, config) {
  const { patternSize, dotColor, gridColor, gradientColor1, gradientOpacity1, gradientColor2, gradientOpacity2, gradientAngle } = config
  if (canvasPattern === 'Dots') {
    const radius = Math.max(1, patternSize / 12)
    return {
      backgroundImage: `radial-gradient(${hexToRgba(dotColor, 0.16)} ${radius}px, transparent ${radius}px)`,
      backgroundSize: `${patternSize}px ${patternSize}px`,
    }
  }
  if (canvasPattern === 'Grid Lines') {
    const line = hexToRgba(gridColor, 0.1)
    return {
      backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
      backgroundSize: `${patternSize}px ${patternSize}px`,
    }
  }
  if (canvasPattern === 'Gradient Overlay') {
    const stop1 = hexToRgba(gradientColor1, gradientOpacity1 / 100)
    const stop2 = hexToRgba(gradientColor2, gradientOpacity2 / 100)
    return { backgroundImage: `linear-gradient(${gradientAngle}deg, ${stop1}, ${stop2})` }
  }
  return null
}

export default function Artboard({
  domRef, grid, placements, fieldStates, colors, canvasColor, styleMode, canvasPattern, patternConfig,
  gridVisible, selectedKey, drag, selectAndInspect, updatePlacement,
}) {
  const fieldByKey = Object.fromEntries(fieldStates.map((f) => [f.key, f]))
  const selectedPlacement = selectedKey ? placements[selectedKey] : null
  const background = placements.background
  const overlayStyle = patternStyle(canvasPattern, patternConfig)

  return (
    <div
      ref={domRef}
      className="artboard"
      style={{
        width: grid.pixelWidth,
        height: grid.pixelHeight,
        padding: grid.marginPx,
        gap: grid.gapPx,
        backgroundColor: background ? undefined : canvasColor,
        gridTemplateColumns: `repeat(${grid.cols}, ${grid.cellWidth}px)`,
        gridTemplateRows: `repeat(${grid.rows}, ${grid.cellHeight}px)`,
      }}
    >
      <DuotoneFilter colors={colors} />
      {background && (
        <ImageElement
          placement={background}
          image={{ url: background.imageUrl }}
          colors={colors}
          canvasColor={canvasColor}
          selected={selectedKey === 'background'}
          // Clicking anywhere on the canvas not already covered by another
          // element (i.e. clicking "through" to the background) selects the
          // background image instead of falling through to the canvas
          // region's own deselect handler.
          onPointerDown={(e) => {
            e.stopPropagation()
            selectAndInspect('background')
          }}
        />
      )}
      {/* Pattern/gradient overlay renders after (so visually above) the
          background image, but before the grid/content below — a texture or
          legibility scrim sits over the photo without covering the design's
          actual content. */}
      {overlayStyle && <div className="artboard-pattern-overlay" style={overlayStyle} />}
      <GridOverlay cols={grid.cols} rows={grid.rows} visible={gridVisible} />
      {Object.values(placements).map((placement) => {
        if (placement.isBackground) return null
        const field = fieldByKey[placement.fieldKey]
        if (!field && !placement.isAsset) return null
        const selected = placement.fieldKey === selectedKey
        const onPointerDown = (e) => drag.startMove(e, placement)
        if (TEXT_ROLES.has(placement.role)) {
          return (
            <TextElement
              key={placement.fieldKey}
              placement={placement}
              text={field.payload.text}
              colors={colors}
              canvasColor={canvasColor}
              styleMode={styleMode}
              selected={selected}
              onPointerDown={onPointerDown}
            />
          )
        }
        const image = placement.isAsset ? { url: placement.imageUrl } : field.payload.image
        const caption = placement.isAsset ? undefined : field.payload.caption
        const glyph = placement.isAsset ? placement.glyph : undefined
        const name = placement.isAsset ? placement.name : undefined
        return (
          <ImageElement
            key={placement.fieldKey}
            placement={placement}
            image={image}
            caption={caption}
            glyph={glyph}
            name={name}
            colors={colors}
            canvasColor={canvasColor}
            selected={selected}
            onPointerDown={onPointerDown}
          />
        )
      })}
      {selectedPlacement && !selectedPlacement.isBackground && (
        <SelectionOverlay
          placement={selectedPlacement}
          onStartResize={drag.startResize}
          onStartRotate={drag.startRotate}
          onToggleLock={() => updatePlacement(selectedPlacement.fieldKey, { locked: !selectedPlacement.locked })}
        />
      )}
    </div>
  )
}
