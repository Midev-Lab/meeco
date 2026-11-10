import { StopIcon } from './icons'

export default function ProcessingScreen({ progress, onCancel }) {
  return (
    <section className="screen processing">
      <h1 className="title" aria-live="polite">Please wait, your recording is currently processing.</h1>

      <div className="ring-wrap">
        <div className="ring" style={{ '--p': progress }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="ring-arc" />
          <div className="ring-dot-track"><i className="ring-dot" /></div>
          <div className="ring-num">{progress}<small>%</small></div>
        </div>
      </div>

      <div className="controls">
        <div />
        <div className="ctl-main">
          <button className="glass big" onClick={onCancel} aria-label="Cancel process"><StopIcon width="34" height="34" /></button>
          <span className="ctl-label">Cancel process</span>
        </div>
        <div />
      </div>
    </section>
  )
}
