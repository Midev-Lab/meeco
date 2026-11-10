import { useCallback, useEffect, useRef, useState } from 'react'
import { createDemoMeter, createMeter } from '../lib/meter'
import { createTranscriber, DEMO } from '../lib/transcriber'
import { CLOUD } from '../lib/config'
import { startCloudEngine } from '../lib/cloudEngine'

// Safari records MP4/AAC only; Chromium/Firefox prefer WebM/Opus. Detect, don't sniff the UA.
const MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus']
const pickMime = () => MIMES.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || ''

const ERRORS = {
  NotAllowedError: 'Microphone blocked. Allow access to record.',
  PermissionDeniedError: 'Microphone blocked. Allow access to record.',
  NotFoundError: 'No microphone found.',
  NotReadableError: 'Microphone is busy in another app.',
  unsupported: 'Recording is not supported in this browser.',
}

export function useRecorder() {
  const [status, setStatus] = useState('idle') // idle | starting | recording
  const [elapsed, setElapsed] = useState(0)
  const [caption, setCaption] = useState('')
  const [error, setError] = useState(null)
  const [limit, setLimit] = useState(false) // the 2h30m session cap was reached: the app should stop for the user
  const [link, setLink] = useState('live') // cloud stream health: connecting | live | reconnecting
  const meterRef = useRef(null) // read by the waveform every frame, never via React state
  const r = useRef({}).current

  const teardown = useCallback(() => {
    clearInterval(r.timer)
    r.meter?.close(); meterRef.current = null; r.meter = null
    r.stream?.getTracks().forEach((t) => t.stop()); r.stream = null
    r.ctx?.close?.().catch(() => {}); r.ctx = null
    r.wake?.release?.().catch(() => {}); r.wake = null
    document.removeEventListener('visibilitychange', r.onVis)
  }, [r])

  const start = useCallback(async () => {
    if (status !== 'idle') return false
    setError(null); setCaption(''); setLimit(false); setStatus('starting')
    try {
      if (!DEMO) {
        const needsRecorder = !CLOUD
        if (!navigator.mediaDevices?.getUserMedia || (needsRecorder && !window.MediaRecorder)) throw Object.assign(new Error(), { name: 'unsupported' })
        // Browser DSP stays on: noise suppression + echo cancellation + auto gain keep the central voice clear.
        r.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
        const AC = window.AudioContext || window.webkitAudioContext
        // 16 kHz context = the browser resamples for us; if it refuses we fall back to the native rate (the worklet decimates).
        try { r.ctx = CLOUD ? new AC({ sampleRate: 16000 }) : new AC() } catch { r.ctx = new AC() }
        if (r.ctx.state === 'suspended') await r.ctx.resume().catch(() => {})
        r.meter = createMeter(r.ctx, r.stream)

        if (CLOUD) {
          r.engine = await startCloudEngine({ stream: r.stream, ctx: r.ctx, onStatus: setLink, onLimit: () => setLimit(true) })
        } else {
          const mime = pickMime()
          r.chunks = []
          r.mr = new MediaRecorder(r.stream, mime ? { mimeType: mime } : undefined)
          r.mr.ondataavailable = (e) => e.data?.size && r.chunks.push(e.data)
          r.mr.start(1000)
          r.mime = r.mr.mimeType || mime || 'audio/webm'
        }
      } else {
        r.meter = createDemoMeter()
      }
      meterRef.current = r.meter

      if (!CLOUD) {
        r.transcriber = createTranscriber({ onCaption: setCaption })
        r.transcriber.start()
      }

      // Keep the screen on while recording; re-request after the tab returns from the background.
      const wake = async () => { try { r.wake = await navigator.wakeLock?.request('screen') } catch { /* optional */ } }
      r.onVis = () => document.visibilityState === 'visible' && r.meter && wake()
      document.addEventListener('visibilitychange', r.onVis); wake()

      r.t0 = Date.now(); setElapsed(0)
      r.timer = setInterval(() => setElapsed(Math.floor((Date.now() - r.t0) / 1000)), 250)
      setStatus('recording')
      return true
    } catch (e) {
      teardown(); r.transcriber?.abort(); r.engine?.discard(); r.engine = null
      setError(ERRORS[e.name] || 'Could not start recording.')
      setStatus('idle')
      return false
    }
  }, [status, r, teardown])

  /** Stop and hand back the audio plus a finish() that completes transcription. */
  const stop = useCallback(async () => {
    if (status !== 'recording') return null
    if (CLOUD && r.engine) {
      const out = r.engine.stop(); r.engine = null
      teardown(); setStatus('idle'); setElapsed(0); setLimit(false)
      return { blob: null, ...out }
    }
    const seconds = (Date.now() - r.t0) / 1000
    const transcriber = r.transcriber
    transcriber.halt()
    const blob = await new Promise((resolve) => {
      if (DEMO || !r.mr || r.mr.state === 'inactive') return resolve(null)
      r.mr.onstop = () => resolve(new Blob(r.chunks, { type: r.mime }))
      r.mr.stop()
    })
    teardown(); setStatus('idle'); setCaption(''); setElapsed(0)
    return { blob, duration: seconds, finish: (opts) => transcriber.finish(opts), abort: () => transcriber.abort() }
  }, [status, r, teardown])

  const discard = useCallback(() => {
    r.transcriber?.abort(); r.engine?.discard(); r.engine = null
    if (r.mr && r.mr.state !== 'inactive') { r.mr.onstop = null; try { r.mr.stop() } catch { /* noop */ } }
    teardown(); setStatus('idle'); setCaption(''); setElapsed(0)
  }, [r, teardown])

  useEffect(() => () => { r.transcriber?.abort(); r.engine?.discard(); teardown() }, [r, teardown])

  return { status, elapsed, caption, error, limit, link, meterRef, start, stop, discard, clearError: () => setError(null) }
}
