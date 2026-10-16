import { fetchApi } from '@/api.js'

function zoneQuery(zone) {
  if (!zone || zone === 'all') return ''
  return `?zone=${encodeURIComponent(zone)}`
}

export function fetchSupervisionOverview(zone = 'all') {
  return fetchApi(`/chief/supervision/overview${zoneQuery(zone)}`)
}

export function fetchSupervisionAlerts(status = 'active', limit = 50) {
  const params = new URLSearchParams({ status, limit: String(limit) })
  return fetchApi(`/chief/supervision/alerts?${params.toString()}`)
}

export function fetchSupervisionBottlenecks(zone = 'all') {
  return fetchApi(`/chief/supervision/bottlenecks${zoneQuery(zone)}`)
}

export function fetchSupervisionCoordination() {
  return fetchApi('/chief/supervision/coordination')
}

export function fetchSupervisionActivity(limit = 20) {
  return fetchApi(`/chief/supervision/activity?limit=${limit}`)
}

export function acknowledgeSupervisionAlert(alertId) {
  return fetchApi(`/chief/supervision/alerts/${alertId}/acknowledge`, { method: 'POST' })
}

export function evaluateSupervisionAlerts() {
  return fetchApi('/chief/supervision/evaluate-alerts', { method: 'POST' })
}
