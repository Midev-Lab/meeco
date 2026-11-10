// Cloud mode switches on when an API URL is known: build-time VITE_API_URL, or ?api=https://... for testing.
// Without one the app runs entirely on-device (Web Speech + rule-based summaries), exactly like phase 1.
const fromQuery = () => { try { return new URLSearchParams(location.search).get('api') } catch { return null } }
export const API_URL = ((import.meta.env.VITE_API_URL || fromQuery() || '') + '').replace(/\/+$/, '')
export const CLOUD = Boolean(API_URL) && import.meta.env.VITE_DEMO !== '1'

const KEY = 'meeco.device.v1'
const rand = () => { const a = new Uint8Array(16); crypto.getRandomValues(a); return [...a].map((b) => b.toString(16).padStart(2, '0')).join('') }
/** Anonymous device id (32 hex chars) until sign-in exists. Not authentication. */
export function deviceId() {
  try {
    let v = localStorage.getItem(KEY)
    if (!v || !/^[A-Za-z0-9_-]{16,64}$/.test(v)) { v = rand(); localStorage.setItem(KEY, v) }
    return v
  } catch { return rand() }
}
