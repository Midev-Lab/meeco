import { useEffect, useRef } from 'react'
import { BAR_COUNT } from '../lib/meter'

// Resting silhouette, taken from the idle screen of the design.
const IDLE = [0.1, 0.34, 0.6, 1, 0.52, 0.72, 0.46, 0.28, 0.1]
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** 9 capsules, each a dim "ghost" with a brighter, glowing core. Driven straight from the audio
 *  meter every frame by writing to the DOM, so React never re-renders at 60fps. */
export default function Waveform({ live, meterRef }) {
  const ghosts = useRef([])
  const cores = useRef([])
  const liveRef = useRef(live)
  liveRef.current = live

  useEffect(() => {
    let raf
    let smooth = new Array(BAR_COUNT).fill(0)
    const still = reduced()
    const frame = (now) => {
      const t = now / 1000
      const levels = liveRef.current && meterRef.current ? meterRef.current.read() : null
      for (let i = 0; i < BAR_COUNT; i++) {
        let g, c, glow
        if (levels) {
          const l = levels[i]
          g = 0.16 + l * 0.84
          c = 0.08 + l * 0.5
          glow = l
        } else {
          const breathe = still ? 1 : 0.94 + 0.06 * Math.sin(t * 1.1 + i * 0.7)
          g = IDLE[i] * breathe
          c = IDLE[i] * 0.55 * breathe
          glow = 0
        }
        smooth[i] += (glow - smooth[i]) * 0.25
        const ge = ghosts.current[i], ce = cores.current[i]
        if (!ge || !ce) continue
        ge.style.height = `${(g * 100).toFixed(1)}%`
        ce.style.height = `${(c * 100).toFixed(1)}%`
        ce.style.opacity = levels ? (0.55 + smooth[i] * 0.45).toFixed(2) : '0.34'
        ce.style.boxShadow = smooth[i] > 0.03
          ? `0 0 ${(8 + smooth[i] * 26).toFixed(0)}px rgba(255,255,255,${(0.25 + smooth[i] * 0.6).toFixed(2)})`
          : 'none'
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [meterRef])

  return (
    <div className="wave" aria-hidden="true">
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div className="wave-bar" key={i}>
          <span className="wave-ghost" ref={(el) => (ghosts.current[i] = el)} />
          <span className="wave-core" ref={(el) => (cores.current[i] = el)} />
        </div>
      ))}
    </div>
  )
}
