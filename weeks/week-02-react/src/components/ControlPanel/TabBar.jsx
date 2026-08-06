export default function TabBar({ tabs, active, onChange }) {
  return (
    <div className="control-panel__tabbar">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={`control-panel__tab${tab === active ? ' is-active' : ''}`}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}
