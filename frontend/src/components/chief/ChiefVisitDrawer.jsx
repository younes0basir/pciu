import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { fetchAvailableBeds } from '@/api/visits.js'
import { ChiefConsultationPanel } from '@/components/chief/ChiefConsultationPanel.jsx'
import { NurseTriagePanel } from '@/components/nurse/NurseTriagePanel.jsx'
import { EVENT_LABELS, OUTCOME_LABELS, clinicianLabel, priorityBadgeClass, statusLabel } from '@/components/chief/chiefUtils.js'

const ACTIVE_STATUSES = ['waiting', 'placed', 'in_treatment']

export function ChiefVisitDrawer({
  open,
  loading,
  detail,
  actionBusy,
  onClose,
  clinicians,
  currentUserId,
  roomTeam,
  consultationMode = 'chief',
  allowCall = true,
  allowPlace = true,
  allowReturn = true,
  allowClose = true,
  allowConsultation = true,
  allowTriage = false,
  onCall,
  onPlace,
  onOpenConsultation,
  onSaveConsultation,
  onReturn,
  onCloseVisit,
  onValidateTriage,
}) {
  const [beds, setBeds] = useState([])
  const [bedsLoading, setBedsLoading] = useState(false)
  const [selectedBedId, setSelectedBedId] = useState('')
  const [returnReason, setReturnReason] = useState('')
  const [showCloseForm, setShowCloseForm] = useState(false)
  const [closeOutcome, setCloseOutcome] = useState('discharged')
  const [closeDiagnosis, setCloseDiagnosis] = useState('')
  const [closeNotes, setCloseNotes] = useState('')
  const [actionError, setActionError] = useState(null)

  useEffect(() => {
    if (!open || !detail || detail.status !== 'waiting' || !allowPlace) {
      setBeds([])
      setSelectedBedId('')
      return
    }
    let cancelled = false
    setBedsLoading(true)
    fetchAvailableBeds()
      .then((data) => {
        if (!cancelled) {
          setBeds(data.beds || [])
          if (data.beds?.[0]) setSelectedBedId(String(data.beds[0].bedId))
        }
      })
      .catch(() => {
        if (!cancelled) setBeds([])
      })
      .finally(() => {
        if (!cancelled) setBedsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, detail?.status, detail?.visitId, allowPlace])

  useEffect(() => {
    if (!open) {
      setShowCloseForm(false)
      setReturnReason('')
      setActionError(null)
    }
  }, [open, detail?.visitId])

  if (!open) return null

  const isActive = detail && ACTIVE_STATUSES.includes(detail.status)

  async function runAction(fn) {
    setActionError(null)
    try {
      await fn()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action impossible.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-md"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Fiche visite</p>
            <p className="font-mono text-sm font-extrabold text-slate-900">
              {detail?.publicCode || '…'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-sm font-semibold text-slate-500">Chargement…</p>
          ) : detail ? (
            <div className="space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-extrabold ring-1 ring-inset ${priorityBadgeClass(detail.priority)}`}
                  >
                    P{detail.priority}
                  </span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                    {statusLabel(detail.status)}
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-extrabold text-slate-900">{detail.patient?.fullName}</h2>
                {detail.patient?.nationalId ? (
                  <p className="text-xs font-semibold text-slate-500">CIN : {detail.patient.nationalId}</p>
                ) : null}
                <p className="mt-2 text-sm font-medium text-slate-700">{detail.chiefComplaint}</p>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="font-bold text-slate-500">Arrivée</dt>
                  <dd className="font-semibold text-slate-800">
                    {detail.arrivedAt
                      ? new Date(detail.arrivedAt).toLocaleString('fr-FR')
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-500">Appels</dt>
                  <dd className="font-semibold text-slate-800">{detail.callCount ?? 0}</dd>
                </div>
                {detail.activeBed ? (
                  <div className="col-span-2">
                    <dt className="font-bold text-slate-500">Lit</dt>
                    <dd className="font-semibold text-sky-800">
                      {detail.activeBed.zoneName} · {detail.activeBed.roomName} ·{' '}
                      {detail.activeBed.bedLabel}
                    </dd>
                  </div>
                ) : null}
                {detail.consultation ? (
                  <div className="col-span-2">
                    <dt className="font-bold text-slate-500">Médecin de la consultation</dt>
                    <dd className="font-semibold text-slate-800">
                      {clinicianLabel({
                        firstName: detail.consultation.doctorName,
                        role: detail.consultation.doctorRole,
                      })}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {allowTriage && detail.status === 'waiting' ? (
                <NurseTriagePanel detail={detail} busy={actionBusy} onSave={onValidateTriage} />
              ) : null}

              {allowConsultation &&
              (detail.status === 'placed' || detail.status === 'in_treatment') ? (
                <ChiefConsultationPanel
                  detail={detail}
                  clinicians={clinicians}
                  suggestedDoctorId={roomTeam?.doctor?.id || null}
                  currentUserId={currentUserId}
                  roomTeam={roomTeam}
                  consultationMode={consultationMode}
                  actionBusy={actionBusy}
                  onOpen={onOpenConsultation}
                  onSave={onSaveConsultation}
                />
              ) : null}

              {isActive ? (
                <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-amber-900">
                    Actions parcours
                  </h3>
                  {actionError ? (
                    <p className="text-xs font-semibold text-rose-700">{actionError}</p>
                  ) : null}

                  {detail.status === 'waiting' && (allowCall || allowPlace) ? (
                    <div className="space-y-2">
                      {allowCall ? (
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => runAction(onCall)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-2.5 text-sm font-extrabold text-white hover:bg-sky-700 disabled:opacity-60"
                        >
                          {actionBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                          Appeler le patient
                        </button>
                      ) : null}
                      {allowPlace ? (
                        <div className="rounded-xl border border-amber-200/80 bg-white p-2.5">
                          <label className="block text-xs font-bold text-slate-600">Mettre au lit</label>
                          {bedsLoading ? (
                            <p className="mt-1 text-xs text-slate-500">Chargement des lits…</p>
                          ) : beds.length === 0 ? (
                            <p className="mt-1 text-xs font-semibold text-rose-600">Aucun lit libre.</p>
                          ) : (
                            <select
                              value={selectedBedId}
                              onChange={(e) => setSelectedBedId(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-semibold"
                            >
                              {beds.map((b) => (
                                <option key={b.bedId} value={b.bedId}>
                                  {b.zoneName} · {b.roomName} · {b.bedLabel}
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            type="button"
                            disabled={actionBusy || !selectedBedId || beds.length === 0}
                            onClick={() => runAction(() => onPlace(Number(selectedBedId)))}
                            className="mt-2 w-full rounded-xl bg-emerald-600 py-2 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            Confirmer la mise au lit
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {allowReturn && detail.status === 'placed' ? (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-600">Retour salle d’attente</label>
                      <input
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        placeholder="Motif (optionnel)"
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                      />
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => runAction(() => onReturn(returnReason))}
                        className="w-full rounded-xl border border-slate-300 bg-white py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Retourner en attente
                      </button>
                    </div>
                  ) : null}

                  {allowClose &&
                  (detail.status === 'placed' || detail.status === 'in_treatment') ? (
                    <div className="space-y-2 border-t border-amber-200/80 pt-2">
                      {!showCloseForm ? (
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => setShowCloseForm(true)}
                          className="w-full rounded-xl bg-slate-800 py-2.5 text-sm font-extrabold text-white hover:bg-slate-900 disabled:opacity-60"
                        >
                          Clôturer la visite
                        </button>
                      ) : (
                        <>
                          <label className="block text-xs font-bold text-slate-600">Issue *</label>
                          <select
                            value={closeOutcome}
                            onChange={(e) => setCloseOutcome(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-semibold"
                          >
                            {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <label className="block text-xs font-bold text-slate-600">Diagnostic</label>
                          <input
                            value={closeDiagnosis}
                            onChange={(e) => setCloseDiagnosis(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                          <label className="block text-xs font-bold text-slate-600">Notes</label>
                          <textarea
                            rows={2}
                            value={closeNotes}
                            onChange={(e) => setCloseNotes(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setShowCloseForm(false)}
                              className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-bold text-slate-700"
                            >
                              Annuler
                            </button>
                            <button
                              type="button"
                              disabled={actionBusy}
                              onClick={() =>
                                runAction(() =>
                                  onCloseVisit({
                                    outcome: closeOutcome,
                                    diagnosis: closeDiagnosis.trim() || undefined,
                                    notes: closeNotes.trim() || undefined,
                                  })
                                )
                              }
                              className="flex-1 rounded-xl bg-slate-800 py-2 text-sm font-extrabold text-white disabled:opacity-60"
                            >
                              Confirmer la clôture
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                  Chronologie
                </h3>
                <ol className="mt-3 space-y-3 border-l-2 border-sky-200 pl-4">
                  {detail.timeline?.map((ev) => (
                    <li key={ev.id} className="relative">
                      <span className="absolute -left-[1.35rem] top-1 size-2.5 rounded-full bg-sky-500 ring-2 ring-white" />
                      <p className="text-sm font-extrabold text-slate-900">
                        {EVENT_LABELS[ev.eventType] || ev.eventType}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-500">
                        {new Date(ev.createdAt).toLocaleString('fr-FR')}
                        {ev.actorName ? ` · ${ev.actorName}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : (
            <p className="text-sm font-semibold text-rose-600">Impossible de charger la visite.</p>
          )}
        </div>
      </aside>
    </div>
  )
}
