import { useCallback, useEffect, useState } from 'react'
import { ClipboardCheck, Loader2, Sparkles } from 'lucide-react'

import {
  fetchAiRecommendations,
  fetchAiStatus,
  patchAiRecommendation,
  requestTriageRecommend,
} from '@/api/ai.js'
import { priorityBadgeClass } from '@/components/chief/chiefUtils.js'

const PRIORITY_HINTS = {
  1: 'Réanimation / vital menacé',
  2: 'Très urgent',
  3: 'Urgent',
  4: 'Standard',
  5: 'Non urgent',
}

export function NurseTriagePanel({ detail, busy, onSave }) {
  const [priority, setPriority] = useState('3')
  const [note, setNote] = useState('')
  const [localError, setLocalError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [suggestion, setSuggestion] = useState(null)
  const [recommendationId, setRecommendationId] = useState(null)

  const loadAiState = useCallback(async () => {
    if (!detail?.visitId) return
    try {
      const settings = await fetchAiStatus()
      const on =
        settings.platformEnabled &&
        settings.serviceEnabled &&
        settings.effectiveMode !== 'disabled' &&
        settings.agentFlags?.triage
      setAiEnabled(on)
      if (!on) return
      const recs = await fetchAiRecommendations({ visitId: detail.visitId, status: 'pending' })
      const triageRec = (recs.recommendations || []).find((r) => r.recommendationType === 'triage')
      if (triageRec) {
        setSuggestion(triageRec.payload)
        setRecommendationId(triageRec.id)
      }
    } catch {
      setAiEnabled(false)
    }
  }, [detail?.visitId])

  useEffect(() => {
    setPriority(String(detail?.priority ?? 3))
    setNote('')
    setLocalError(null)
    setSaved(false)
    setSuggestion(null)
    setRecommendationId(null)
    setAiError(null)
    loadAiState()
  }, [detail?.visitId, detail?.priority, loadAiState])

  const triageOpen =
    detail &&
    detail.status === 'waiting' &&
    (!detail.careStage || ['triage_pending', 'waiting_care', 'registered'].includes(detail.careStage))

  if (!triageOpen) return null

  async function fetchSuggestion() {
    setAiError(null)
    setAiBusy(true)
    try {
      const result = await requestTriageRecommend(detail.visitId)
      setSuggestion(result.output)
      setRecommendationId(result.recommendation?.id ?? null)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Suggestion IA indisponible.')
    } finally {
      setAiBusy(false)
    }
  }

  async function acceptSuggestion() {
    if (!suggestion?.suggested_priority) return
    setPriority(String(suggestion.suggested_priority))
    if (recommendationId) {
      try {
        await patchAiRecommendation(recommendationId, { status: 'accepted' })
      } catch {
        // human triage still required
      }
    }
  }

  async function rejectSuggestion() {
    if (recommendationId) {
      await patchAiRecommendation(recommendationId, { status: 'rejected' })
    }
    setSuggestion(null)
    setRecommendationId(null)
  }

  async function submit(event) {
    event.preventDefault()
    setLocalError(null)
    setSaved(false)
    const value = Number(priority)
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      setLocalError('Choisissez une priorité entre 1 et 5.')
      return
    }
    try {
      await onSave({ priority: value, note: note.trim() || undefined })
      if (recommendationId) {
        const status =
          suggestion && Number(suggestion.suggested_priority) === value ? 'accepted' : 'modified'
        await patchAiRecommendation(recommendationId, { status, humanDecision: 'recordTriage' }).catch(
          () => {},
        )
      }
      setSaved(true)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Enregistrement impossible.')
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-sky-200 bg-gradient-to-b from-sky-50 to-white p-4 shadow-xs"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm">
          <ClipboardCheck className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">Validation triage</h3>
          <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-600">
            Confirmez ou corrigez la priorité avant placement au lit.
          </p>
        </div>
      </div>

      {aiEnabled ? (
        <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-extrabold text-violet-950">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Suggestion IA
            </p>
            <button
              type="button"
              disabled={aiBusy}
              onClick={fetchSuggestion}
              className="text-[11px] font-extrabold text-violet-700 underline-offset-2 hover:underline disabled:opacity-60"
            >
              {aiBusy ? <Loader2 className="size-3.5 animate-spin" /> : 'Actualiser'}
            </button>
          </div>
          {aiError ? <p className="mt-1 text-[11px] font-semibold text-rose-700">{aiError}</p> : null}
          {suggestion ? (
            <div className="mt-2 space-y-1 text-[11px] font-semibold text-slate-700">
              <p>
                Priorité proposée :{' '}
                <span
                  className={`rounded px-1.5 py-0.5 ${priorityBadgeClass(suggestion.suggested_priority)}`}
                >
                  P{suggestion.suggested_priority}
                </span>
                {suggestion.confidence != null ? (
                  <span className="ml-1 text-slate-500">
                    ({Math.round(Number(suggestion.confidence) * 100)} %)
                  </span>
                ) : null}
              </p>
              {suggestion.rationale ? <p className="text-slate-600">{suggestion.rationale}</p> : null}
              {suggestion.missing_information?.length ? (
                <p className="text-amber-800">
                  Manques : {suggestion.missing_information.join(' · ')}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={acceptSuggestion}
                  className="rounded-lg bg-violet-700 px-2 py-1 text-[10px] font-extrabold text-white"
                >
                  Appliquer au formulaire
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={rejectSuggestion}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-extrabold text-slate-600"
                >
                  Rejeter
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-slate-500">Aucune suggestion — le triage manuel reste disponible.</p>
          )}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500">Priorité actuelle</span>
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-extrabold ring-1 ring-inset ${priorityBadgeClass(detail.priority)}`}
        >
          P{detail.priority}
        </span>
      </div>

      <label className="mt-3 block text-xs font-extrabold text-slate-700" htmlFor="nurse-triage-priority">
        Priorité retenue
      </label>
      <select
        id="nurse-triage-priority"
        value={priority}
        onChange={(event) => setPriority(event.target.value)}
        className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-xs outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
      >
        {[1, 2, 3, 4, 5].map((level) => (
          <option key={level} value={String(level)}>
            P{level} — {PRIORITY_HINTS[level]}
          </option>
        ))}
      </select>

      <label className="mt-3 block text-xs font-extrabold text-slate-700" htmlFor="nurse-triage-note">
        Note infirmier (optionnel)
      </label>
      <textarea
        id="nurse-triage-note"
        rows={2}
        maxLength={500}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Signes vitaux, reclassification, contexte…"
        className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 shadow-xs outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
      />

      {localError ? <p className="mt-3 text-xs font-semibold text-rose-700">{localError}</p> : null}
      {saved ? (
        <p className="mt-3 text-xs font-semibold text-emerald-700">Priorité enregistrée.</p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-sm font-extrabold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Valider le triage
      </button>
    </form>
  )
}
