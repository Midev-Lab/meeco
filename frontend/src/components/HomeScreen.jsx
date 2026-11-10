import { useEffect, useRef, useState } from 'react'
import Waveform from './Waveform'
import StatusLines from './StatusLines'
import { CLOUD } from '../lib/config'
import { clock } from '../lib/format'
import { CloseIcon, MicIcon, MicOffIcon, PauseIcon, PlayIcon, SparkleIcon } from './icons'

export default function HomeScreen({ rec, player, onStart, onStop }) {
  const recording = rec.status === 'recording'
  const starting = rec.status === 'starting'
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const timer = useRef()

  useEffect(() => { if (!recording) setConfirmDiscard(false) }, [recording])
  useEffect(() => () => clearTimeout(timer.current), [])

  const onDiscard = () => {
    if (!confirmDiscard) {
      setConfirmDiscard(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setConfirmDiscard(false), 3000)
    } else {
      rec.discard()
    }
  }

  return (
    <section className="screen home">
      <h1 className="title" aria-live="polite">
        {recording ? 'Recording..' : 'Hello, would you like to record now?'}
      </h1>

      <div className="stage">
        <Waveform live={recording} meterRef={rec.meterRef} />
        {recording && CLOUD && <StatusLines reconnecting={rec.link === 'reconnecting'} />}
        {recording && !CLOUD && (
          <p className="caption" aria-live="off">
            <span>{rec.caption || ' '}</span>
          </p>
        )}
      </div>

      {recording ? (
        <div className="pill timer" role="timer" aria-label="Recording time">{clock(rec.elapsed)}</div>
      ) : (
        <div className={`pill status ${rec.error ? 'err' : ''}`} role="status">
          {rec.error ? <span>{rec.error}</span> : <><SparkleIcon width="14" height="14" /> <span>Conversation ready</span></>}
        </div>
      )}

      <div className="controls">
        <div />
        <div className="ctl-main">
          {recording ? (
            <button className="glass big pulse" onClick={onStop} aria-label="Stop recording"><MicOffIcon width="38" height="38" /></button>
          ) : (
            <button className="record" onClick={onStart} disabled={starting} aria-label="Record now"><MicIcon width="34" height="34" /></button>
          )}
          <span className="ctl-label">{recording ? 'Stop Recording' : starting ? 'Starting…' : 'Record Now'}</span>
        </div>
        <div className="ctl-side">
          {recording ? (
            <>
              <button className={`glass small ${confirmDiscard ? 'warn' : ''}`} onClick={onDiscard} aria-label={confirmDiscard ? 'Tap again to discard this recording' : 'Discard recording'}>
                <CloseIcon width="20" height="20" />
              </button>
              {confirmDiscard && <span className="hint">Tap again to discard</span>}
            </>
          ) : (
            <button className="glass small" onClick={player.toggle} disabled={!player.hasAudio || CLOUD} aria-label={player.playing ? 'Pause playback' : 'Play last recording'}>
              {player.playing ? <PauseIcon width="20" height="20" /> : <PlayIcon width="20" height="20" />}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
