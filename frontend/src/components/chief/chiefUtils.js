export const OUTCOME_LABELS = {
  discharged: 'Sortie',
  transferred: 'Transfert',
  left_without_seen: 'Parti sans être vu',
}

export const EVENT_LABELS = {
  registered: 'Enregistrement',
  called: 'Appel',
  placed: 'Mise au lit',
  consultation_started: 'Consultation démarrée',
  consultation_updated: 'Consultation complétée',
  closed: 'Clôture',
  returned: 'Retour salle d’attente',
  triage_validated: 'Triage validé',
}

export function personInitials(person) {
  const first = person?.firstName?.trim()?.[0] || '?'
  const last = person?.lastName?.trim()?.[0] || ''
  return `${first}${last}`.toUpperCase()
}

export function clinicianLabel(person) {
  if (!person) return '—'
  const name = `${person.firstName || ''} ${person.lastName || ''}`.trim()
  if (person.role === 'chief') return `${name} · Chef`
  if (person.role === 'doctor' && !/^dr\.?\s/i.test(name)) return `Dr ${name}`
  return name
}

export function formatDuration(minutes) {
  if (minutes == null) return '—'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} h ${m} min` : `${h} h`
}

export function priorityBadgeClass(priority) {
  switch (priority) {
    case 1:
      return 'bg-rose-100 text-rose-800 ring-rose-200'
    case 2:
      return 'bg-orange-100 text-orange-800 ring-orange-200'
    case 3:
      return 'bg-amber-100 text-amber-800 ring-amber-200'
    case 4:
      return 'bg-sky-100 text-sky-800 ring-sky-200'
    case 5:
      return 'bg-slate-100 text-slate-700 ring-slate-200'
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200'
  }
}

export function statusLabel(status) {
  const map = {
    waiting: 'En attente',
    placed: 'Au lit',
    in_treatment: 'En prise en charge',
    discharged: 'Sortie',
    transferred: 'Transfert',
    left_without_seen: 'Parti sans être vu',
  }
  return map[status] || status
}

export const PIPELINE_STAGE_LABELS = {
  waitingUncalled: 'Attente · non appelé',
  waitingCalled: 'Attente · appelé',
  placed: 'Au lit',
  inTreatment: 'En prise en charge',
}

export const STUCK_FILTER_OPTIONS = [
  { id: 'all', label: 'Tous les patients' },
  { id: 'any_stuck', label: 'Blocages (SLA)' },
  { id: 'called_no_bed', label: 'Appelé > SLA sans lit' },
  { id: 'placed_no_start', label: 'Au lit > SLA sans consult.' },
  { id: 'long_wait_uncalled', label: 'Attente non appelée > SLA' },
  { id: 'long_treatment', label: 'Consultation > SLA' },
]

export function stuckBadgeClass(level) {
  if (level === 'critical') return 'bg-rose-100 text-rose-800 ring-rose-300'
  if (level === 'warning') return 'bg-amber-100 text-amber-900 ring-amber-300'
  return ''
}

export function matchesStuckFilter(visit, stuckFilter) {
  if (!stuckFilter || stuckFilter === 'all') return true
  if (stuckFilter === 'any_stuck') return visit.stuckLevel && visit.stuckLevel !== 'none'
  return visit.stuckKind === stuckFilter
}

export function filterChiefVisits(visits, { search, priorityMax, zoneName, stuckFilter }) {
  const q = search.trim().toLowerCase()
  return visits.filter((v) => {
    if (priorityMax != null && v.priority > priorityMax) return false
    if (zoneName && zoneName !== 'all') {
      if (zoneName === '__none__') {
        if (v.zoneName) return false
      } else if (v.zoneName !== zoneName) {
        return false
      }
    }
    if (!matchesStuckFilter(v, stuckFilter)) return false
    if (!q) return true
    const hay = [v.publicCode, v.patientName, v.nationalId, v.chiefComplaint]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

export function exportClosedTodayCsv(rows) {
  const headers = [
    'Code',
    'Patient',
    'Priorité',
    'Issue',
    'Arrivée',
    'Clôture',
    'Porte-médecin (min)',
    'Porte-sortie (min)',
    'Motif',
  ]
  const lines = rows.map((v) => [
    v.publicCode,
    `"${(v.patientName || '').replace(/"/g, '""')}"`,
    `P${v.priority}`,
    OUTCOME_LABELS[v.outcome] || v.outcome || v.status,
    v.arrivedAt ? new Date(v.arrivedAt).toLocaleString('fr-FR') : '',
    v.closedAt ? new Date(v.closedAt).toLocaleString('fr-FR') : '',
    v.minutesDoorToDoctor ?? '',
    v.minutesDoorToDischarge ?? '',
    `"${(v.chiefComplaint || '').replace(/"/g, '""')}"`,
  ])
  const csv = '\uFEFF' + [headers.join(';'), ...lines.map((r) => r.join(';'))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `picu_clotures_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
