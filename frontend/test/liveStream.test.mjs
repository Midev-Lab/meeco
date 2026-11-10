import test from 'node:test'
import assert from 'node:assert/strict'
import { LiveStream } from '../src/lib/liveStream.js'
import { FakeWS, cfg, frame, tick, turn } from './helpers.mjs'

const make = (over = {}) => {
  FakeWS.all = []
  let n = 1
  const ls = new LiveStream({ refreshConfig: async () => cfg(++n), WebSocketImpl: FakeWS, sleep: async () => {}, retryDelays: [0, 0], repeatDelay: 0, ...over })
  return ls
}
// feed n frames of 100 ms starting at startMs
const feed = (ls, startMs, n) => { for (let i = 0; i < n; i++) ls.push(startMs + i * 100, frame(100)) }

test('happy path: buffers until Begin, replays, then streams; clean stop owns the whole range', async () => {
  const ls = make()
  feed(ls, 0, 3)                              // audio arrives before the socket is ready
  ls.setConfig(cfg())
  const ws = FakeWS.all[0]
  assert.match(ws.url, /token=tok1/); assert.match(ws.url, /sample_rate=16000/)
  assert.equal(ws.audio.length, 0)            // nothing sent before Begin
  ws.say({ type: 'Begin', id: 'x', expires_at: 1 })
  assert.equal(ws.audio.length, 3)            // the 300 ms we buffered was replayed
  feed(ls, 300, 7)
  ws.say(turn(0, [['hello', 120, 480], ['world', 520, 900]]))
  const stopping = ls.stop()
  assert.deepEqual(ws.texts, [{ type: 'Terminate' }])
  ws.say(turn(1, [['bye', 950, 1000]]))       // flushed by the server after Terminate
  ws.say({ type: 'Termination', audio_duration_seconds: 1, session_duration_seconds: 1 })
  await stopping
  const snap = ls.snapshot()
  assert.deepEqual(snap.owned, [[0, 1000]])
  assert.deepEqual(snap.turns.map((t) => [t.start_ms, t.end_ms, t.text]), [[120, 900, 'hello world'], [950, 1000, 'bye']])
})

test('partial turns never become transcript; formatted final replaces unformatted final', async () => {
  const ls = make(); ls.setConfig(cfg()); const ws = FakeWS.all[0]; ws.say({ type: 'Begin' }); feed(ls, 0, 10)
  ws.say(turn(0, [['hel', 0, 100]], false))
  ws.say(turn(0, [['hello', 0, 300]], true, 'hello'))
  ws.say(turn(0, [['Hello', 0, 300]], true, 'Hello.'))
  const p = ls.stop(); ws.say({ type: 'Termination' }); await p
  assert.deepEqual(ls.snapshot().turns.map((t) => t.text), ['Hello.'])
})

test('drop: owned range stops at the last FINAL word; reconnect session is offset onto the global timeline', async () => {
  const ls = make()
  ls.setConfig(cfg()); const a = FakeWS.all[0]; a.say({ type: 'Begin' })
  feed(ls, 0, 40)                             // 4 s of audio
  a.say(turn(0, [['alpha', 200, 900]]))       // final, ends at 0.9 s
  a.say(turn(1, [['beta', 2000, 2600]], false)) // still in flight when the line dies
  a.dropAbruptly()
  await tick()
  assert.equal(FakeWS.all.length, 2)          // reconnected with a fresh token
  assert.match(FakeWS.all[1].url, /token=tok2/)
  feed(ls, 4000, 20)                          // audio keeps flowing during the reconnect
  const b = FakeWS.all[1]
  b.say({ type: 'Begin' })
  assert.equal(b.audio.length, 20)            // only the recent audio is replayed
  feed(ls, 6000, 10)
  b.say(turn(0, [['gamma', 100, 700]]))       // session-relative: 0.1 s after ITS first frame (global 4.0 s)
  const p = ls.stop(); b.say({ type: 'Termination' }); await p
  const snap = ls.snapshot()
  assert.deepEqual(snap.owned, [[0, 900], [4000, 7000]])   // 0.9 s .. 4.0 s is a gap for the S3 repair to fill
  assert.deepEqual(snap.turns.map((t) => [t.start_ms, t.text]), [[200, 'alpha'], [4100, 'gamma']])
})

test('only the last REPLAY window is replayed; older buffered audio is left to the S3 repair', async () => {
  const ls = make()
  feed(ls, 0, 80)                             // 8 s buffered with no socket (cold start)
  ls.setConfig(cfg()); const ws = FakeWS.all[0]; ws.say({ type: 'Begin' })
  assert.equal(ws.audio.length, 50)           // exactly the last 5 s, not all 8 s: no 1.25x backlog
  const p = ls.stop(); ws.say({ type: 'Termination' }); await p
  assert.ok(ls.snapshot().owned[0][0] >= 2900)
})

test('server keeps refusing: owns nothing, so the whole recording becomes one repair job', async () => {
  let calls = 0
  const ls = make({ refreshConfig: async () => { if (++calls > 2) throw new Error('offline'); return cfg(calls + 1) } })
  ls.setConfig(cfg()); const a = FakeWS.all[0]; a.say({ type: 'Begin' }); feed(ls, 0, 5)
  a.dropAbruptly()
  await tick(); feed(ls, 500, 5)
  for (const ws of FakeWS.all.slice(1)) ws.dropAbruptly()
  await ls.stop(10)
  const snap = ls.snapshot()
  assert.deepEqual(snap.turns, [])
  assert.ok(snap.owned.length === 0 || snap.owned[0][1] <= 500)
})
