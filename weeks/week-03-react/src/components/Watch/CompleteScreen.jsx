import { CheckmarkFilled } from '@carbon/icons-react'
import './CompleteScreen.css'

// Deliberately no gradient/glass/ring here — those belong to the in-progress
// look. Cutting from a fully-swept black ring straight to that same colored
// branding read as a jump backwards, so this is just a flat white beat
// instead: black check, "Completed", nothing else animating.
export default function CompleteScreen({ visible }) {
  return (
    <div className={`complete-screen${visible ? ' complete-screen--visible' : ''}`}>
      <div className="complete-screen__content">
        <CheckmarkFilled size={32} className="complete-screen__icon" />
        <p className="complete-screen__label">Completed</p>
      </div>
    </div>
  )
}
