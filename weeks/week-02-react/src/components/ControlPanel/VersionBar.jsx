import { Add, Save } from '@carbon/icons-react'
import { useDesignState } from '../../state/DesignContext.jsx'
import SelectRow from './SelectRow.jsx'

// Replaces the old dialkit toolbar (see ControlPanel.jsx's git history) —
// that panel's built-in version dropdown/+/Copy only ever operated on an
// empty parameter config, so clicking any of it did nothing meaningful.
// This wires the same visual idea (title, version picker, add, save) to the
// app's actual document state (DesignContext.jsx's versions/addVersion/
// switchVersion/saveVersion/renameVersion).
export default function VersionBar() {
  const { versions, activeVersionId, addVersion, switchVersion, saveVersion, renameVersion } = useDesignState()
  const active = versions.find((v) => v.id === activeVersionId) || versions[0]
  const idByName = Object.fromEntries(versions.map((v) => [v.name, v.id]))

  return (
    <div className="version-bar">
      <div className="version-bar__title">tech@nyu</div>
      <div className="version-bar__row">
        <button type="button" className="version-bar__icon-button" onClick={addVersion} aria-label="Add new version">
          <Add size={16} />
        </button>
        <SelectRow
          value={active.name}
          onChange={(name) => switchVersion(idByName[name])}
          onRename={(name) => renameVersion(activeVersionId, name)}
          options={versions.map((v) => v.name)}
          compact
        />
        <button type="button" className="version-bar__icon-button" onClick={saveVersion} aria-label="Save version">
          <Save size={16} />
        </button>
      </div>
    </div>
  )
}
