import test from 'node:test'
import assert from 'node:assert/strict'
import { ChunkUploader } from '../src/lib/chunker.js'

const mk = (over = {}) => {
  const puts = []
  const api = { chunkUrl: async (sid, index) => ({ url: `https://s3/${sid}/${index}`, headers: { 'Content-Type': 'audio/wav' } }) }
  const fetchImpl = async (url, init) => { puts.push({ url, size: init.body.size }); return { ok: true } }
  const u = new ChunkUploader({ api, chunkSeconds: 2, fetchImpl, sleep: async () => {}, ...over })
  return { u, puts }
}
const samples = (n) => new Int16Array(n)

test('cuts exact chunks regardless of how frames arrive, and uploads each once', async () => {
  const { u, puts } = mk()
  u.setSession('S')
  for (let i = 0; i < 25; i++) u.push(samples(1600)) // 25 x 100 ms = 2.5 s: one full 2 s chunk + 0.5 s left over
  u.sealPartial()
  assert.equal(await u.drain(1000), true)
  const bySize = Object.fromEntries(puts.map((p) => [p.url.split('/').pop(), p.size]))
  assert.deepEqual(bySize, { 0: 44 + 32000 * 2, 1: 44 + 8000 * 2 }) // chunk 0 = 2 s, chunk 1 = 0.5 s
  assert.equal(u.pending, 0)
})

test('frames that straddle a chunk boundary are split correctly', async () => {
  const { u, puts } = mk()
  u.setSession('S')
  u.push(samples(31000)); u.push(samples(5000)) // 36000 samples: chunk 0 (32000) + 4000 in chunk 1
  u.sealPartial()
  await u.drain(1000)
  assert.equal(puts.length, 2)
})

test('chunks sealed before the session exists wait, then upload in order', async () => {
  const { u, puts } = mk()
  u.push(samples(64000)) // two full chunks, no session yet
  assert.equal(puts.length, 0)
  u.setSession('S')
  await u.drain(1000)
  assert.deepEqual(puts.map((p) => p.url.split('/').pop()).sort(), ['0', '1'])
})

test('failed uploads retry until they succeed; drain times out honestly while failing', async () => {
  let fails = 3
  const puts = []
  const api = { chunkUrl: async (sid, i) => ({ url: `u/${i}`, headers: {} }) }
  const fetchImpl = async (url) => { if (fails-- > 0) return { ok: false, status: 503 }; puts.push(url); return { ok: true } }
  const u = new ChunkUploader({ api, chunkSeconds: 2, fetchImpl, sleep: async () => {} })
  u.setSession('S'); u.push(samples(32000))
  assert.equal(await u.drain(2000), true)
  assert.deepEqual(puts, ['u/0'])

  const dead = new ChunkUploader({ api, chunkSeconds: 2, fetchImpl: async () => ({ ok: false }), sleep: (ms) => new Promise((r) => setTimeout(r, 5)) })
  dead.setSession('S'); dead.push(samples(32000))
  assert.equal(await dead.drain(60), false)
  assert.equal(dead.pending, 1)
  dead.close()
})
