import { useState } from 'react'
import { ChevronDown } from '@carbon/icons-react'

export default function Folder({ title, nested = false, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="content-folder">
      <button
        type="button"
        className={`folder-header${nested ? ' folder-header--nested' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <ChevronDown size={16} className={`folder-header__chevron${open ? ' is-open' : ''}`} />
      </button>
      {open && <div className="content-folder__body">{children}</div>}
    </div>
  )
}
