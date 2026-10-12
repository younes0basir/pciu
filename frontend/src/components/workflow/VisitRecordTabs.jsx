import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { fetchVisitExams, fetchVisitTriageHistory, completeExam, requestExam } from '@/api/careFlow.js'
import { CARE_STAGE_LABELS, EVENT_LABELS, clinicianLabel } from '@/components/chief/chiefUtils.js'

const TABS = [
  { id: 'summary', label: 'Résumé' },
  { id: 'triage', label: 'Triage' },
  { id: 'exams', label: 'Examens' },
  { id: 'movements', label: 'Mouvements' },
  { id: 'history', label: 'Historique' },
]

const MOVEMENT_EVENTS = new Set([
  'placed',
  'returned',
  'resource_transferred',
  'resource_assigned',
  'resource_released',
  'observation_started',
  'observation_ended',
])

const EXAM_TYPE_LABELS = {
  lab: 'Biologie',
  imaging: 'Imagerie',
  ecg: 'ECG',
  other: 'Autre',
}

export function VisitRecordTabs({
  detail,
  allowExamActions = false,
  actionBusy = false,
  onAfterMutation,
}) {
  const [tab, setTab] = useState('summary')
  const [triage, setTriage] = useState(null)
  const [exams, setExams] = useState(null)
  const [loadingExtra, setLoadingExtra] = useState(false)
  const [examLabel, setExamLabel] = useState('')
  const [examType, setExamType] = useState('lab')
  const [localError, setLocalError] = useState(null)

  const visitId = detail?.visitId

  const loadTriage = useCallback(async () => {
    if (!visitId) return
    setLoadingExtra(true)
    try {
      setTriage(await fetchVisitTriageHistory(visitId))
    } catch {
      setTriage([])
    } finally {
      setLoadingExtra(false)
    }
  }, [visitId])

  const loadExams = useCallback(async () => {
    if (!visitId) return
    setLoadingExtra(true)
    try {
      setExams(await fetchVisitExams(visitId))
    } catch {
      setExams([])
    } finally {
      setLoadingExtra(false)
    }
  }, [visitId])

  useEffect(() => {
    if (tab === 'triage') loadTriage()
    if (tab === 'exams') loadExams()
  }, [tab, loadTriage, loadExams])

  const movements = useMemo(
    () => (detail?.timeline || []).filter((ev) => MOVEMENT_EVENTS.has(ev.eventType)),
    [detail?.timeline],
  )

  async function submitExamRequest(event) {
    event.preventDefault()
    if (!visitId || !examLabel.trim()) return
    setLocalError(null)
    try {
      await requestExam(visitId, { label: examLabel.trim(), examType })
      setExamLabel('')
      await loadExams()
      onAfterMutation?.()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Demande impossible.')
    }
  }

  async function submitExamComplete(examId, summary) {
    setLocalError(null)
    try {
      await completeExam(examId, { resultSummary: summary })
      await loadExams()
      onAfterMutation?.()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Enregistrement impossible.')
    }
  }

  if (!detail) return null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
              tab === t.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {localError ? <p className="text-xs font-semibold text-rose-700">{localError}</p> : null}

      {tab === 'summary' ? (
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="font-bold text-slate-500">Étape de soins</dt>
            <dd className="font-semibold text-slate-800">
              {CARE_STAGE_LABELS[detail.careStage] || detail.careStage || '—'}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-slate-500">Orientation</dt>
            <dd className="font-semibold text-slate-800">{detail.orientation || '—'}</dd>
          </div>
          <div>
            <dt className="font-bold text-slate-500">Arrivée</dt>
            <dd className="font-semibold text-slate-800">
              {detail.arrivedAt ? new Date(detail.arrivedAt).toLocaleString('fr-FR') : '—'}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-slate-500">Appels</dt>
            <dd className="font-semibold text-slate-800">{detail.callCount ?? 0}</dd>
          </div>
          {detail.activeBed ? (
            <div className="col-span-2">
              <dt className="font-bold text-slate-500">Ressource</dt>
              <dd className="font-semibold text-sky-800">
                {detail.activeBed.zoneName} · {detail.activeBed.roomName} ·{' '}
                {detail.activeBed.bedLabel}
                {detail.activeBed.operationalStatus &&
                detail.activeBed.operationalStatus !== 'ready'
                  ? ` (${detail.activeBed.operationalStatus})`
                  : ''}
              </dd>
            </div>
          ) : null}
          {detail.consultation ? (
            <div className="col-span-2">
              <dt className="font-bold text-slate-500">Médecin</dt>
              <dd className="font-semibold text-slate-800">
                {clinicianLabel({
                  firstName: detail.consultation.doctorName,
                  role: detail.consultation.doctorRole,
                })}
              </dd>
            </div>
          ) : null}
          {detail.dispositionDecidedAt ? (
            <div className="col-span-2">
              <dt className="font-bold text-slate-500">Décision</dt>
              <dd className="font-semibold text-slate-800">
                {detail.outcome || '—'} ·{' '}
                {new Date(detail.dispositionDecidedAt).toLocaleString('fr-FR')}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {tab === 'triage' ? (
        <div className="space-y-2">
          {loadingExtra && triage === null ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" /> Chargement…
            </p>
          ) : triage?.length ? (
            triage.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <p className="font-extrabold text-slate-900">
                  P{row.priority} · {row.assessmentType}
                </p>
                <p className="text-slate-600">
                  {new Date(row.performedAt).toLocaleString('fr-FR')}
                  {row.performedByName ? ` · ${row.performedByName}` : ''}
                </p>
                {row.clinicalNote ? <p className="mt-1 text-slate-700">{row.clinicalNote}</p> : null}
                {row.orientation ? (
                  <p className="mt-0.5 font-semibold text-violet-800">Orientation : {row.orientation}</p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Aucune évaluation de triage enregistrée.</p>
          )}
        </div>
      ) : null}

      {tab === 'exams' ? (
        <div className="space-y-3">
          {allowExamActions && detail.careStage !== 'completed' ? (
            <form onSubmit={submitExamRequest} className="rounded-xl border border-sky-200 bg-sky-50/50 p-3">
              <p className="text-xs font-bold text-sky-900">Demander un examen</p>
              <input
                value={examLabel}
                onChange={(e) => setExamLabel(e.target.value)}
                placeholder="Ex. NFS, radio thorax…"
                className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-semibold"
              >
                {Object.entries(EXAM_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={actionBusy || !examLabel.trim()}
                className="mt-2 w-full rounded-xl bg-sky-700 py-2 text-sm font-extrabold text-white disabled:opacity-60"
              >
                Créer la demande
              </button>
            </form>
          ) : null}
          {loadingExtra && exams === null ? (
            <p className="text-sm text-slate-500">Chargement…</p>
          ) : exams?.length ? (
            exams.map((exam) => (
              <div key={exam.id} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-extrabold text-slate-900">{exam.label}</p>
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-bold text-slate-700">
                    {exam.status}
                  </span>
                </div>
                <p className="text-slate-500">
                  {EXAM_TYPE_LABELS[exam.examType] || exam.examType} ·{' '}
                  {new Date(exam.requestedAt).toLocaleString('fr-FR')}
                </p>
                {exam.resultSummary ? (
                  <p className="mt-1 font-medium text-emerald-900">{exam.resultSummary}</p>
                ) : null}
                {allowExamActions && exam.status === 'pending' ? (
                  <button
                    type="button"
                    disabled={actionBusy}
                    className="mt-2 rounded-lg border border-emerald-300 px-2 py-1 text-[11px] font-bold text-emerald-800"
                    onClick={() => {
                      const summary = window.prompt('Résumé du résultat (optionnel)') || ''
                      void submitExamComplete(exam.id, summary)
                    }}
                  >
                    Marquer résultat reçu
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Aucun examen pour cette visite.</p>
          )}
        </div>
      ) : null}

      {tab === 'movements' ? (
        <ol className="space-y-3 border-l-2 border-violet-200 pl-4">
          {movements.length ? (
            movements.map((ev) => (
              <li key={ev.id} className="relative text-xs">
                <span className="absolute -left-[1.35rem] top-1 size-2.5 rounded-full bg-violet-500 ring-2 ring-white" />
                <p className="font-extrabold text-slate-900">
                  {EVENT_LABELS[ev.eventType] || ev.eventType}
                </p>
                <p className="font-semibold text-slate-500">
                  {new Date(ev.createdAt).toLocaleString('fr-FR')}
                  {ev.actorName ? ` · ${ev.actorName}` : ''}
                </p>
              </li>
            ))
          ) : (
            <p className="text-sm text-slate-500">Aucun mouvement enregistré.</p>
          )}
        </ol>
      ) : null}

      {tab === 'history' ? (
        <ol className="space-y-3 border-l-2 border-sky-200 pl-4">
          {detail.timeline?.map((ev) => (
            <li key={ev.id} className="relative text-xs">
              <span className="absolute -left-[1.35rem] top-1 size-2.5 rounded-full bg-sky-500 ring-2 ring-white" />
              <p className="font-extrabold text-slate-900">
                {EVENT_LABELS[ev.eventType] || ev.eventType}
              </p>
              <p className="font-semibold text-slate-500">
                {new Date(ev.createdAt).toLocaleString('fr-FR')}
                {ev.actorName ? ` · ${ev.actorName}` : ''}
              </p>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
