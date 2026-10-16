import { fetchApi } from '@/api.js'

export function fetchResourceBoard() {
  return fetchApi('/resources/board')
}

export function fetchResourceCapacity() {
  return fetchApi('/resources/capacity')
}

export function fetchResourceDetail(bedId) {
  return fetchApi(`/resources/${bedId}`)
}

export function fetchResourceHistory(bedId, { limit = 50, offset = 0 } = {}) {
  const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  return fetchApi(`/resources/${bedId}/history?${qs}`)
}

export function fetchEligibleResources(visitId, { staffedOnly = false } = {}) {
  const qs = new URLSearchParams({ visitId: String(visitId) })
  if (staffedOnly) qs.set('staffedOnly', '1')
  return fetchApi(`/resources/eligible?${qs}`)
}

export function confirmResourceReady(bedId, body = {}) {
  return fetchApi(`/resources/${bedId}/confirm-ready`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function markResourceCleaning(bedId, body = {}) {
  return fetchApi(`/resources/${bedId}/mark-cleaning`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function setResourceOperationalStatus(bedId, body) {
  return fetchApi(`/resources/${bedId}/operational-status`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function fetchResourceAlerts(status = 'open') {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  return fetchApi(`/resources/alerts${qs}`)
}
