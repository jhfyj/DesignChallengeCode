// Mirrors the --motion-* custom properties in styles/tokens.css — duplicated
// here (not read from CSS) because the `motion` library's transition props
// need real JS numbers/arrays, not CSS custom-property strings. See
// tokens.css's own "Motion" section for why these particular values were
// chosen (LottieFiles motion-design-skill: Corporate/Premium archetype, MD3
// easing curves). Keep both files in sync by hand.
export const EASE_STANDARD = [0.2, 0, 0, 1]
export const EASE_ENTER = [0.05, 0.7, 0.1, 1]
export const EASE_EXIT = [0.3, 0, 1, 1]

export const DURATION_FAST = 0.15
export const DURATION_BASE = 0.18
export const DURATION_MODERATE = 0.25
