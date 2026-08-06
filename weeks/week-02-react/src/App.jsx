import { DesignProvider } from './state/DesignContext.jsx'
import Canvas from './canvas/Canvas.jsx'
import ControlPanel from './components/ControlPanel/ControlPanel.jsx'
import ShuffleToast from './components/ShuffleToast.jsx'
import './App.css'

export default function App() {
  return (
    <DesignProvider>
      <main className="app">
        <Canvas />
        <ControlPanel />
        <ShuffleToast />
      </main>
    </DesignProvider>
  )
}
