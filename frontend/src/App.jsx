import { useCallback, useEffect, useRef, useState } from 'react'
import Header from './components/Header'
import HomeScreen from './components/HomeScreen'
import ProcessingScreen from './components/ProcessingScreen'
import ResultScreen from './components/ResultScreen'
import HistoryScreen from './components/HistoryScreen'
import ProfileScreen from './components/ProfileScreen'
import { useRecorder } from './hooks/useRecorder'
import { usePlayer } from './hooks/usePlayer'
import { loadHistory, loadProfile, saveHistory, saveProfile } from './lib/storage'
import { makeTitle, uid } from './lib/format'
import { sharePdf } from './lib/pdf'
import { CLOUD } from './lib/config'
import { getActionItems, MOCKED, summarise } from './lib/mockActions'
import { api } from './lib/cloud'

// Server rows -> the item shape the screens use.
const fromRemote = (r) => ({
  id: r.id, createdAt: r.created_at, duration: (r.duration_ms || 0) / 1000, title: r.title || 'Untitled recording',
  excerpt: r.excerpt, words: r.words, source: 'cloud',
  ...(r.transcript !== undefined ? { transcript: r.transcript, summary: r.summary ?? null, actionItems: r.action_items ?? null } : {}),
})

export default function App() {
  const [screen, setScreen] = useState('home') // home | processing | result | history | profile
  const [menuOpen, setMenuOpen] = useState(false)
  const [history, setHistory] = useState(loadHistory)
  const [profile, setProfile] = useState(loadProfile)
  const [current, setCurrent] = useState(null) // the item on the result screen (may be unsaved)
  const [from, setFrom] = useState('home') // where Back on the result screen returns to
  const [progress, setProgress] = useState(0)
  const [toast, setToast] = useState({ msg: '', show: false })
  const rec = useRecorder()
  const player = usePlayer()
  const job = useRef(null)
  const toastTimer = useRef()

  useEffect(() => saveHistory(history), [history])
  useEffect(() => saveProfile(profile), [profile])

  // Cloud: history lives on the server. Wake the backend (free hosts sleep) and load the list.
  useEffect(() => {
    if (!CLOUD) return
    const warm = () => document.visibilityState === 'visible' && api.health().catch(() => {})
    warm()
    const keep = setInterval(warm, 4 * 60 * 1000) // free hosts sleep after 15 min idle; the app keeps its own backend awake while open
    api.list().then((r) => setHistory(r.items.map(fromRemote))).catch(() => {})
    return () => clearInterval(keep)
  }, [])

  // The 2h30m cap: stop for the user, as if they pressed the button.
  useEffect(() => { if (rec.limit) stop() }, [rec.limit]) // eslint-disable-line react-hooks/exhaustive-deps

  const say = useCallback((msg) => {
    setToast({ msg, show: true }); clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 2600)
  }, [])

  const start = async () => {
    player.stop()
    await rec.start()
  }

  const stop = async () => {
    const out = await rec.stop()
    if (!out) return
    if (out.duration < 1) { out.abort(); say('Too short. Hold on a little longer.'); return }

    player.load(out.blob)
    setProgress(0); setScreen('processing')
    const ac = new AbortController()
    job.current = { ac, out }
    try {
      const res = await out.finish({ signal: ac.signal, onProgress: setProgress })
      const now = Date.now()
      const remote = res.remote
      const item = {
        id: remote?.id || uid(), createdAt: remote?.created_at || now, duration: remote ? remote.duration_ms / 1000 : out.duration, transcript: res.text,
        source: res.source, notice: res.notice, summary: null, actionItems: null,
        title: remote?.title || makeTitle(res.text, now),
      }
      if (res.text) setHistory((h) => [item, ...h]) // empty recordings aren't worth keeping
      setCurrent(item); setScreen('result')
    } catch (e) {
      setScreen('home')
      if (e.name !== 'AbortError') say('Something went wrong while processing.')
    } finally {
      job.current = null
    }
  }

  const cancelProcessing = () => { job.current?.out.abort(); job.current?.ac.abort() }

  const generate = async (kind, item) => {
    if (!CLOUD) return kind === 'summary' ? summarise(item.transcript) : getActionItems(item.transcript)
    return kind === 'summary' ? api.summary(item.id) : (await api.actionItems(item.id)).items
  }

  const patch = useCallback((id, changes) => {
    if (CLOUD && changes.actionItems) api.putActionItems(id, changes.actionItems).catch(() => {}) // keep ticks in sync
    setCurrent((c) => (c && c.id === id ? { ...c, ...changes } : c))
    setHistory((h) => h.map((x) => (x.id === id ? { ...x, ...changes } : x)))
  }, [])

  const share = async (item) => {
    const r = await sharePdf(item)
    if (r === 'shared') say('Shared')
    else if (r === 'downloaded') say('PDF saved to your device')
  }

  const go = (to) => { setMenuOpen(false); player.stop(); setScreen(to) }
  const openItem = async (id) => {
    let it = history.find((h) => h.id === id)
    if (!it) return
    if (it.transcript === undefined) { // a server row: fetch the full transcript on demand
      try { it = fromRemote(await api.get(id)); setHistory((h) => h.map((x) => (x.id === id ? it : x))) } catch { return say('Could not open that recording.') }
    }
    setCurrent(it); setFrom('history'); setScreen('result')
  }
  const removeItem = (id) => { setHistory((h) => h.filter((x) => x.id !== id)); if (CLOUD) api.remove(id).catch(() => {}) }
  const clearAll = () => { if (CLOUD) history.forEach((h) => api.remove(h.id).catch(() => {})); setHistory([]) }
  const leaveResult = () => { setCurrent(null); setScreen(from); setFrom('home') }

  const showHeader = screen === 'home' || screen === 'processing'
  const busy = rec.status === 'recording' || rec.status === 'starting'

  return (
    <main className="stage-bg">
      <div className="phone">
        {showHeader && (
          <Header
            open={menuOpen}
            onToggle={() => setMenuOpen((o) => !o)}
            onClose={() => setMenuOpen(false)}
            onNavigate={(to) => !busy && screen === 'home' ? go(to) : (setMenuOpen(false), say(busy ? 'Finish recording first' : 'Wait for processing to finish'))}
            historyCount={history.length}
          />
        )}

        {screen === 'home' && <HomeScreen rec={rec} player={player} onStart={start} onStop={stop} />}
        {screen === 'processing' && <ProcessingScreen progress={progress} onCancel={cancelProcessing} />}
        {screen === 'result' && current && (
          <ResultScreen key={current.id} item={current} onBack={leaveResult} onShare={share} onPatch={patch} generate={generate} mocked={!CLOUD && MOCKED} onRecordAgain={() => { setCurrent(null); setFrom('home'); setScreen('home') }} />
        )}
        {screen === 'history' && (
          <HistoryScreen items={history} onBack={() => setScreen('home')} onOpen={openItem}
            onDelete={removeItem} onClear={clearAll} />
        )}
        {screen === 'profile' && (
          <ProfileScreen profile={profile} history={history} onBack={() => setScreen('home')} onChange={(c) => setProfile((p) => ({ ...p, ...c }))} />
        )}

        <div className={`toast ${toast.show ? 'show' : ''}`} role="status" aria-live="polite">{toast.msg}</div>
      </div>
    </main>
  )
}
