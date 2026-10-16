import { AlertTriangle, BedDouble, CheckCircle2, Clock, Wrench, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils.js'

export const PRIORITY_CONFIG = {
  1: {
    label: 'P1 - Réanimation',
    short: 'P1',
    badge: 'bg-rose-100 text-rose-900 border-rose-300 ring-1 ring-rose-400/40',
    dot: 'bg-rose-600',
    desc: 'Prise en charge immédiate',
  },
  2: {
    label: 'P2 - Très urgent',
    short: 'P2',
    badge: 'bg-orange-100 text-orange-950 border-orange-300 ring-1 ring-orange-400/40',
    dot: 'bg-orange-600',
    desc: 'Délai maximal 15-20 min',
  },
  3: {
    label: 'P3 - Urgent',
    short: 'P3',
    badge: 'bg-amber-100 text-amber-950 border-amber-300 ring-1 ring-amber-400/40',
    dot: 'bg-amber-500',
    desc: 'Délai maximal 60 min',
  },
  4: {
    label: 'P4 - Moins urgent',
    short: 'P4',
    badge: 'bg-sky-100 text-sky-950 border-sky-300 ring-1 ring-sky-400/40',
    dot: 'bg-sky-500',
    desc: 'Délai maximal 120 min',
  },
  5: {
    label: 'P5 - Non urgent',
    short: 'P5',
    badge: 'bg-slate-100 text-slate-800 border-slate-300 ring-1 ring-slate-400/40',
    dot: 'bg-slate-500',
    desc: 'Délai maximal 240 min',
  },
}

export function PriorityBadge({
  priority,
  displayPriority,
  priorityValidated = true,
  registrationPriority,
  criticalFlag = false,
  showLabel = false,
  size = 'md',
  className = '',
}) {
  const p = Number(displayPriority ?? priority)
  const config = PRIORITY_CONFIG[p] || {
    label: `P${priority ?? '?'}`,
    short: `P${priority ?? '?'}`,
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
    desc: 'Non défini',
  }

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-0.5 gap-1.5',
    lg: 'text-sm px-2.5 py-1 gap-2',
  }[size] || 'text-xs px-2 py-0.5 gap-1.5'

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <span
        className={cn(
          'inline-flex items-center font-black tracking-tight rounded-md border font-mono transition-colors shadow-2xs',
          config.badge,
          sizeClasses,
          className
        )}
        title={`${config.label} (${config.desc})`}
        aria-label={`${config.label}: ${config.desc}`}
      >
        <span className={cn('size-1.5 rounded-full shrink-0', config.dot)} aria-hidden="true" />
        <span>{showLabel ? config.label : config.short}</span>
      </span>
      {!priorityValidated ? (
        <span
          className="inline-flex items-center rounded-md border border-dashed border-violet-400 bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-900"
          title={
            registrationPriority != null
              ? `Signalement accueil P${registrationPriority} — triage clinique non validé`
              : 'Priorité initiale non validée — triage clinique requis'
          }
        >
          Non validé
        </span>
      ) : null}
      {criticalFlag ? (
        <span
          className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-black uppercase text-white shadow-2xs tracking-wider"
          title="Patient en situation critique - Attention immédiate requise"
        >
          <AlertTriangle className="size-3" aria-hidden="true" />
          CRITIQUE
        </span>
      ) : null}
    </div>
  )
}

export const CARE_STAGE_LABELS = {
  registered: 'Enregistré',
  triage_pending: 'À trier',
  waiting_care: 'Attente soins',
  in_care: 'En soins',
  in_observation: 'Observation',
  disposition_pending: 'Disposition',
  completed: 'Terminé',
}

export const VISIT_STATUS_LABELS = {
  waiting: 'En attente',
  placed: 'Au lit',
  in_treatment: 'En consultation',
  discharged: 'Sorti',
  transferred: 'Transféré',
  left_without_seen: 'Parti sans être vu (LWBS)',
}

export function PatientStatusBadge({ status, careStage, size = 'sm', className = '' }) {
  let label = CARE_STAGE_LABELS[careStage] || VISIT_STATUS_LABELS[status] || status || 'Inconnu'
  let tone = 'bg-slate-100 text-slate-700 border-slate-200'

  if (careStage === 'triage_pending') {
    tone = 'bg-amber-50 text-amber-900 border-amber-200 font-bold'
  } else if (careStage === 'waiting_care') {
    tone = 'bg-sky-50 text-sky-900 border-sky-200 font-semibold'
  } else if (careStage === 'in_care' || status === 'in_treatment') {
    tone = 'bg-emerald-50 text-emerald-900 border-emerald-200 font-semibold'
  } else if (careStage === 'in_observation') {
    tone = 'bg-indigo-50 text-indigo-900 border-indigo-200 font-semibold'
  } else if (careStage === 'disposition_pending') {
    tone = 'bg-purple-50 text-purple-900 border-purple-200 font-semibold'
  } else if (status === 'discharged' || status === 'transferred') {
    tone = 'bg-slate-100 text-slate-600 border-slate-200'
  }

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  }[size] || 'text-[11px] px-2 py-0.5'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border font-medium tracking-tight',
        tone,
        sizeClasses,
        className
      )}
    >
      {label}
    </span>
  )
}

export const OPERATIONAL_STATUS_CONFIG = {
  ready: { label: 'Prêt', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  available: { label: 'Prêt', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  cleaning: { label: 'Nettoyage en cours', tone: 'bg-amber-50 text-amber-800 border-amber-300', icon: Clock },
  maintenance: { label: 'Maintenance', tone: 'bg-orange-50 text-orange-800 border-orange-200', icon: Wrench },
  blocked: { label: 'Bloqué', tone: 'bg-rose-50 text-rose-800 border-rose-200', icon: XCircle },
  out_of_service: { label: 'Hors service', tone: 'bg-slate-200 text-slate-700 border-slate-300', icon: XCircle },
}

export function ResourceStatusBadge({ operationalStatus = 'ready', occupied = false, className = '' }) {
  const op = OPERATIONAL_STATUS_CONFIG[operationalStatus] || OPERATIONAL_STATUS_CONFIG.ready
  const Icon = op.icon

  return (
    <div className={cn('inline-flex items-center gap-1.5 flex-wrap text-xs', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-medium text-[11px]',
          occupied ? 'bg-slate-100 text-slate-800 border-slate-300' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
        )}
      >
        <BedDouble className="size-3" aria-hidden="true" />
        {occupied ? 'Occupé' : 'Libre'}
      </span>

      <span
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-medium',
          op.tone
        )}
        title={`Statut opérationnel: ${op.label}`}
      >
        <Icon className="size-3" aria-hidden="true" />
        {op.label}
      </span>
    </div>
  )
}
