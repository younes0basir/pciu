import { fetchApi } from '@/api.js'

export function fetchVisitDetails(visitId) {
  return fetchApi(`/visits/${visitId}`)
}

export function fetchAvailableBeds() {
  return fetchApi('/beds/available')
}

export function registerVisit(payload) {
  return fetchApi('/visits/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function callVisit(visitId) {
  return fetchApi(`/visits/${visitId}/call`, { method: 'POST', body: '{}' })
}

export function placeVisit(visitId, bedId) {
  return fetchApi(`/visits/${visitId}/place`, {
    method: 'POST',
    body: JSON.stringify({ bedId }),
  })
}

export function startVisitConsultation(visitId, payload = {}) {
  return fetchApi(`/visits/${visitId}/start`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateVisitPriority(visitId, payload) {
  return fetchApi(`/visits/${visitId}/priority`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function saveVisitConsultation(visitId, payload) {
  return fetchApi(`/visits/${visitId}/consultation`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function returnVisitToWaiting(visitId, reason) {
  return fetchApi(`/visits/${visitId}/return`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || undefined }),
  })
}

export function closeVisit(visitId, payload) {
  return fetchApi(`/visits/${visitId}/close`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
