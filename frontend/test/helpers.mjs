// A scriptable stand-in for the browser WebSocket, so LiveStream can be tested without a network.
export class FakeWS {
  static all = []
  constructor(url) {
    this.url = url
    this.readyState = 1
    this.sent = []
    this.binaryType = ''
    FakeWS.all.push(this)
  }
  send(d) { this.sent.push(d) }
  close() { if (this.readyState !== 3) { this.readyState = 3; queueMicrotask(() => this.onclose?.({})) } }
  // server-side helpers
  say(obj) { this.onmessage?.({ data: JSON.stringify(obj) }) }
  dropAbruptly() { this.readyState = 3; this.onclose?.({}) }
  get audio() { return this.sent.filter((x) => typeof x !== 'string') }
  get texts() { return this.sent.filter((x) => typeof x === 'string').map((x) => JSON.parse(x)) }
}
export const frame = (ms = 100) => new Int16Array((ms * 16) | 0)
export const turn = (order, words, final = true, transcript) => ({
  type: 'Turn', turn_order: order, end_of_turn: final, turn_is_formatted: final,
  transcript: transcript ?? words.map((w) => w[0]).join(' '),
  words: words.map(([text, start, end]) => ({ text, start, end, word_is_final: final })),
})
export const cfg = (n = 1) => ({ url: 'wss://example/v3/ws', params: { sample_rate: 16000, encoding: 'pcm_s16le' }, token: `tok${n}` })
export const tick = () => new Promise((r) => setTimeout(r, 0))
