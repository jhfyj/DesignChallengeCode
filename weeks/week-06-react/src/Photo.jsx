// A photo cut to the same window the dot grid samples: the crop slice is
// stretched to fill the box, just as sampleImage fits it to the grid, so the
// photo lines up dot for dot with the tile it sits over.
export default function Photo({ src, crop = [0, 1], cropX = [0, 1], className = 'photo', alt = '' }) {
  const w = cropX[1] - cropX[0]
  const h = crop[1] - crop[0]
  return (
    <div className={className}>
      <img
        src={src}
        alt={alt}
        draggable="false"
        style={{
          width: `${100 / w}%`,
          height: `${100 / h}%`,
          left: `${(-cropX[0] / w) * 100}%`,
          top: `${(-crop[0] / h) * 100}%`,
        }}
      />
    </div>
  )
}
