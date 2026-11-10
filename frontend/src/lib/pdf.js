import { jsPDF } from 'jspdf'
import { duration, when, wordCount } from './format'

// jsPDF's built-in fonts are WinAnsi, so normalise typographic punctuation and drop anything else.
const clean = (s) =>
  (s ?? '')
    .replace(/[‘’‛]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-').replace(/…/g, '...').replace(/ /g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E¡-ÿ]/g, '')

export function buildPdf(item) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 56
  const CW = W - M * 2
  let y = M

  const ensure = (h) => { if (y + h > H - M - 10) { doc.addPage(); y = M } }
  const para = (str, { size = 11, style = 'normal', color = 30, lh = 1.55, gap = 0, x = M, w = CW } = {}) => {
    doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(color)
    for (const line of doc.splitTextToSize(clean(str), w)) { ensure(size * lh); doc.text(line, x, y + size); y += size * lh }
    y += gap
  }
  const heading = (label) => {
    ensure(48); y += 12
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(120)
    doc.text(label.toUpperCase().split('').join(String.fromCharCode(8202)), M, y + 9); y += 16
    doc.setDrawColor(215); doc.setLineWidth(0.5); doc.line(M, y, W - M, y); y += 12
  }

  // Masthead
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(0); doc.text('meeco', M, y + 16); y += 36
  para(item.title, { size: 17, style: 'bold', color: 0, lh: 1.3, gap: 4 })
  para(`${when(item.createdAt)}  |  ${duration(item.duration)}  |  ${wordCount(item.transcript)} words`, { size: 10, color: 110, gap: 6 })

  if (item.summary) {
    heading('Summary')
    para(item.summary.overview, { gap: 6 })
    item.summary.points.forEach((p) => {
      ensure(18); doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(30); doc.text('-', M + 2, y + 11)
      para(p, { x: M + 16, w: CW - 16, gap: 3 })
    })
  }
  if (item.actionItems) {
    heading('Action items')
    if (!item.actionItems.length) para('No clear action items found in this recording.', { color: 110 })
    item.actionItems.forEach((a) => {
      ensure(20)
      doc.setDrawColor(40); doc.setLineWidth(0.9); doc.rect(M, y + 2, 10, 10)
      if (a.done) { doc.setLineWidth(1.4); doc.line(M + 2, y + 7.5, M + 4.5, y + 10); doc.line(M + 4.5, y + 10, M + 8.5, y + 4) }
      para(a.text, { x: M + 20, w: CW - 20, gap: 4 })
    })
  }

  heading('Transcript')
  const paras = clean(item.transcript).replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]*/g) || []
  if (!paras.length) para('No speech was detected.', { color: 110 })
  for (let i = 0; i < paras.length; i += 3) para(paras.slice(i, i + 3).join(' ').trim(), { gap: 8 })

  const pages = doc.getNumberOfPages()
  for (let n = 1; n <= pages; n++) {
    doc.setPage(n); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(150)
    doc.text('Made with meeco', M, H - 30); doc.text(`${n} / ${pages}`, W - M, H - 30, { align: 'right' })
  }
  return doc.output('blob')
}

const fileName = (item) => `meeco-${new Date(item.createdAt).toISOString().slice(0, 16).replace(/[-:T]/g, '')}.pdf`

function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Share as a PDF via the native share sheet where supported, otherwise download.
 *  Must run inside the click handler: share() needs transient user activation, so the PDF is built synchronously. */
export async function sharePdf(item) {
  const blob = buildPdf(item)
  const name = fileName(item)
  const file = new File([blob], name, { type: 'application/pdf' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: item.title })
      return 'shared'
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled'
      // NotAllowedError, TypeError, etc: fall through to a normal download
    }
  }
  download(blob, name)
  return 'downloaded'
}
