import { MotionConfig } from 'motion/react'
import { DesignProvider } from './state/DesignContext.jsx'
import Canvas from './canvas/Canvas.jsx'
import ControlPanel from './components/ControlPanel/ControlPanel.jsx'
import ShuffleToast from './components/ShuffleToast.jsx'
import './App.css'

export default function App() {
  // reducedMotion="user" makes every `motion`-driven animation in the app
  // (tab pill, toast) automatically respect the OS's prefers-reduced-motion
  // setting — layout/transform motion collapses to instant, opacity-only
  // crossfades stay. Plain CSS transitions get the equivalent via the
  // global @media rule in index.css.
  return (
    <MotionConfig reducedMotion="user">
      <DesignProvider>
        <main className="app">
          <Canvas />
          <ControlPanel />
          <ShuffleToast />
        </main>
      </DesignProvider>
    </MotionConfig>
  )
}
