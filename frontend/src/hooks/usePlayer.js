import { useCallback, useEffect, useRef, useState } from 'react'

/** Plays back the most recent recording (kept in memory only; audio is not saved to history). */
export function usePlayer() {
  const [hasAudio, setHasAudio] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audio = useRef(null)
  const url = useRef(null)

  const stop = useCallback(() => {
    audio.current?.pause()
    if (audio.current) audio.current.currentTime = 0
    setPlaying(false)
  }, [])

  const load = useCallback((blob) => {
    stop()
    if (url.current) URL.revokeObjectURL(url.current)
    url.current = null; audio.current = null
    if (!blob) return setHasAudio(false)
    url.current = URL.createObjectURL(blob)
    audio.current = new Audio(url.current)
    audio.current.onended = () => setPlaying(false)
    setHasAudio(true)
  }, [stop])

  const toggle = useCallback(async () => {
    const a = audio.current
    if (!a) return
    if (!a.paused) { a.pause(); return setPlaying(false) }
    try { await a.play(); setPlaying(true) } catch { setPlaying(false) }
  }, [])

  useEffect(() => () => { audio.current?.pause(); if (url.current) URL.revokeObjectURL(url.current) }, [])
  return { hasAudio, playing, load, toggle, stop }
}
