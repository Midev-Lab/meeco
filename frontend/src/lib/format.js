const p2 = (n) => String(n).padStart(2, '0')

/** 3723 -> "01:02:03" */
export function clock(totalSec) {
  const s = Math.max(0, Math.floor(totalSec))
  return `${p2(Math.floor(s / 3600))}:${p2(Math.floor((s % 3600) / 60))}:${p2(s % 60)}`
}

/** 125 -> "2m 05s" */
export function duration(totalSec) {
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h) return `${h}h ${p2(m)}m`
  if (m) return `${m}m ${p2(r)}s`
  return `${r}s`
}

export function when(ts) {
  const d = new Date(ts)
  const now = new Date()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000)
  if (diffDays === 0) return `Today, ${time}`
  if (diffDays === 1) return `Yesterday, ${time}`
  const day = d.toLocaleDateString([], { day: 'numeric', month: 'short' })
  return `${day}, ${time}`
}

export const wordCount = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0)

export function makeTitle(text, ts) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return `Recording · ${when(ts)}`
  const first = (text.trim().match(/^[^.!?]+/) || [text.trim()])[0].trim().split(/\s+/)
  const head = first.slice(0, 7).join(' ').replace(/[.,;:!?]+$/, '')
  const title = head.charAt(0).toUpperCase() + head.slice(1)
  return first.length > 7 ? `${title}…` : title
}

/** Group sentences into short paragraphs so long transcripts stay readable. */
export function paragraphs(text, per = 3) {
  const sentences = text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]*/g) || []
  const out = []
  for (let i = 0; i < sentences.length; i += per) out.push(sentences.slice(i, i + per).join(' ').trim())
  return out.filter(Boolean)
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
