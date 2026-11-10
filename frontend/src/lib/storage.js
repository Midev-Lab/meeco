// Everything lives in localStorage for now (sign-in + backend come later).
// Every access is wrapped: storage can be blocked, full, or absent (private mode, sandboxed iframes).
const K_HISTORY = 'meeco.history.v1'
const K_PROFILE = 'meeco.profile.v1'

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: the app still works for this session */
  }
}

export const loadHistory = () => {
  const v = read(K_HISTORY, [])
  return Array.isArray(v) ? v : []
}
export const saveHistory = (items) => write(K_HISTORY, items)

export const loadProfile = () => ({ name: '', email: '', ...read(K_PROFILE, {}) })
export const saveProfile = (p) => write(K_PROFILE, p)
