import Watch from './components/Watch/Watch.jsx'
import useAssistantFlow from './hooks/useAssistantFlow.js'
import './App.css'

export default function App() {
  const flow = useAssistantFlow()

  return (
    <main className="stage">
      <Watch flow={flow} />
    </main>
  )
}
