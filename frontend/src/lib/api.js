export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/** Thin client for the meeco FastAPI backend. Every call carries the anonymous device id. */
export function createApi({ base, device, fetchImpl = (...a) => fetch(...a) }) {
  async function call(method, path, body, { timeoutMs = 30000 } = {}) {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeoutMs)
    try {
      const res = await fetchImpl(base + path, {
        method,
        headers: { 'X-Device-Id': device, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctl.signal,
      })
      if (!res.ok) {
        let msg = res.statusText
        try { msg = (await res.json()).detail || msg } catch { /* not json */ }
        throw new ApiError(res.status, msg)
      }
      return await res.json()
    } finally {
      clearTimeout(timer)
    }
  }
  const s = (id) => `/v1/sessions/${id}`
  return {
    health: () => call('GET', '/health', null, { timeoutMs: 8000 }),
    createSession: (chunkSeconds, chunkFormat = 'wav') => call('POST', '/v1/sessions', { chunk_seconds: chunkSeconds, chunk_format: chunkFormat }),
    refreshStream: (id) => call('POST', `${s(id)}/stream-token`),
    chunkUrl: (id, index, format) => call('POST', `${s(id)}/chunks`, format ? { index, format } : { index }),
    putCheckpoint: (id, cp) => call('PUT', `${s(id)}/checkpoint`, cp, { timeoutMs: 15000 }),
    finalize: (id, cp) => call('POST', `${s(id)}/finalize`, cp, { timeoutMs: 20 * 60 * 1000 }),
    list: () => call('GET', '/v1/sessions'),
    get: (id) => call('GET', s(id)),
    remove: (id) => call('DELETE', s(id)),
    summary: (id) => call('POST', `${s(id)}/summary`),
    actionItems: (id) => call('POST', `${s(id)}/action-items`),
    putActionItems: (id, items) => call('PUT', `${s(id)}/action-items`, { items }),
  }
}
