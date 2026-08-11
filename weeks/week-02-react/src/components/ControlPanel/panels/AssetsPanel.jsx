import { useRef, useState } from 'react'
import { Upload, LineThin } from '@carbon/icons-react'
import { useDesignState } from '../../../state/DesignContext.jsx'
import { fileToDataUrl } from '../../../utils/fileToDataUrl.js'
import Folder from '../Folder.jsx'
import ColorRow from '../ColorRow.jsx'
import ButtonRow from '../ButtonRow.jsx'
import ActionButton from '../ActionButton.jsx'
import AssetCard from '../AssetCard.jsx'
import TextLibrary from '../TextLibrary.jsx'
import ColorLibrary from '../ColorLibrary.jsx'

// Every locked-asset card comes from whatever's actually dropped into
// src/assets/locked/ (see the README in that folder) — no separate
// placeholder list to keep in sync.
const lockedAssetFiles = import.meta.glob('../../../assets/locked/*.{png,jpg,jpeg,svg,webp,gif}', {
  eager: true,
  query: '?url',
  import: 'default',
})

// Fixed default footprints (grid cols x rows) for the known asset families —
// a wordmark/corner mark is a small fixed icon, a barcode is a wide strip, so
// neither should get the free-roaming random size the placement engine picks
// for open-ended content. Anything that doesn't match a known family (e.g.
// Arrow) keeps that random sizing.
function sizeForAssetName(name) {
  const n = name.toLowerCase()
  if (n.includes('logo')) return { colSpan: 1, rowSpan: 1 }
  if (n.includes('barcode')) return { colSpan: 2, rowSpan: 1 }
  if (n === 'corner') return { colSpan: 1, rowSpan: 1 }
  return null
}

export const LOCKED_ASSETS = Object.entries(lockedAssetFiles)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, url]) => {
    const name = path.split('/').pop().replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
    return { name, image: url, size: sizeForAssetName(name) }
  })

export default function AssetsPanel() {
  const {
    colors, setColors, paletteOverrides, setPaletteColor,
    addAssetPlacement, removeAssetPlacement, addLinePlacement, selectAndInspect,
  } = useDesignState()
  const [uploads, setUploads] = useState([])
  const [textLibraryOpen, setTextLibraryOpen] = useState(false)
  const [colorLibraryOpen, setColorLibraryOpen] = useState(false)
  const inputRef = useRef(null)

  // Every click drops a fresh instance onto the canvas — a locked asset can
  // be placed as many times as the user likes; removing one happens on the
  // canvas itself (select it, press Backspace/Delete), not from this button.
  function addLockedAsset(index) {
    const asset = LOCKED_ASSETS[index]
    addAssetPlacement({
      key: `locked-asset-${index}-${Date.now()}-${Math.random()}`,
      glyph: asset.glyph,
      imageUrl: asset.image,
      name: asset.name,
      size: asset.size,
    })
  }

  async function handleUploadFiles(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    const added = await Promise.all(
      files.map(async (file) => ({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        url: await fileToDataUrl(file),
      }))
    )
    setUploads((prev) => [...prev, ...added])
    // Uploading IS the add action for uploads (there's no separate toggle
    // button for them) — place each straight onto the canvas.
    for (const u of added) {
      addAssetPlacement({ key: `upload-${u.id}`, imageUrl: u.url, name: u.file.name })
    }
  }

  function removeUpload(id) {
    setUploads((prev) => prev.filter((u) => u.id !== id))
    removeAssetPlacement(`upload-${id}`)
  }

  // Drops a fresh Line onto the canvas, pre-selected so its panel (stroke
  // width/style, color) and on-canvas endpoint handles are immediately
  // visible — same "add, then land on its own controls" flow as clicking a
  // locked-asset card, just without a card of its own to click since a Line
  // isn't a pre-made image (see DesignContext.jsx's addLinePlacement).
  function addLine() {
    const key = addLinePlacement()
    selectAndInspect(key)
  }

  return (
    <div className="control-panel__sections">
      <Folder title="Branding">
        <ColorRow label="Colors" colors={colors} onOpen={() => setColorLibraryOpen(true)} />
        <ButtonRow label="Text" buttonLabel="Text Library" onClick={() => setTextLibraryOpen(true)} />
      </Folder>
      {textLibraryOpen && (
        <TextLibrary
          onClose={() => setTextLibraryOpen(false)}
          onSelect={(style) => console.log('text style selected (stub):', style)}
        />
      )}
      {colorLibraryOpen && (
        <ColorLibrary
          colors={colors}
          onChange={setColors}
          paletteOverrides={paletteOverrides}
          onEditPaletteColor={setPaletteColor}
          onClose={() => setColorLibraryOpen(false)}
        />
      )}
      <Folder title="Assets">
        <ActionButton icon={Upload} label="Upload" onClick={() => inputRef.current?.click()} />
        <ActionButton icon={LineThin} label="Add Line" onClick={addLine} />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="image-upload__input"
          onChange={handleUploadFiles}
        />
        {uploads.length > 0 && (
          <>
            <span className="asset-grid__section-label">Your uploads</span>
            <div className="asset-grid">
              {uploads.map((u) => (
                <AssetCard key={u.id} name={u.file.name} thumbnail={u.url} onRemove={() => removeUpload(u.id)} />
              ))}
            </div>
            <span className="asset-grid__section-label">tech@nyu Library</span>
          </>
        )}
        <div className="asset-grid">
          {LOCKED_ASSETS.map(({ name, glyph, image }, i) => (
            <AssetCard
              key={i}
              name={name}
              glyph={glyph}
              thumbnail={image}
              locked
              onAdd={() => addLockedAsset(i)}
            />
          ))}
        </div>
      </Folder>
    </div>
  )
}
