import { useEffect, useRef, useState } from 'react'
import { resolveTriad, relativeLuminance, isSvgUrl } from '../colorContrast.js'
import { getHalftoneDataUrl } from '../effects/halftone.js'
import { rotatedBoxStyle } from '../rotationLayout.js'

const H_KEYWORD = { left: 'left', center: 'center', right: 'right' }
const V_KEYWORD = { top: 'top', middle: 'center', bottom: 'bottom' }
const JUSTIFY_BY_ALIGN_H = { left: 'flex-start', center: 'center', right: 'flex-end' }
const ITEMS_BY_ALIGN_V = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }
const PHOTO_ROLES = new Set(['image-hero', 'image-card', 'background'])
// Dither is approximated as treatment intensity (extra contrast/posterize
// push) rather than true per-pixel halftone stippling — a real dot-pattern
// dither needs pixel-level canvas processing, out of scope for a live CSS
// filter. Preserving color keeps the boost subtle; going duotone (Preserve
// Color off) lets it push harder since the image is already stylized.
const DITHER_CONTRAST_BOOST = {
  preserve: { Low: 1, Med: 1.1, High: 1.25 },
  duotone: { Low: 1, Med: 1.2, High: 1.5 },
}

// Photo elements (keynote/speaker images) get a real, live filter effect
// from their Details section — brightness/contrast map directly to CSS
// filter functions; Preserve Color off swaps in the shared brand duotone
// filter (see DuotoneFilter.jsx) instead of the original colors.
function photoFilter(placement) {
  const brightness = placement.brightness ?? 50
  const contrast = placement.contrast ?? 50
  const dither = placement.dither || 'Low'
  const preserveColor = placement.preserveColor ?? true
  const boost = (preserveColor ? DITHER_CONTRAST_BOOST.preserve : DITHER_CONTRAST_BOOST.duotone)[dither]
  const parts = [`brightness(${brightness / 100 + 0.5})`, `contrast(${(contrast / 100 + 0.5) * boost})`]
  if (!preserveColor) parts.push('url(#duotone-filter)')
  return parts.join(' ')
}

// Halftone bakes the effect into the pixels themselves (see effects/halftone.js),
// so it needs its own async load rather than a live CSS filter string. Falls
// back to the original image until the processed version is ready. The
// recompute is debounced so dragging the Brightness/Contrast/Tint sliders
// (which fire onChange continuously) doesn't re-run the per-pixel pass on
// every intermediate value — only once the drag settles.
const HALFTONE_DEBOUNCE_MS = 120

function useHalftoneImage(url, active, brightness, contrast, tintStrength) {
  const [processedUrl, setProcessedUrl] = useState(null)
  const timerRef = useRef(null)
  useEffect(() => {
    if (!active || !url) {
      setProcessedUrl(null)
      return
    }
    let cancelled = false
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      getHalftoneDataUrl(url, { brightness, contrast, tintStrength }).then((result) => {
        if (!cancelled) setProcessedUrl(result)
      })
    }, HALFTONE_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timerRef.current)
    }
  }, [url, active, brightness, contrast, tintStrength])
  return active ? processedUrl : null
}

// The image itself is never stretched off-ratio in any mode — only how much
// of the box it fills (and what gets cropped vs. left empty) changes.
function imageStyleForFillMode(fillMode, alignH, alignV, imageScale) {
  const objectPosition = `${H_KEYWORD[alignH]} ${V_KEYWORD[alignV]}`
  switch (fillMode) {
    case 'Fill Width':
      // Full box width, proportional height — may run past or short of the
      // box's height; alignV (via the wrapper's flex alignItems) decides
      // which edge it hugs when it's short.
      return { width: '100%', height: 'auto', display: 'block' }
    case 'Fill Height':
      return { width: 'auto', height: '100%', display: 'block' }
    case 'Original Ratio':
      // Contain-fit at 100% scale, then the user's manual zoom on top —
      // scaling out from the aligned anchor so it grows/shrinks toward
      // whichever edge/corner alignment picked.
      return {
        maxWidth: '100%',
        maxHeight: '100%',
        width: 'auto',
        height: 'auto',
        display: 'block',
        transform: `scale(${(imageScale ?? 100) / 100})`,
        transformOrigin: objectPosition,
      }
    case 'Fill Width/Height':
    default:
      // Figma's "Fill": scales to cover the whole box, cropping whichever
      // axis overflows — never stretches since object-fit: cover preserves
      // the image's own aspect ratio.
      return { width: '100%', height: '100%', objectFit: 'cover', objectPosition, display: 'block' }
  }
}

export default function ImageElement({ placement, grid, image, glyph, name, colors, canvasColor, selected, onPointerDown }) {
  const { role, fillMode, imageScale } = placement
  const alignH = placement.alignH || 'left'
  const alignV = placement.alignV || 'top'
  // The background image isn't a grid cell — it covers the whole canvas
  // (position: absolute, inset: 0) instead of participating in gridRow/
  // gridColumn placement, and never rotates (nothing to rotate around).
  const isBackground = role === 'background'
  const style = isBackground
    ? {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        justifyContent: JUSTIFY_BY_ALIGN_H[alignH],
        alignItems: ITEMS_BY_ALIGN_V[alignV],
      }
    : {
        ...rotatedBoxStyle(placement, grid),
        display: 'flex',
        justifyContent: JUSTIFY_BY_ALIGN_H[alignH],
        alignItems: ITEMS_BY_ALIGN_V[alignV],
      }
  const className = `canvas-element canvas-element--${role}${selected ? ' is-selected' : ''}`
  const hasImage = Boolean(image?.url)
  const isHalftone = PHOTO_ROLES.has(role) && (placement.halftone ?? true)
  const halftoneUrl = useHalftoneImage(
    image?.url, isHalftone,
    placement.brightness ?? 50, placement.contrast ?? 50, placement.tintStrength ?? 100,
  )
  const displayUrl = (isHalftone && halftoneUrl) || image?.url
  const imgStyle = imageStyleForFillMode(fillMode || 'Fill Width/Height', alignH, alignV, imageScale)
  if (PHOTO_ROLES.has(role) && !isHalftone) imgStyle.filter = photoFilter(placement)
  const { light, dark } = resolveTriad(colors)
  // Locked-asset SVGs (logo marks) are treated as monochrome icons, not
  // photos: they're masked (alpha channel only, ignoring whatever colors are
  // baked into the file) and tinted to whichever swatch reads against the
  // canvas, then held at a fixed smaller size instead of filling the box —
  // a wordmark shouldn't stretch to cover its placement like a photo does.
  const isLogoMark = placement.isAsset && hasImage && isSvgUrl(image.url)
  const canvasIsDark = relativeLuminance(canvasColor || '#ffffff') < 0.5
  // Barcodes read as barcodes because they're pure black/white, not a brand
  // color — default them to whichever of the two actually shows up against
  // the canvas, same as everything else, but skip the palette swatch.
  const isBarcode = /barcode/i.test(placement.name || '')
  const defaultMarkColor = isBarcode ? (canvasIsDark ? '#ffffff' : '#000000') : (canvasIsDark ? light : dark)
  const markColor = placement.colorOverride || defaultMarkColor

  return (
    <div className={className} style={style} onPointerDown={onPointerDown}>
      {hasImage && isLogoMark && (
        <span
          className="canvas-element__logo-mark"
          style={{
            WebkitMaskImage: `url("${image.url}")`,
            maskImage: `url("${image.url}")`,
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
            background: markColor,
            width: '55%',
            height: '55%',
          }}
          aria-hidden="true"
        />
      )}
      {hasImage && !isLogoMark && (
        <img
          src={displayUrl}
          alt=""
          className="canvas-element__image"
          draggable={false}
          style={imgStyle}
        />
      )}
      {!hasImage && (glyph || name) && (
        <span
          className={`canvas-element__glyph${glyph ? '' : ' canvas-element__glyph--text'}`}
          // A glyph (e.g. the tech@nyu "@" mark) is the logo itself and should
          // read as transparent, not a filled swatch; only the text-name
          // fallback (Barcode, Decor, etc.) needs a colored placeholder box.
          style={glyph ? { color: dark } : { background: light, color: dark }}
          aria-hidden="true"
        >
          {glyph || name}
        </span>
      )}
    </div>
  )
}
