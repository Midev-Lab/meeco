import { useEffect, useRef, useState } from 'react'
import { BackIcon, TrashIcon } from './icons'
import { duration, when } from '../lib/format'

export default function HistoryScreen({ items, onBack, onOpen, onDelete, onClear }) {
  const [armed, setArmed] = useState(null) // id being confirmed, or 'all'
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])

  // Two-tap confirm: native confirm() is blocked in sandboxed frames and looks out of place.
  const confirm = (key, run) => {
    if (armed === key) { clearTimeout(timer.current); setArmed(null); run(); return }
    setArmed(key); clearTimeout(timer.current); timer.current = setTimeout(() => setArmed(null), 3000)
  }

  return (
    <section className="screen sheet">
      <div className="subhead">
        <button className="icon-btn" onClick={onBack} aria-label="Back"><BackIcon /></button>
        <div className="subhead-title"><h1>History</h1><p>{items.length} {items.length === 1 ? 'recording' : 'recordings'}</p></div>
        {items.length > 0
          ? <button className={`text-btn ${armed === 'all' ? 'warn' : ''}`} onClick={() => confirm('all', onClear)}>{armed === 'all' ? 'Confirm?' : 'Clear'}</button>
          : <span className="icon-btn ghost" />}
      </div>

      {items.length === 0 ? (
        <div className="empty center">
          <h2>Nothing here yet</h2>
          <p>Your recordings and transcripts will show up here.</p>
        </div>
      ) : (
        <ul className="list">
          {items.map((it) => (
            <li key={it.id}>
              <button className="row" onClick={() => onOpen(it.id)}>
                <strong>{it.title}</strong>
                <span className="row-meta">{when(it.createdAt)} · {duration(it.duration)}{it.summary ? ' · Summary' : ''}{it.actionItems ? ' · Actions' : ''}</span>
                <span className="row-excerpt">{(it.transcript ?? it.excerpt) || 'No speech detected'}</span>
              </button>
              <button className={`del ${armed === it.id ? 'warn' : ''}`} onClick={() => confirm(it.id, () => onDelete(it.id))} aria-label={armed === it.id ? 'Tap again to delete' : `Delete ${it.title}`}>
                {armed === it.id ? <span>Delete?</span> : <TrashIcon width="18" height="18" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
