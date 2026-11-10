// Turns a live microphone stream into 9 smoothed 0..1 levels that drive the waveform.
export const BAR_COUNT = 9

// Silhouette: centre bars can reach full height, edges stay smaller (matches the design).
const ENVELOPE = [0.5, 0.7, 0.85, 0.95, 1, 0.95, 0.84, 0.68, 0.48]
// Frequency bands (Hz) feeding each bar. Voice energy sits low, so low bands go to the centre bars and the
// thinner high-frequency content to the edges. Bins are derived from the context's sample rate, so the
// look is the same at 48 kHz or at the 16 kHz the cloud pipeline captures at.
const BANDS_HZ = [[2250, 3190], [1500, 2250], [940, 1500], [560, 940], [375, 560], [750, 1030], [1130, 1690], [1880, 2620], [2810, 3940]]

const clamp01 = (n) => Math.min(1, Math.max(0, n))

export function createMeter(ctx, stream) {
  const source = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 256
  analyser.minDecibels = -90
  analyser.maxDecibels = -10
  analyser.smoothingTimeConstant = 0.75
  source.connect(analyser) // deliberately NOT connected to ctx.destination: no feedback

  const binHz = ctx.sampleRate / analyser.fftSize
  const maxBin = analyser.frequencyBinCount - 1
  const RANGES = BANDS_HZ.map(([lo, hi]) => [Math.min(maxBin, Math.round(lo / binHz)), Math.min(maxBin, Math.max(Math.round(lo / binHz), Math.round(hi / binHz) - 1))])
  const freq = new Uint8Array(analyser.frequencyBinCount)
  const out = new Array(BAR_COUNT).fill(0)

  return {
    read() {
      analyser.getByteFrequencyData(freq)
      for (let i = 0; i < BAR_COUNT; i++) {
        const [a, b] = RANGES[i]
        let sum = 0
        for (let k = a; k <= b; k++) sum += freq[k]
        const avg = sum / (b - a + 1)
        const target = Math.pow(clamp01((avg - 70) / 150), 0.8) * ENVELOPE[i] // 70 = noise gate
        out[i] += (target - out[i]) * (target > out[i] ? 0.6 : 0.14) // fast attack, slow release
      }
      return out
    },
    close() {
      try { source.disconnect() } catch { /* already closed */ }
    },
  }
}

/** Synthetic speech-like levels, used by the preview build (no microphone needed). */
export function createDemoMeter() {
  const out = new Array(BAR_COUNT).fill(0)
  return {
    read() {
      const t = performance.now() / 1000
      const syllable = Math.abs(Math.sin(t * 3.1) * Math.sin(t * 1.3 + 1))
      const amp = 0.3 + 0.7 * syllable
      for (let i = 0; i < BAR_COUNT; i++) {
        const wobble = 0.55 + 0.45 * Math.sin(t * (5 + i * 1.7) + i * 1.3)
        const target = clamp01(amp * wobble * 1.25) * ENVELOPE[i]
        out[i] += (target - out[i]) * (target > out[i] ? 0.5 : 0.14)
      }
      return out
    },
    close() {},
  }
}
