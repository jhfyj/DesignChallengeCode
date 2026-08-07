import { useEffect, useRef, useState } from 'react'
import { useDesignState } from '../state/DesignContext.jsx'
import { buildFieldStates } from './fieldSelectors.js'
import { usePlacementEngine } from './usePlacementEngine.js'
import { useFitToView } from './useFitToView.js'
import { useElementDrag } from './useElementDrag.js'
import { growGridRows } from './gridMath.js'
import FrameLabel from './FrameLabel.jsx'
import Artboard from './Artboard.jsx'
import './Canvas.css'

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

const ARROW_DELTAS = {
  ArrowUp: { dRow: -1, dCol: 0 },
  ArrowDown: { dRow: 1, dCol: 0 },
  ArrowLeft: { dRow: 0, dCol: -1 },
  ArrowRight: { dRow: 0, dCol: 1 },
}

export default function Canvas() {
  const {
    baseGrid, canvasColor, canvasPattern, patternSize,
    dotColor, gridColor,
    gradientColor1, gradientOpacity1, gradientColor2, gradientOpacity2, gradientAngle,
    colors, content, image, artboardRef, styleMode,
    updatePlacement, selectedKey, setSelectedKey, selectAndInspect,
    removeAssetPlacement,
  } = useDesignState()
  const patternConfig = {
    patternSize, dotColor, gridColor,
    gradientColor1, gradientOpacity1, gradientColor2, gradientOpacity2, gradientAngle,
  }
  const [gridVisible, setGridVisible] = useState(true)
  const containerRef = useRef(null)

  const fieldStates = buildFieldStates(content, image)
  const placements = usePlacementEngine(fieldStates, baseGrid)

  // Placement (usePlacementEngine.js, addAssetPlacement) always runs with
  // allowGrow: false now — the canvas must stay the size the user picked, so
  // new elements shrink/overlap to fit instead of pushing the page taller.
  // This is just a defensive clamp for the one transient case that can still
  // produce an out-of-bounds placement for a render or two: a page-size swap
  // changes baseGrid.rows while old placements briefly still reference the
  // previous (larger) grid, until usePlacementEngine's gridChanged effect
  // reconciles them. Rendering the grid it actually needs here (instead of
  // baseGrid outright) avoids a flash of clipped content in that window.
  // The background image has no row/col/span (it isn't a grid cell — see
  // ImageElement.jsx) so it must be excluded here, or NaN from `undefined +
  // undefined` would poison the whole grid's row count.
  const maxRowsNeeded = Object.values(placements).reduce(
    (max, p) => (p.isBackground ? max : Math.max(max, p.row + p.rowSpan)),
    baseGrid.rows
  )
  const renderedGrid = maxRowsNeeded > baseGrid.rows ? growGridRows(baseGrid, maxRowsNeeded - baseGrid.rows) : baseGrid

  const scale = useFitToView(containerRef, renderedGrid.pixelWidth, renderedGrid.pixelHeight)
  const drag = useElementDrag({ grid: renderedGrid, scale, updatePlacement, onSelect: selectAndInspect })

  // Assets (locked-library items + uploads) can be added over and over, so
  // there's no per-instance "remove" button in the panel — deleting one is a
  // canvas gesture instead, same as most design tools. Content-tab fields
  // (title, speakers, etc.) aren't included: they're tied to actual data, not
  // free-standing decoration, so they aren't deletable this way.
  // Arrow keys nudge the selected element by one grid cell, clamped to the
  // same bounds a drag respects (useElementDrag.js's startMove).
  useEffect(() => {
    function handleKeyDown(e) {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return
      if (!selectedKey) return
      const placement = placements[selectedKey]
      if (!placement) return

      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (!placement.isAsset || placement.locked) return
        e.preventDefault()
        removeAssetPlacement(selectedKey)
        setSelectedKey(null)
        return
      }

      const delta = ARROW_DELTAS[e.key]
      if (!delta || placement.isBackground || placement.locked) return
      e.preventDefault()
      const col = clamp(placement.col + delta.dCol, 0, renderedGrid.cols - placement.colSpan)
      const row = clamp(placement.row + delta.dRow, 0, renderedGrid.rows - placement.rowSpan)
      updatePlacement(selectedKey, { col, row })
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedKey, placements, removeAssetPlacement, setSelectedKey, updatePlacement, renderedGrid])

  return (
    <div className="canvas-region" ref={containerRef} onPointerDown={() => setSelectedKey(null)}>
      <div className="canvas-stage" style={{ width: renderedGrid.pixelWidth * scale }}>
        <FrameLabel name="Frame 1" gridVisible={gridVisible} onToggleGrid={() => setGridVisible((v) => !v)} />
        <div className="artboard-viewport" style={{ width: renderedGrid.pixelWidth * scale, height: renderedGrid.pixelHeight * scale }}>
          <div
            className="artboard-scaler"
            style={{ width: renderedGrid.pixelWidth, height: renderedGrid.pixelHeight, transform: `scale(${scale})` }}
          >
            <Artboard
              domRef={artboardRef}
              grid={renderedGrid}
              placements={placements}
              fieldStates={fieldStates}
              colors={colors}
              canvasColor={canvasColor}
              styleMode={styleMode}
              canvasPattern={canvasPattern}
              patternConfig={patternConfig}
              gridVisible={gridVisible}
              selectedKey={selectedKey}
              drag={drag}
              selectAndInspect={selectAndInspect}
              updatePlacement={updatePlacement}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
