// Runs on the audio rendering thread. Turns the microphone into 16 kHz mono 16-bit PCM and posts it
// back in 100 ms frames (AssemblyAI streaming wants 50-1000 ms per frame).
//
// If the AudioContext already runs at 16 kHz the browser did the (high quality) resampling and r === 1.
// Otherwise we decimate with a box filter: every output sample is the average of r input samples,
// with fractional weights at the edges, so non-integer ratios (44.1 kHz -> 16 kHz) stay exact.
class MeecoPCM extends AudioWorkletProcessor {
  constructor() {
    super()
    this.r = sampleRate / 16000
    this.acc = 0
    this.w = 0
    this.out = new Int16Array(1600)
    this.n = 0
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (!ch) return true
    for (let i = 0; i < ch.length; i++) {
      const x = ch[i]
      const remain = this.r - this.w
      if (remain > 1) {
        this.acc += x
        this.w += 1
      } else {
        this.acc += x * remain
        this.emit(this.acc / this.r)
        const left = 1 - remain
        this.acc = x * left
        this.w = left
      }
    }
    return true
  }
  emit(v) {
    v = Math.max(-1, Math.min(1, v))
    this.out[this.n++] = v < 0 ? v * 32768 : v * 32767
    if (this.n === 1600) {
      this.port.postMessage(this.out.buffer, [this.out.buffer])
      this.out = new Int16Array(1600)
      this.n = 0
    }
  }
}
registerProcessor('meeco-pcm', MeecoPCM)
