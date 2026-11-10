import { BackIcon } from './icons'
import { duration, wordCount } from '../lib/format'

const initials = (name, email) => {
  const src = (name || email || '').trim()
  if (!src) return 'M'
  const parts = src.split(/[\s@._-]+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[1][0] : '')).toUpperCase() || 'M'
}

export default function ProfileScreen({ profile, onChange, history, onBack }) {
  const totalSec = history.reduce((n, h) => n + h.duration, 0)
  const words = history.reduce((n, h) => n + (h.words ?? wordCount(h.transcript || '')), 0)

  return (
    <section className="screen sheet">
      <div className="subhead">
        <button className="icon-btn" onClick={onBack} aria-label="Back"><BackIcon /></button>
        <div className="subhead-title"><h1>Profile</h1><p>Saved on this device</p></div>
        <span className="icon-btn ghost" />
      </div>

      <div className="profile">
        <div className="avatar" aria-hidden="true">{initials(profile.name, profile.email)}</div>

        <label className="field"><span>Name</span>
          <input value={profile.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Your name" autoComplete="name" maxLength={60} />
        </label>
        <label className="field"><span>Email</span>
          <input type="email" value={profile.email} onChange={(e) => onChange({ email: e.target.value })} placeholder="you@example.com" autoComplete="email" maxLength={80} />
        </label>

        <div className="stats">
          <div><b>{history.length}</b><span>Recordings</span></div>
          <div><b>{totalSec ? duration(totalSec) : '0s'}</b><span>Recorded</span></div>
          <div><b>{words.toLocaleString()}</b><span>Words</span></div>
        </div>

        <p className="foot">Sign-in is coming later. Until then your profile and history stay in this browser only.</p>
      </div>
    </section>
  )
}
