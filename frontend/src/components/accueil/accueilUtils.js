import { formatDuration } from '@/components/chief/chiefUtils.js'

export function waitMinutesSince(arrivedAt) {
  if (!arrivedAt) return null
  const minutes = Math.floor((Date.now() - new Date(arrivedAt).getTime()) / 60000)
  return Math.max(0, minutes)
}

export function medianMinutes(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2)
  }
  return sorted[mid]
}

export function computeAccueilStats(waiting) {
  const uncalled = waiting.filter((v) => !v.isCalled)
  const called = waiting.filter((v) => v.isCalled)
  const priority12 = waiting.filter((v) => v.priority <= 2).length
  const waitTimes = waiting
    .map((v) => waitMinutesSince(v.arrivedAt))
    .filter((m) => m != null)

  return {
    total: waiting.length,
    uncalled: uncalled.length,
    called: called.length,
    priority12,
    medianWaitMinutes: medianMinutes(waitTimes),
  }
}

export function filterAccueilWaiting(
  waiting,
  { search, priorityMax, statusFilter }
) {
  const q = search.trim().toLowerCase()
  return waiting.filter((v) => {
    if (priorityMax != null && v.priority > priorityMax) return false
    if (statusFilter === 'uncalled' && v.isCalled) return false
    if (statusFilter === 'called' && !v.isCalled) return false
    if (!q) return true
    const hay = [v.publicCode, v.patientName, v.nationalId, v.chiefComplaint]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

export function boardVisitToCard(visit) {
  return {
    visitId: visit.visitId,
    publicCode: visit.publicCode,
    priority: visit.priority,
    patientName: visit.patientName,
    chiefComplaint: visit.chiefComplaint,
    queuePosition: visit.queuePosition,
    minutesInStep: waitMinutesSince(visit.arrivedAt),
    callCount: visit.callCount ?? 0,
    isCalled: visit.isCalled,
  }
}

export { formatDuration }
