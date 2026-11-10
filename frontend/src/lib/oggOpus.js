// Compresses the safety-path chunks. 16 kHz mono speech at 24 kbps Opus is ~3 KB/s instead of 32 KB/s for WAV,
// about 10x less to upload, and AssemblyAI's batch API reads Ogg Opus directly.
//
// Two halves: a pure Ogg muxer (testable anywhere) and a thin WebCodecs wrapper (browser only).

const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let r = i << 24
    for (let k = 0; k < 8; k++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1
    t[i] = r >>> 0
  }
  return t
})()
const crc32 = (bytes) => {
  let c = 0
  for (let i = 0; i < bytes.length; i++) c = ((c << 8) ^ crcTable[((c >>> 24) ^ bytes[i]) & 255]) >>> 0
  return c
}

/** One Ogg page holding whole packets (each packet is laced into 255-byte segments). */
function page({ packets, granule, serial, seq, flags }) {
  const segs = []
  for (const p of packets) {
    let n = p.length
    while (n >= 255) { segs.push(255); n -= 255 }
    segs.push(n) // a packet that is an exact multiple of 255 ends with a 0-length segment
  }
  if (segs.length > 255) throw new Error('too many segments for one page')
  const body = packets.reduce((a, p) => a + p.length, 0)
  const out = new Uint8Array(27 + segs.length + body)
  const v = new DataView(out.buffer)
  out.set([0x4f, 0x67, 0x67, 0x53, 0, flags]) // "OggS", version 0
  v.setBigInt64(6, BigInt(granule), true)
  v.setUint32(14, serial, true)
  v.setUint32(18, seq, true)
  out[26] = segs.length
  out.set(segs, 27)
  let o = 27 + segs.length
  for (const p of packets) { out.set(p, o); o += p.length }
  v.setUint32(22, crc32(out), true) // CRC field was zero while hashing
  return out
}

const ascii = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0))
export function opusHead(preSkip, inputRate) {
  const h = new Uint8Array(19)
  h.set(ascii('OpusHead')); h[8] = 1; h[9] = 1
  const v = new DataView(h.buffer)
  v.setUint16(10, preSkip, true); v.setUint32(12, inputRate, true) // gain 0, mapping family 0
  return h
}
const opusTags = () => {
  const vendor = ascii('meeco')
  const t = new Uint8Array(8 + 4 + vendor.length + 4)
  t.set(ascii('OpusTags')); new DataView(t.buffer).setUint32(8, vendor.length, true); t.set(vendor, 12)
  return t
}

/**
 * packets: Opus packets in order. Each lasts `perPacket48k` samples at 48 kHz (960 for 20 ms), or take
 * `durations48k[i]`. totalSamples16k trims the last page so padding added by the encoder is not played.
 */
export function muxOggOpus({ packets, durations48k = null, perPacket48k = 960, preSkip = 312, inputRate = 16000, totalSamples16k = null, perPage = 50, serial = 0x6d656563 }) {
  const pages = [page({ packets: [opusHead(preSkip, inputRate)], granule: 0, serial, seq: 0, flags: 0x02 }), page({ packets: [opusTags()], granule: 0, serial, seq: 1, flags: 0 })]
  let seq = 2
  let cum = 0
  const dur = (i) => (durations48k ? durations48k[i] : perPacket48k)
  const total = packets.reduce((a, _, i) => a + dur(i), 0)
  const end = totalSamples16k === null ? total : Math.min(total, totalSamples16k * 3)
  for (let i = 0; i < packets.length; i += perPage) {
    const group = packets.slice(i, i + perPage)
    group.forEach((_, k) => { cum += dur(i + k) })
    const last = i + perPage >= packets.length
    pages.push(page({ packets: group, granule: preSkip + (last ? end : cum), serial, seq: seq++, flags: last ? 0x04 : 0 }))
  }
  if (!packets.length) pages.push(page({ packets: [], granule: preSkip, serial, seq: seq++, flags: 0x04 }))
  const out = new Uint8Array(pages.reduce((a, p) => a + p.length, 0))
  let o = 0
  for (const p of pages) { out.set(p, o); o += p.length }
  return out
}

// ---- browser half --------------------------------------------------------------------------------------------
const CONFIG = { codec: 'opus', sampleRate: 16000, numberOfChannels: 1, bitrate: 24000, opus: { application: 'voip', signal: 'voice', frameDuration: 20000 } }

export async function opusSupported() {
  try {
    if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') return false
    return Boolean((await AudioEncoder.isConfigSupported(CONFIG)).supported)
  } catch { return false }
}

/** Int16 PCM (16 kHz mono) -> { blob (audio/ogg), format: 'ogg' }. A fresh encoder per chunk keeps chunks independent. */
export async function encodeOggOpus(samples, rate = 16000) {
  const packets = []
  const durations = []
  let preSkip = 312
  let failure = null
  const enc = new AudioEncoder({
    output: (chunk, meta) => {
      const d = meta?.decoderConfig?.description
      if (d && d.byteLength >= 12) { const b = new Uint8Array(d.buffer ? d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) : d); if (String.fromCharCode(...b.slice(0, 8)) === 'OpusHead') preSkip = new DataView(b.buffer).getUint16(10, true) }
      const bytes = new Uint8Array(chunk.byteLength); chunk.copyTo(bytes)
      packets.push(bytes); durations.push(chunk.duration ? Math.round((chunk.duration * 48) / 1000) : 960)
    },
    error: (e) => { failure = e },
  })
  enc.configure({ ...CONFIG, sampleRate: rate })
  const BLOCK = 1600 // 100 ms
  for (let i = 0; i < samples.length && !failure; i += BLOCK) {
    const part = samples.subarray(i, Math.min(samples.length, i + BLOCK))
    enc.encode(new AudioData({ format: 's16', sampleRate: rate, numberOfFrames: part.length, numberOfChannels: 1, timestamp: Math.round((i * 1e6) / rate), data: part }))
  }
  if (!failure) await enc.flush()
  try { enc.close() } catch { /* already closed after an error */ }
  if (failure || !packets.length) throw failure || new Error('opus encoder produced nothing')
  const bytes = muxOggOpus({ packets, durations48k: durations, preSkip, inputRate: rate, totalSamples16k: Math.round((samples.length * 16000) / rate) })
  return { blob: new Blob([bytes], { type: 'audio/ogg' }), format: 'ogg' }
}
