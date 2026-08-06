export default function GridOverlay({ cols, rows, visible }) {
  if (!visible) return null
  const cells = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(
        <div
          key={`${r}:${c}`}
          className="grid-overlay__cell"
          style={{ gridRow: r + 1, gridColumn: c + 1 }}
        />
      )
    }
  }
  return <>{cells}</>
}
