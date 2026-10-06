import { conversationFor } from './conversations.js'
import { entryAt, hash } from './entries.js'
import './Page.css'

// Backticks in message text become inline code.
function Text({ children }) {
  return children.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))
}

function Block({ block }) {
  if (block.user) {
    return (
      <div className="msg msg--user">
        <p>
          <Text>{block.user}</Text>
        </p>
      </div>
    )
  }

  if (block.agent) {
    return (
      <div className={`msg msg--agent${block.status ? ` is-${block.status}` : ''}`}>
        <p>
          <Text>{block.agent}</Text>
        </p>
        {block.bullets && (
          <ul>
            {block.bullets.map((b) => (
              <li key={b}>
                <Text>{b}</Text>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  if (block.tool) {
    return (
      <div className="tool" data-status={block.status ?? 'done'}>
        <span className="tool__name">{block.tool}</span>
        <span className="tool__target">{block.target}</span>
        <span className="tool__result">{block.result}</span>
      </div>
    )
  }

  if (block.diff) {
    const added = block.lines.filter(([s]) => s === '+').length
    const removed = block.lines.filter(([s]) => s === '-').length
    return (
      <figure className="code">
        <figcaption>
          <span>{block.diff}</span>
          <span className="code__stat">
            {added > 0 && <span className="is-add">+{added}</span>}
            {removed > 0 && <span className="is-del">−{removed}</span>}
          </span>
        </figcaption>
        <pre>
          {block.lines.map(([sign, text], i) => (
            <span key={i} className={`line${sign === '+' ? ' is-add' : sign === '-' ? ' is-del' : ''}`}>
              <span className="line__sign">{sign === ' ' ? '' : sign === '-' ? '−' : '+'}</span>
              {text || ' '}
            </span>
          ))}
        </pre>
      </figure>
    )
  }

  if (block.run) {
    return (
      <figure className={`code code--term${block.status ? ` is-${block.status}` : ''}`}>
        <figcaption>
          <span>$ {block.run}</span>
        </figcaption>
        <pre>{block.output}</pre>
      </figure>
    )
  }

  return null
}

// One task in the session, scrolled on its own. Links at either end point to
// the neighbouring tasks so it still reads as one continuous conversation.
export default function Page({ k, onGo, offset }) {
  const entry = entryAt(k)
  const older = entryAt(k + 1)
  const newer = k > 0 ? entryAt(k - 1) : null
  const blocks = conversationFor(k, entry, hash)

  return (
    <article
      className="page"
      aria-label={entry.title}
      aria-hidden={Math.abs(offset) > 1 || undefined}
      style={{ transform: `translateY(${offset}px)` }}
    >
      <div className="page__inner">
        <button type="button" className="seam seam--older" onClick={() => onGo(k + 1)}>
          <span className="seam__title">{older.title}</span>
        </button>

        <header className="page__head">
          <span className="page__dot" data-status={entry.status} />
          <div>
            <h1>{entry.title}</h1>
            <p className="page__meta">
              {k === 0 ? 'Latest task' : `${k} ${k === 1 ? 'task' : 'tasks'} back`} · {entry.time}
            </p>
          </div>
        </header>

        <div className="thread">
          {blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </div>

        {newer ? (
          <button type="button" className="seam seam--newer" onClick={() => onGo(k - 1)}>
            <span className="seam__title">{newer.title}</span>
          </button>
        ) : (
          <div className="composer" aria-hidden="true">
            <span>Ask the agent to do something…</span>
          </div>
        )}
      </div>
    </article>
  )
}
