export function foamMaskStyle(mask) {
  if (!mask) return undefined
  if (!mask.paths.length) {
    return {
      WebkitMaskImage: 'linear-gradient(transparent, transparent)',
      maskImage: 'linear-gradient(transparent, transparent)',
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${mask.viewBox}">${mask.paths
    .map((d) => `<path d="${d}" fill="white"/>`)
    .join('')}</svg>`
  const image = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
  return {
    WebkitMaskImage: image,
    maskImage: image,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskSize: `${mask.width}px ${mask.height}px`,
    maskSize: `${mask.width}px ${mask.height}px`,
    WebkitMaskPosition: `right ${-mask.cut}px bottom ${-mask.cut}px`,
    maskPosition: `right ${-mask.cut}px bottom ${-mask.cut}px`,
  }
}
