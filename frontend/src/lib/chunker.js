import { int16ToWav } from './wav.js'

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * The safety path. Cuts the sample stream into fixed-length chunks (chunk i always starts at
 * i * chunkSeconds on the recording timeline) and uploads each straight to S3 via presigned URLs.
 *
 * Nothing here touches the recorder: it only copies samples that are already flowing, so sealing
 * a chunk can never create a gap or affect the UI. Uploads retry forever (capped back-off) until the
 * session ends, and chunks sealed before the session exists simply wait in memory.
 */
export class ChunkUploader {
  constructor({ api, chunkSeconds = 30, rate = 16000, fetchImpl = (...a) => fetch(...a), sleep = defaultSleep, concurrency = 2, encode = null }) {
    // encode(samples, rate) -> Promise<{ blob, format }>. Default is WAV; cloudEngine passes an Opus encoder.
    Object.assign(this, { api, chunkSeconds, rate, fetchImpl, sleep, concurrency })
    this.encode = encode || (async (data, r) => ({ blob: new Blob([int16ToWav(data, r)], { type: 'audio/wav' }), format: 'wav' }))
    this.chunkSamples = chunkSeconds * rate
    this.buf = new Int16Array(this.chunkSamples)
    this.fill = 0
    this.index = 0
    this.queue = []
    this.active = 0
    this.sid = null
    this.closed = false
    this.waiters = []
  }

  setSession(id) {
    this.sid = id
    this.pump()
  }

  push(samples) {
    let off = 0
    while (off < samples.length) {
      const take = Math.min(this.chunkSamples - this.fill, samples.length - off)
      this.buf.set(samples.subarray(off, off + take), this.fill)
      this.fill += take
      off += take
      if (this.fill === this.chunkSamples) this.seal(this.buf)
    }
  }

  seal(data) {
    this.queue.push({ index: this.index++, data, attempts: 0 })
    this.buf = new Int16Array(this.chunkSamples)
    this.fill = 0
    this.pump()
  }

  /** Seal whatever is left (the final, shorter chunk). */
  sealPartial() {
    if (this.fill > 0) this.seal(this.buf.slice(0, this.fill))
  }

  pump() {
    if (!this.sid || this.closed) return
    while (this.active < this.concurrency) {
      const job = this.queue.find((j) => !j.busy)
      if (!job) break
      job.busy = true
      this.active++
      this.run(job).finally(() => {
        this.active--
        this.pump()
        this.notify()
      })
    }
  }

  async run(job) {
    while (!this.closed) {
      try {
        if (!job.out) {
          // encode once; if the compressor fails, this chunk goes up as plain WAV rather than not at all
          try { job.out = await this.encode(job.data, this.rate) } catch { job.out = { blob: new Blob([int16ToWav(job.data, this.rate)], { type: 'audio/wav' }), format: 'wav' } }
        }
        const info = await this.api.chunkUrl(this.sid, job.index, job.out.format) // fresh URL each attempt: they expire
        const res = await this.fetchImpl(info.url, { method: 'PUT', headers: info.headers, body: job.out.blob })
        if (!res.ok) throw new Error(`upload ${res.status}`)
        this.queue = this.queue.filter((j) => j !== job)
        return
      } catch {
        job.attempts++
        await this.sleep(Math.min(30000, 1000 * 2 ** Math.min(job.attempts - 1, 5)))
      }
    }
  }

  get pending() {
    return this.queue.length
  }

  notify() {
    if (this.queue.length === 0) this.waiters.splice(0).forEach((w) => w(true))
  }

  /** Wait until every sealed chunk is uploaded, or the timeout passes. Resolves true if all uploaded. */
  drain(timeoutMs) {
    if (this.queue.length === 0) return Promise.resolve(true)
    return new Promise((resolve) => {
      this.waiters.push(resolve)
      setTimeout(() => resolve(this.queue.length === 0), timeoutMs)
    })
  }

  close() {
    this.closed = true
    this.waiters.splice(0).forEach((w) => w(this.queue.length === 0))
  }
}
