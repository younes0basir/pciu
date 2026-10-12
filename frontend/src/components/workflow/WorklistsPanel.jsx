import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'

import { fetchWorklists } from '@/api/careFlow.js'
import { priorityBadgeClass } from '@/components/chief/chiefUtils.js'

const TABS = [
  { id: 'triage', label: 'À trier', key: 'triage' },
  { id: 'care', label: 'Attente soins', key: 'care' },
  { id: 'inCare', label: 'En soins', key: 'inCare' },
  { id: 'observation', label: 'Observation', key: 'observation' },
  { id: 'disposition', label: 'Disposition', key: 'disposition' },
  { id: 'reassessment', label: 'À réévaluer', key: 'reassessment' },
  { id: 'exams', label: 'Examens / résultats', key: 'exams' },
]

const CARE_STAGE_LABELS = {
  triage_pending: 'Triage',
  waiting_care: 'Attente soins',
  in_care: 'En soins',
  in_observation: 'Observation',
  disposition_pending: 'Disposition',
}

function VisitRow({ row, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(row.visitId)}
      className="flex w-full items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left shadow-xs transition hover:border-primary/40"
    >
      <span
        className={`mt-0.5 shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold ${priorityBadgeClass(row.priority)}`}
      >
        P{row.priority}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-foreground">{row.patientName}</span>
          <span className="text-xs font-mono text-muted-foreground">{row.publicCode}</span>
          {row.criticalFlag ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-800">
              <AlertTriangle className="size-3" aria-hidden />
              Critique
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{row.chiefComplaint}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {CARE_STAGE_LABELS[row.careStage] || row.careStage}
          {row.pendingExams != null ? ` · ${row.pendingExams} examen(s) en attente` : ''}
          {row.bedLabel ? ` · ${row.bedLabel}` : ''}
          {row.zoneName ? ` (${row.zoneName})` : ''}
        </p>
      </div>
    </button>
  )
}

export function WorklistsPanel({ onSelectVisit }) {
  const [data, setData] = useState(null)
  const [activeTab, setActiveTab] = useState('triage')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const lists = await fetchWorklists()
      setData(lists)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Worklists indisponibles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const tab = TABS.find((t) => t.id === activeTab) ?? TABS[0]
  const rows = data?.[tab.key] ?? []

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-foreground">Worklists V3</h2>
          <p className="text-sm text-muted-foreground">Vues calculées — aucune position stockée.</p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Actualiser
        </button>
      </div>

      {error ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const count = data?.[t.key]?.length ?? 0
          const active = t.id === activeTab
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground border border-border'
              }`}
            >
              {t.label}
              <span className="ml-1 opacity-80">({count})</span>
            </button>
          )
        })}
      </div>

      <div className="space-y-2">
        {loading && !data ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun patient dans cette liste.</p>
        ) : (
          rows.map((row) => (
            <VisitRow key={row.visitId} row={row} onSelect={onSelectVisit} />
          ))
        )}
      </div>
    </section>
  )
}
