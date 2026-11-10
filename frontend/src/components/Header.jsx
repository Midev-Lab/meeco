import { useEffect } from 'react'
import { ChevronDown, ClockIcon, MenuIcon, UserIcon } from './icons'

export default function Header({ open, onToggle, onClose, onNavigate, historyCount }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <header className="header">
      <button className="brand" onClick={onToggle} aria-haspopup="menu" aria-expanded={open}>
        meeco <ChevronDown className={`chev ${open ? 'up' : ''}`} width="16" height="16" />
      </button>
      <button className="icon-btn" onClick={onToggle} aria-label="Menu" aria-expanded={open}>
        <MenuIcon />
      </button>

      {open && (
        <>
          <div className="scrim" onClick={onClose} />
          <nav className="menu" role="menu">
            <button role="menuitem" onClick={() => onNavigate('profile')}>
              <UserIcon /> <span>Profile</span>
            </button>
            <button role="menuitem" onClick={() => onNavigate('history')}>
              <ClockIcon /> <span>History</span>
              {historyCount > 0 && <em className="badge">{historyCount}</em>}
            </button>
          </nav>
        </>
      )}
    </header>
  )
}
