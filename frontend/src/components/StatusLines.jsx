import { useEffect, useState } from 'react'

// Generic on purpose: these say nothing about what is being said, only that meeco is paying attention.
const LINES = ['Listening…', 'Catching every word', 'Focusing on your voice', 'Tuning out the background', 'Still with you', 'Keeping it all safe']

export default function StatusLines({ reconnecting }) {
  const [i, setI] = useState(0)
  useEffect(() => { const t = setInterval(() => setI((n) => (n + 1) % LINES.length), 3600); return () => clearInterval(t) }, [])
  return (
    <p className="status-line" aria-live="off">
      <span key={reconnecting ? 'r' : i}>{reconnecting ? 'Reconnecting, still recording…' : LINES[i]}</span>
    </p>
  )
}
