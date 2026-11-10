import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { muxOggOpus } from '../src/lib/oggOpus.js'

// Real Opus packets from ffmpeg, so the muxer is judged by an independent decoder.
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0
const realPackets = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ogg-'))
  const src = join(dir, 'a.ogg')
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3:sample_rate=16000', '-ac', '1', '-c:a', 'libopus', '-b:a', '24k', '-frame_duration', '20', '-y', src])
  return { packets: demux(readFileSync(src)), dir }
}
// minimal Ogg demuxer (independent of the muxer under test): returns audio packets, skipping OpusHead/OpusTags
function demux(buf) {
  const packets = []
  let cur = []
  let o = 0
  while (o < buf.length) {
    const n = buf[o + 26]
    let p = o + 27 + n
    for (let i = 0; i < n; i++) {
      const len = buf[o + 27 + i]
      cur.push(buf.subarray(p, p + len)); p += len
      if (len < 255) { packets.push(Buffer.concat(cur)); cur = [] }
    }
    o = p
  }
  return packets.slice(2).map((b) => new Uint8Array(b))
}

test('muxer output is a valid Ogg Opus stream of the right length', { skip: !hasFfmpeg }, async () => {
  const { packets, dir } = realPackets()
  assert.ok(packets.length > 100)
  const ogg = muxOggOpus({ packets, perPacket48k: 960, totalSamples16k: 3 * 16000 })
  const f = join(dir, 'mine.ogg'); writeFileSync(f, ogg)
  const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', f]).toString())
  assert.equal(info.streams[0].codec_name, 'opus')
  assert.ok(Math.abs(parseFloat(info.format.duration) - 3) < 0.05, info.format.duration)
  // full decode must succeed with no CRC / sync errors
  const dec = spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-f', 'null', '-'])
  assert.equal(dec.stderr.toString().trim(), '')
  assert.equal(dec.status, 0)
})

test('empty and tiny inputs still produce a structurally valid stream', () => {
  const a = muxOggOpus({ packets: [] })
  assert.equal(String.fromCharCode(...a.slice(0, 4)), 'OggS')
  const b = muxOggOpus({ packets: [new Uint8Array(300)] }) // 300 bytes: needs 255 + 45 lacing
  assert.ok(b.length > 300)
})
