import { useCallback, useState } from 'react'
import Desktop from './Desktop'
import FoamPocket from './FoamPocket'
import Headline from './Headline'
import './App.css'

export default function App() {
  const [phase, setPhase] = useState('idle')
  const [liftPlan, setLiftPlan] = useState(null)
  const [typeMask, setTypeMask] = useState(null)

  const onLiftPlan = useCallback((plan) => {
    setLiftPlan(plan)
  }, [])

  return (
    <main className={`page is-${phase}`}>
      <Desktop liftPlan={liftPlan} mask={typeMask} />
      <Headline mask={typeMask} />
      <FoamPocket
        phase={phase}
        onPhaseChange={setPhase}
        onLiftPlan={onLiftPlan}
        onTypeMask={setTypeMask}
      />
    </main>
  )
}
