import { fetchApi } from '@/api.js'

const AUTH_STORAGE_KEY = 'pciu_auth'

export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

function persistAuth(payload) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
}

export function getHomeRouteForRole(role) {
  if (role === 'admin') return '/admin'
  if (role === 'chief') return '/chief'
  if (role === 'receptionist') return '/accueil'
  if (role === 'doctor') return '/doctor'
  if (role === 'nurse') return '/nurse'
  return '/board'
}

export function displayName(user) {
  if (!user) return ''
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return user.fullName || name || user.email || ''
}

export async function login({ email, password }) {
  const data = await fetchApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  persistAuth(data)
  return data
}

export async function validateTempToken(token) {
  return await fetchApi(`/auth/validate-temp-token?token=${encodeURIComponent(token)}`)
}

export async function setupPasswordWithToken({ token, newPassword }) {
  const data = await fetchApi('/auth/setup-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  })
  persistAuth(data)
  return data
}

function splitFullName(fullName) {
  const parts = String(fullName ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length < 2) {
    throw new Error('Enter your first and last name.')
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

export async function register({ fullName, email, password, role }) {
  const { firstName, lastName } = splitFullName(fullName)
  const data = await fetchApi('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ firstName, lastName, email, password, role }),
  })
  persistAuth(data)
  return data
}

export async function logout() {
  clearStoredAuth()
  try {
    await fetchApi('/auth/logout', { method: 'POST' })
  } catch {
    // The server session is stateless; the local token is already gone.
  }
}
