/** 16-bit mono PCM -> WAV file bytes (44-byte header + samples, little-endian). */
export function int16ToWav(samples, rate = 16000) {
  const dataBytes = samples.length * 2
  const buf = new ArrayBuffer(44 + dataBytes)
  const dv = new DataView(buf)
  const str = (off, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); dv.setUint32(4, 36 + dataBytes, true); str(8, 'WAVE')
  str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true)
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true)
  str(36, 'data'); dv.setUint32(40, dataBytes, true)
  for (let i = 0; i < samples.length; i++) dv.setInt16(44 + i * 2, samples[i], true)
  return buf
}
