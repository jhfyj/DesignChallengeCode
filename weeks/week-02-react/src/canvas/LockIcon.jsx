// Shared padlock glyph — used by SelectionOverlay.jsx (element lock) and
// CustomGridOverlay.jsx (grid line lock) so both draw the exact same icon
// instead of maintaining two copies.
export default function LockIcon({ locked }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" fill="currentColor" />
      {locked ? (
        <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M8 11V7a4 4 0 0 1 7.4-2.2" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      )}
    </svg>
  )
}
