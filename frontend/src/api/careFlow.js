import { fetchApi } from '@/api.js'

export function fetchVisitTriageHistory(visitId) {
  return fetchApi(`/care/visits/${visitId}/triage-history`)
}

export function fetchVisitExams(visitId) {
  return fetchApi(`/care/visits/${visitId}/exams`)
}

export function requestExam(visitId, payload) {
  return fetchApi(`/care/visits/${visitId}/exams`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function completeExam(examId, payload) {
  return fetchApi(`/care/exams/${examId}/complete`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchWorklists(params = {}) {
  const qs = new URLSearchParams()
  if (params.reassessmentMinutes != null) {
    qs.set('reassessmentMinutes', String(params.reassessmentMinutes))
  }
  const suffix = qs.toString() ? `?${qs}` : ''
  return fetchApi(`/queue/worklists${suffix}`)
}

export function fetchCapacity() {
  return fetchApi('/care/capacity')
}

export function recordVisitTriage(visitId, payload) {
  return fetchApi(`/care/visits/${visitId}/triage`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function setVisitCritical(visitId, critical, note) {
  return fetchApi(`/care/visits/${visitId}/critical`, {
    method: 'POST',
    body: JSON.stringify({ critical, note }),
  })
}

export function startObservation(visitId) {
  return fetchApi(`/care/visits/${visitId}/observation/start`, { method: 'POST', body: '{}' })
}

export function endObservation(visitId) {
  return fetchApi(`/care/visits/${visitId}/observation/end`, { method: 'POST', body: '{}' })
}

export function decideDisposition(visitId, outcome) {
  return fetchApi(`/care/visits/${visitId}/disposition`, {
    method: 'POST',
    body: JSON.stringify({ outcome }),
  })
}

export function completeVisitDeparture(visitId, payload = {}) {
  return fetchApi(`/care/visits/${visitId}/complete`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function transferVisitBed(visitId, bedId) {
  return fetchApi(`/care/visits/${visitId}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ bedId }),
  })
}

export function setBedOperationalStatus(bedId, operationalStatus, note) {
  return fetchApi(`/care/resources/${bedId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ operationalStatus, note }),
  })
}
