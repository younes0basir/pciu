const API_BASE = import.meta.env.VITE_API_URL || '/api'
const AUTH_STORAGE_KEY = 'pciu_auth'

function getStoredToken() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    const token = raw ? JSON.parse(raw)?.token : null
    return typeof token === 'string' && token.length > 0 ? token : null
  } catch {
    return null
  }
}

export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`)
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('Failed to connect to backend:', err)
    return { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function fetchApi(endpoint, options = {}) {
  const token = getStoredToken()
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || `Request failed with status ${res.status}`)
  }

  return res.json()
}
