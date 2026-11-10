import { useRef, useState } from 'react'
import { BackIcon, CheckIcon, ListCheckIcon, ShareIcon, SparkleIcon } from './icons'
import { duration, paragraphs, when, wordCount } from '../lib/format'

const TABS = [
  { id: 'transcript', label: 'Transcript' },
  { id: 'summary', label: 'Summary' },
  { id: 'actions', label: 'Action items' },
]

export default function ResultScreen({ item, onBack, onShare, onPatch, onRecordAgain, generate: make, mocked }) {
  const [tab, setTab] = useState('transcript')
  const [busy, setBusy] = useState({ summary: false, actions: false })
  const [sharing, setSharing] = useState(false)
  const tabRefs = useRef({})
  const hasText = item.transcript.trim().length > 0

  const generate = async (kind) => {
    setTab(kind)
    const key = kind === 'summary' ? 'summary' : 'actionItems'
    if (item[key] || busy[kind] || !hasText) return
    setBusy((b) => ({ ...b, [kind]: true }))
    try {
      const data = kind === 'summary' ? await make('summary', item) : await make('actions', item)
      onPatch(item.id, { [key]: data })
    } finally {
      setBusy((b) => ({ ...b, [kind]: false }))
    }
  }

  const share = async () => {
    if (sharing) return
    setSharing(true)
    try { await onShare(item) } finally { setSharing(false) }
  }

  const onTabKey = (e) => {
    const i = TABS.findIndex((t) => t.id === tab)
    const next = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (TABS.length + i - 1) % TABS.length : null
    if (next === null) return
    e.preventDefault(); setTab(TABS[next].id); tabRefs.current[TABS[next].id]?.focus()
  }

  const tabIndex = TABS.findIndex((t) => t.id === tab)

  return (
    <section className="screen result">
      <div className="subhead">
        <button className="icon-btn" onClick={onBack} aria-label="Back"><BackIcon /></button>
        <div className="subhead-title">
          <h1>{item.title}</h1>
          <p>{when(item.createdAt)} · {duration(item.duration)}</p>
        </div>
        <button className="icon-btn" onClick={share} disabled={!hasText || sharing} aria-label="Share as PDF"><ShareIcon /></button>
      </div>

      <div className="tabs" role="tablist" aria-label="Result views" onKeyDown={onTabKey} style={{ '--i': tabIndex }}>
        <span className="tab-pill" />
        {TABS.map((t) => (
          <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1}
            ref={(el) => (tabRefs.current[t.id] = el)} onClick={() => setTab(t.id)}>
            {t.label}
            {((t.id === 'summary' && item.summary) || (t.id === 'actions' && item.actionItems)) && <i className="dot" />}
          </button>
        ))}
      </div>

      <div className="panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} key={tab}>
        {tab === 'transcript' && (
          hasText ? (
            <>
              {item.notice && <p className="notice">{item.notice}</p>}
              <p className="meta">{item.words ?? wordCount(item.transcript)} words</p>
              {paragraphs(item.transcript).map((p, i) => <p className="prose" key={i}>{p}</p>)}
            </>
          ) : (
            <div className="empty">
              <h2>No speech detected</h2>
              <p>We couldn't pick up anything in that recording. Check your microphone and try again.</p>
              <button className="btn" onClick={onRecordAgain}>Record again</button>
            </div>
          )
        )}

        {tab === 'summary' && (
          busy.summary ? <Skeleton /> : item.summary ? (
            <>
              <p className="prose lead">{item.summary.overview}</p>
              <ul className="bullets">{item.summary.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
              {mocked && <p className="foot">Preview summary, generated on-device with simple rules.</p>}
            </>
          ) : <Hint text="No summary yet. Tap Summarise below to create one." />
        )}

        {tab === 'actions' && (
          busy.actions ? <Skeleton /> : item.actionItems ? (
            item.actionItems.length ? (
              <>
                <ul className="todo">
                  {item.actionItems.map((a) => (
                    <li key={a.id}>
                      <button className={`check ${a.done ? 'on' : ''}`} role="checkbox" aria-checked={a.done} aria-label={a.text}
                        onClick={() => onPatch(item.id, { actionItems: item.actionItems.map((x) => (x.id === a.id ? { ...x, done: !x.done } : x)) })}>
                        {a.done && <CheckIcon width="14" height="14" />}
                      </button>
                      <span className={a.done ? 'done' : ''}>{a.text}</span>
                    </li>
                  ))}
                </ul>
                {mocked && <p className="foot">Preview action items, found with simple rules.</p>}
              </>
            ) : <Hint text="No clear action items were found in this recording." />
          ) : <Hint text="No action items yet. Tap Action items below to find them." />
        )}
      </div>

      <div className="actionbar">
        <button className="btn" onClick={() => generate('summary')} disabled={!hasText || busy.summary}>
          <SparkleIcon width="17" height="17" /> {item.summary ? 'View summary' : 'Summarise'}
        </button>
        <button className="btn" onClick={() => generate('actions')} disabled={!hasText || busy.actions}>
          <ListCheckIcon width="17" height="17" /> {item.actionItems ? 'View action items' : 'Action items'}
        </button>
      </div>
    </section>
  )
}

const Hint = ({ text }) => <p className="hint-block">{text}</p>
const Skeleton = () => (
  <div className="skeleton" aria-busy="true" aria-label="Generating">
    <i style={{ width: '92%' }} /><i style={{ width: '78%' }} /><i style={{ width: '86%' }} /><i style={{ width: '54%' }} />
  </div>
)
