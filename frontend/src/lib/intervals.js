// Mirrors backend/app/ledger.py so the client can tell whether a recording has gaps
// (and therefore whether finalize must wait for the S3 chunks to finish uploading).
export function normalize(intervals, total = null) {
  const out = []
  for (let [s, e] of intervals) {
    if (total !== null) { s = Math.max(0, Math.min(s, total)); e = Math.max(0, Math.min(e, total)) }
    if (e > s) out.push([s, e])
  }
  out.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const merged = []
  for (const [s, e] of out) {
    const last = merged[merged.length - 1]
    if (last && s <= last[1]) last[1] = Math.max(last[1], e)
    else merged.push([s, e])
  }
  return merged
}

export function findGaps(owned, total, minGap = 400, mergeWithin = 2000) {
  let cursor = 0
  const raw = []
  for (const [s, e] of normalize(owned, total)) {
    if (s - cursor >= minGap) raw.push([cursor, s])
    cursor = Math.max(cursor, e)
  }
  if (total - cursor >= minGap) raw.push([cursor, total])
  const merged = []
  for (const [s, e] of raw) {
    const last = merged[merged.length - 1]
    if (last && s - last[1] < mergeWithin) last[1] = e
    else merged.push([s, e])
  }
  return merged
}
