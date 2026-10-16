import { useEffect, useMemo, useState } from 'react'
import { BedDouble, Loader2, Sparkles } from 'lucide-react'

import { applyPipelinePlacement, fetchAiStatus, requestPipelinePlacementPlan } from '@/api/ai.js'
import { sortWaitingQueue } from '@/components/chief/chiefUtils.js'

function placementButtonState({ aiReady, ordered, staffedAssignableBeds, unstaffedFreeBeds }) {
  const head = ordered[0]
  const slots = Math.min(ordered.length, staffedAssignableBeds)
  if (aiReady === false) {
    return {
      disabled: true,
      label: 'Routage IA inactif',
      hint: 'Activez l’agent « Routage lits » pour affecter la file depuis ce bouton.',
    }
  }
  if (!head) {
    return {
      disabled: true,
      label: 'File vide',
      hint: 'Aucun patient en attente.',
    }
  }
  if (staffedAssignableBeds <= 0 && unstaffedFreeBeds > 0) {
    return {
      disabled: true,
      label: 'Salles sans équipe',
      hint: `${head.patientName} reste N1. ${unstaffedFreeBeds} lit(s) libre(s) sans médecin et infirmier — complétez « Équipes & salles ».`,
      needsTeams: true,
    }
  }
  if (staffedAssignableBeds <= 0) {
    return {
      disabled: true,
      label: 'Capacité pleine — N1 attend',
      hint: `${head.patientName} reste N1. Le suivant ne passe en tête qu’après une entrée au lit.`,
    }
  }
  const promoted = ordered[slots]
  return {
    disabled: aiReady == null,
    label: slots === 1 ? 'Affecter N1 au lit' : `Affecter N1 à N${slots}`,
    hint: promoted
      ? `${staffedAssignableBeds} lit(s) libre(s) avec équipe. ${promoted.patientName} (N${slots + 1}) deviendra N1.`
      : `${staffedAssignableBeds} lit(s) libre(s) avec équipe. La file d’attente sera vidée.`,
  }
}

const SOURCE_LABEL = {
  ia: 'Proposition IA',
  mixte: 'IA, ordre de file conservé',
  ordre: 'Ordre et capacité',
}

export function ChiefPipelinePlacement({
  waiting,
  staffedAssignableBeds,
  unstaffedFreeBeds,
  capacityTick,
  onApplied,
  onOpenAi,
  onOpenTeams,
  bare = false,
}) {
  const ordered = useMemo(() => sortWaitingQueue(waiting), [waiting])
  const [aiReady, setAiReady] = useState(null)
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState(null)
  const [resultNote, setResultNote] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchAiStatus()
      .then((status) => {
        if (cancelled) return
        const enabled =
          Boolean(status?.serviceEnabled) &&
          status?.effectiveMode !== 'disabled' &&
          Boolean(status?.agentFlags?.bedFlow)
        setAiReady(enabled)
      })
      .catch(() => {
        if (!cancelled) setAiReady(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setPlan(null)
    setError(null)
  }, [capacityTick, ordered.length, staffedAssignableBeds, unstaffedFreeBeds])

  const button = placementButtonState({
    aiReady,
    ordered,
    staffedAssignableBeds,
    unstaffedFreeBeds,
  })

  async function loadPlan() {
    setError(null)
    setResultNote(null)
    setBusy(true)
    try {
      const next = await requestPipelinePlacementPlan()
      setPlan(next)
    } catch (err) {
      setPlan(null)
      setError(err instanceof Error ? err.message : 'Proposition indisponible.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmPlan() {
    if (!plan?.placements?.length) return
    setError(null)
    setBusy(true)
    try {
      const applied = await applyPipelinePlacement({
        recommendationId: plan.recommendationId,
        runId: plan.runId,
        placements: plan.placements.map((item) => ({
          visitId: item.visitId,
          bedId: item.bedId,
          patientName: item.patientName,
          bedLabel: item.bedLabel,
          zoneName: item.zoneName,
        })),
      })
      setPlan(null)
      const names = applied.placed.map((item) => item.patientName).filter(Boolean)
      const head = applied.nextHead
      setResultNote(
        head
          ? `${names.join(', ') || 'Patients'} au lit. ${head.patientName} devient N1.`
          : `${names.join(', ') || 'Patients'} au lit. La file d’attente est vide.`,
      )
      if (applied.failed) {
        setError(applied.failed.message)
      }
      await onApplied?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Affectation impossible.')
    } finally {
      setBusy(false)
    }
  }

  const showAiAction = aiReady === false
  const showTeamsAction = Boolean(button.needsTeams)
  const secondaryBtn =
    'inline-flex min-h-9 items-center justify-center rounded-lg border border-border bg-surface px-3.5 text-xs font-semibold text-text-primary transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'

  return (
    <div
      className={
        bare
          ? 'w-full'
          : 'rounded-3xl border border-slate-200/70 bg-white/85 p-4 shadow-sm shadow-slate-300/25 backdrop-blur-sm'
      }
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Sparkles className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary">Affectation intelligente</p>
            <p id="pipeline-placement-hint" className="mt-0.5 text-xs leading-relaxed text-text-secondary">
              {button.hint}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {showAiAction ? (
            <button type="button" onClick={onOpenAi} className={secondaryBtn}>
              Activer le routage IA
            </button>
          ) : null}
          {showTeamsAction ? (
            <button type="button" onClick={onOpenTeams} className={secondaryBtn}>
              Compléter les équipes
            </button>
          ) : null}
          {!showAiAction && !showTeamsAction ? (
            <button
              type="button"
              disabled={button.disabled || busy}
              aria-describedby="pipeline-placement-hint"
              onClick={loadPlan}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-white transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {busy && !plan ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <BedDouble className="size-3.5" aria-hidden="true" />
              )}
              {busy && !plan ? 'Calcul…' : button.label}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-2.5 text-xs font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
      {resultNote ? (
        <p role="status" className="mt-2.5 text-xs font-semibold text-emerald-700">
          {resultNote}
        </p>
      ) : null}

      {plan ? (
        <div className="mt-3 space-y-2.5 rounded-lg border border-border bg-surface-muted/40 p-3" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              {SOURCE_LABEL[plan.source] || 'Proposition'}
            </span>
            <p className="text-xs font-medium text-text-secondary">{plan.summary}</p>
          </div>
          {plan.warning ? <p className="text-xs font-semibold text-amber-800">{plan.warning}</p> : null}

          {plan.placements?.length ? (
            <ul className="space-y-1.5">
              {plan.placements.map((item) => (
                <li
                  key={item.visitId}
                  className="flex flex-col gap-1 rounded-lg border border-border bg-surface px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-xs font-bold text-text-primary">
                    N{item.rank} · {item.patientName}{' '}
                    <span className="font-semibold text-text-secondary">P{item.priority}</span>
                  </p>
                  <p className="text-xs font-medium text-text-secondary">
                    {item.zoneName} · {item.roomName} · {item.bedLabel}
                    {item.doctorName ? ` · ${item.doctorName}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="rounded-lg bg-surface px-3 py-2 text-xs font-medium text-text-secondary">
            {plan.nextNote}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPlan(null)}
              disabled={busy}
              className={secondaryBtn}
            >
              Annuler
            </button>
            {plan.placements?.length ? (
              <button
                type="button"
                onClick={confirmPlan}
                disabled={busy}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
                Valider l’affectation
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
