// Swiss/Müller-Brockmann style mode's vertical rhythm unit — every line-height
// becomes a whole multiple of this so stacked text always lands on the same
// horizontal rhythm, the way the discipline's baseline grid requires. Free
// mode has no such unit; this is only read when styleMode === 'Swiss'.
export const BASELINE_PX = 8

export function snapToBaseline(px, unit = BASELINE_PX) {
  return Math.max(unit, Math.round(px / unit) * unit)
}
