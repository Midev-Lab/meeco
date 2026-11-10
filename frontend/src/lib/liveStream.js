// The fast path: audio goes straight to AssemblyAI over a WebSocket (a short-lived token comes from our API).
//
// Time bookkeeping: AssemblyAI timestamps every word in ms from the start of THAT session. After a
// reconnect a new session starts at 0, so each session remembers `startMs`, the position on the global
// recording timeline of the first frame it received, and all times are offset by it.
//
// The ledger: `owned` intervals are the stretches this stream is responsible for. A clean session owns
// everything it was sent. A session that dropped owns only up to its last FINAL word (in-flight speech is
// lost), and the server fills the rest from the S3 chunks.

const REPLAY_MS = 5000 // on (re)connect, replay at most this much recent audio; older audio is left to the S3 repair
const KEEP_MS = 8000
const sleepDefault = (ms) => new Promise((r) => setTimeout(r, ms))

export class LiveStream {
  constructor({ refreshConfig, WebSocketImpl = globalThis.WebSocket, retryDelays = [500, 1500, 3500, 8000], repeatDelay = 15000, connectTimeout = 8000, onStatus = () => {}, onTurns = () => {}, sleep = sleepDefault }) {
    Object.assign(this, { refreshConfig, WS: WebSocketImpl, retryDelays, repeatDelay, connectTimeout, onStatus, onTurns, sleep })
    this.cfg = null
    this.sessions = []
    this.cur = null
    this.pending = []
    this.lastFrameEnd = 0
    this.stopping = false
    this.reconnecting = false
  }

  setConfig(cfg) {
    this.cfg = cfg
    if (!this.cur && !this.stopping) this.open()
  }

  /** Called for every 100 ms frame, in order. startMs = position of the frame on the recording timeline. */
  push(startMs, data) {
    this.lastFrameEnd = startMs + data.length / 16
    const s = this.cur
    if (s && s.began && s.ws.readyState === 1) {
      this.send(s, { startMs, data })
      return
    }
    this.pending.push({ startMs, data })
    while (this.pending.length && this.lastFrameEnd - this.pending[0].startMs > KEEP_MS) this.pending.shift()
  }

  send(s, f) {
    if (s.startMs === null) s.startMs = f.startMs
    s.ws.send(f.data)
    s.lastSentEnd = f.startMs + f.data.length / 16
  }

  open() {
    const cfg = this.cfg
    if (!cfg) return null
    const url = `${cfg.url}?${new URLSearchParams({ ...cfg.params, token: cfg.token })}`
    const ws = new this.WS(url)
    ws.binaryType = 'arraybuffer'
    const s = { ws, began: false, startMs: null, lastSentEnd: null, lastFinalEnd: null, turns: new Map(), clean: false, ended: false, byUs: false }
    s.ready = new Promise((resolve) => { s.resolveReady = resolve })
    this.sessions.push(s)
    this.cur = s
    this.onStatus('connecting')
    ws.onmessage = (e) => this.message(s, e)
    ws.onclose = () => this.closed(s)
    ws.onerror = () => {} // a close event always follows
    return s
  }

  message(s, e) {
    if (typeof e.data !== 'string') return
    let m
    try { m = JSON.parse(e.data) } catch { return }
    if (m.type === 'Begin') {
      s.began = true
      this.onStatus('live')
      s.resolveReady(true)
      const cut = this.lastFrameEnd - REPLAY_MS
      const frames = this.pending.filter((f) => f.startMs >= cut)
      this.pending = []
      for (const f of frames) this.send(s, f)
    } else if (m.type === 'Turn') {
      s.turns.set(m.turn_order, m)
      const words = m.words || []
      if (m.end_of_turn && words.length && s.startMs !== null) s.lastFinalEnd = s.startMs + words[words.length - 1].end
      this.onTurns()
    } else if (m.type === 'Termination') {
      s.clean = true
      s.onDone?.()
    }
  }

  closed(s) {
    s.ended = true
    s.resolveReady(false)
    s.onDone?.()
    if (s.byUs || s.clean || this.stopping) return
    if (this.cur === s) this.cur = null
    this.onStatus('reconnecting')
    this.reconnect()
  }

  async reconnect() {
    if (this.reconnecting) return
    this.reconnecting = true
    try {
      for (let i = 0; !this.stopping; i++) {
        await this.sleep(i < this.retryDelays.length ? this.retryDelays[i] : this.repeatDelay)
        if (this.stopping) break
        try { this.cfg = await this.refreshConfig() } catch { continue }
        const s = this.open()
        let timer
        const ok = await Promise.race([s.ready, new Promise((r) => { timer = setTimeout(() => r(false), this.connectTimeout) })])
        clearTimeout(timer)
        if (ok) return
        if (!s.ended) { s.byUs = true; try { s.ws.close() } catch { /* already closed */ } }
        if (this.cur === s) this.cur = null
      }
    } finally {
      this.reconnecting = false
    }
  }

  /** Ask AssemblyAI to flush and wait for the last transcript. Keeps the connection open until Termination. */
  async stop(timeoutMs = 6000) {
    this.stopping = true
    const s = this.cur
    if (!s) return
    if (s.began && s.ws.readyState === 1) {
      const done = new Promise((res) => { s.onDone = res })
      s.ws.send(JSON.stringify({ type: 'Terminate' }))
      await Promise.race([done, this.sleep(timeoutMs)])
    }
    s.byUs = true
    try { s.ws.close() } catch { /* already closed */ }
  }

  /** What the server needs: the stretches we own and the final turns, all on the global timeline. */
  snapshot() {
    const owned = []
    const turns = []
    for (const s of this.sessions) {
      if (s.startMs === null) continue
      const end = s.clean ? s.lastSentEnd : s.lastFinalEnd
      if (end !== null && end > s.startMs) owned.push([Math.round(s.startMs), Math.round(end)])
      for (const m of [...s.turns.values()].sort((a, b) => a.turn_order - b.turn_order)) {
        const w = m.words || []
        if (!m.end_of_turn || !w.length || !String(m.transcript || '').trim()) continue
        turns.push({ start_ms: Math.round(s.startMs + w[0].start), end_ms: Math.round(s.startMs + w[w.length - 1].end), text: m.transcript.trim() })
      }
    }
    turns.sort((a, b) => a.start_ms - b.start_ms)
    return { owned, turns }
  }
}
