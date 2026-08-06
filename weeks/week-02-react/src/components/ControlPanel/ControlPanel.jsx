import { DialRoot, useDialKit } from 'dialkit'
import { Shuffle } from '@carbon/icons-react'
import { useDesignState } from '../../state/DesignContext.jsx'
import TabBar from './TabBar.jsx'
import SelectRow from './SelectRow.jsx'
import ActionButton from './ActionButton.jsx'
import DesignPanel from './panels/DesignPanel.jsx'
import ContentPanel from './panels/ContentPanel.jsx'
import AssetsPanel from './panels/AssetsPanel.jsx'
import SelectedElementPanel from './panels/SelectedElementPanel.jsx'
import './ControlPanel.css'
import './fields.css'

const TABS = ['Design', 'Content', 'Assets']
const PAGE_SIZE_OPTIONS = ['Instagram Square (1x1)', 'Instagram Story (9:16)', 'Banner', 'Custom']

export default function ControlPanel() {
  const { activeTab, setActiveTab, pageSize, setPageSize, inspectorOpen, shuffle, styleMode, setStyleMode } = useDesignState()

  // Empty config: we only want dialkit's native title + Version/Copy toolbar
  // chrome here. Every visible control below it is custom-built so we have
  // full layout control (dialkit can't interleave custom JSX between its own
  // folders, and the Figma spec needs Shuffle/Page Size/Tabs positioned
  // between the native toolbar and the tab content).
  useDialKit('tech@nyu', {})

  if (inspectorOpen) {
    return (
      <aside className="control-panel">
        <div className="control-panel__body">
          <SelectedElementPanel />
        </div>
      </aside>
    )
  }

  return (
    <aside className="control-panel">
      <div className="control-panel__body">
        <div className="control-panel__native">
          <DialRoot mode="inline" theme="dark" />
        </div>
        <SelectRow value={pageSize} onChange={setPageSize} options={PAGE_SIZE_OPTIONS} />
        <div className="control-panel__shuffle-row">
          <ActionButton icon={Shuffle} label="Shuffle" accent onClick={shuffle} />
          <SelectRow value={styleMode} onChange={setStyleMode} options={['Free', 'Swiss']} compact />
        </div>
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
        {activeTab === 'Design' && <DesignPanel />}
        {activeTab === 'Content' && <ContentPanel />}
        {activeTab === 'Assets' && <AssetsPanel />}
      </div>
    </aside>
  )
}
