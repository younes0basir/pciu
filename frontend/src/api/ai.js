import { fetchApi } from '@/api.js'

export function fetchAiHealth() {
  return fetchApi('/ai/health')
}

export function fetchAiSettings() {
  return fetchApi('/ai/settings')
}

export function fetchAiStatus() {
  return fetchApi('/ai/status')
}

export function patchAiSettings(payload) {
  return fetchApi('/ai/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function fetchAiRecommendations({ visitId, status } = {}) {
  const params = new URLSearchParams()
  if (visitId != null) params.set('visitId', String(visitId))
  if (status) params.set('status', status)
  const qs = params.toString()
  return fetchApi(`/ai/recommendations${qs ? `?${qs}` : ''}`)
}

export function patchAiRecommendation(id, payload) {
  return fetchApi(`/ai/recommendations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function requestDocumentationSummary(visitId) {
  return fetchApi('/ai/documentation/summary', {
    method: 'POST',
    body: JSON.stringify({ visitId }),
  })
}

export function requestTriageRecommend(visitId, { shadow = false } = {}) {
  return fetchApi('/ai/triage/recommend', {
    method: 'POST',
    body: JSON.stringify({ visitId, shadow }),
  })
}

export function requestBedFlowRecommend(visitId) {
  return fetchApi('/ai/bed-flow/recommend', {
    method: 'POST',
    body: JSON.stringify({ visitId }),
  })
}

export function requestCapacityAnalyze() {
  return fetchApi('/ai/capacity/analyze', { method: 'POST', body: '{}' })
}

export function requestPipelinePlacementPlan() {
  return fetchApi('/ai/bed-flow/pipeline/plan', { method: 'POST', body: '{}' })
}

export function applyPipelinePlacement(payload) {
  return fetchApi('/ai/bed-flow/pipeline/apply', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
