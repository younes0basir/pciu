const BLOCKED = new Set(['maintenance', 'blocked', 'out_of_service'])

export function isBedImmediatelyAvailable(bed) {
  if (!bed || bed.occupied) return false
  const status = bed.operationalStatus || 'ready'
  if (BLOCKED.has(status)) return false
  return status === 'ready'
}

export function bedOperationalLabel(bed) {
  if (bed?.occupied) return 'Occupé'
  const status = bed?.operationalStatus || 'ready'
  const labels = {
    ready: 'Disponible',
    cleaning: 'Nettoyage',
    maintenance: 'Maintenance',
    blocked: 'Bloqué',
    out_of_service: 'Hors service',
  }
  return labels[status] || status
}
