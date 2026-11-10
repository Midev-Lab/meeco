import test from 'node:test'
import assert from 'node:assert/strict'
import { int16ToWav } from '../src/lib/wav.js'

test('WAV header describes 16 kHz mono 16-bit PCM', () => {
  const buf = int16ToWav(Int16Array.from([1, -2, 32767, -32768]))
  const dv = new DataView(buf)
  const tag = (o) => String.fromCharCode(...new Uint8Array(buf, o, 4))
  assert.equal(buf.byteLength, 44 + 8)
  assert.deepEqual([tag(0), tag(8), tag(12), tag(36)], ['RIFF', 'WAVE', 'fmt ', 'data'])
  assert.equal(dv.getUint32(4, true), 36 + 8)
  assert.deepEqual([dv.getUint16(20, true), dv.getUint16(22, true), dv.getUint32(24, true), dv.getUint16(34, true)], [1, 1, 16000, 16])
  assert.deepEqual([dv.getInt16(44, true), dv.getInt16(46, true), dv.getInt16(48, true), dv.getInt16(50, true)], [1, -2, 32767, -32768])
})
