import { fetchApi } from '@/api.js'

export function fetchWorkflowSupervision() {
  return fetchApi('/workflow/supervision')
}

export function fetchWorkflowAlerts(status = 'open') {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  return fetchApi(`/workflow/alerts${qs}`)
}

export function acknowledgeWorkflowAlert(alertId) {
  return fetchApi(`/workflow/alerts/${alertId}/acknowledge`, { method: 'POST' })
}

export function resolveWorkflowAlert(alertId, body = {}) {
  return fetchApi(`/workflow/alerts/${alertId}/resolve`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function fetchResourcesBoard() {
  return fetchApi('/workflow/resources/board')
}

export function confirmBedReady(bedId, body = {}) {
  return fetchApi(`/care/resources/${bedId}/confirm-ready`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function createTransferRequest(visitId, bedId) {
  return fetchApi(`/workflow/visits/${visitId}/transfer-requests`, {
    method: 'POST',
    body: JSON.stringify({ bedId }),
  })
}

export function confirmTransferRequest(transferId) {
  return fetchApi(`/workflow/transfers/${transferId}/confirm`, { method: 'POST' })
}
