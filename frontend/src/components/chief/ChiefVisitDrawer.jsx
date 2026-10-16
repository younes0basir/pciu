import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  Loader2,
  PhoneCall,
  RotateCcw,
  X,
} from 'lucide-react'
import { fetchAvailableBeds } from '@/api/visits.js'
import { ChiefConsultationPanel } from '@/components/chief/ChiefConsultationPanel.jsx'
import { NurseTriagePanel } from '@/components/nurse/NurseTriagePanel.jsx'
import { PriorityBadge, PatientStatusBadge } from '@/components/ui/StatusBadge.jsx'
import { OUTCOME_LABELS } from '@/components/chief/chiefUtils.js'
import { VisitCareFlowPanel } from '@/components/workflow/VisitCareFlowPanel.jsx'
import { VisitRecordTabs } from '@/components/workflow/VisitRecordTabs.jsx'
import { VisitDocumentationAiPanel } from '@/components/workflow/VisitDocumentationAiPanel.jsx'
import { VisitBedFlowAiPanel } from '@/components/workflow/VisitBedFlowAiPanel.jsx'
import { EligibleResourcePicker } from '@/components/resources/EligibleResourcePicker.jsx'
import { ConfirmActionDialog } from '@/components/ui/ConfirmActionDialog.jsx'
import { cn } from '@/lib/utils.js'

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
  allowCareFlow = false,
  allowCritical = false,
  allowTransfer = false,
  allowObservation = false,
  allowCompleteDeparture = false,
  onSetCritical,
  onTransfer,
  onStartObservation,
  onEndObservation,
  onCompleteDeparture,
  onCall,
  onPlace,
  onOpenConsultation,
  onSaveConsultation,
  onReturn,
  onCloseVisit,
  onValidateTriage,
  allowExamActions = false,
  onRecordMutated,
}) {
  const [beds, setBeds] = useState([])
  const [bedsLoading, setBedsLoading] = useState(false)
  const [selectedBedId, setSelectedBedId] = useState('')
  const [returnReason, setReturnReason] = useState('')
  const [showCloseForm, setShowCloseForm] = useState(false)
  const [showReturnConfirm, setShowReturnConfirm] = useState(false)
  const [closeOutcome, setCloseOutcome] = useState('discharged')
  const [closeDiagnosis, setCloseDiagnosis] = useState('')
  const [closeNotes, setCloseNotes] = useState('')
  const [actionError, setActionError] = useState(null)
  const [actionSuccess, setActionSuccess] = useState(null)
  const [isConflict409, setIsConflict409] = useState(false)
  const closeBtnRef = useRef(null)

  // Fetch available beds when visit is waiting
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
          const bedList = data.beds || []
          setBeds(bedList)
          if (bedList[0]) setSelectedBedId(String(bedList[0].bedId))
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

  // Reset state on close or visit change
  useEffect(() => {
    if (!open) {
      setShowCloseForm(false)
      setShowReturnConfirm(false)
      setReturnReason('')
      setActionError(null)
      setActionSuccess(null)
      setIsConflict409(false)
    }
  }, [open, detail?.visitId])

  // Escape key handler
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !actionBusy) {
        if (showCloseForm) setShowCloseForm(false)
        else if (showReturnConfirm) setShowReturnConfirm(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    closeBtnRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, actionBusy, showCloseForm, showReturnConfirm, onClose])

  if (!open) return null

  const isActive = detail && ACTIVE_STATUSES.includes(detail.status)

  async function runAction(fn, successMsg = 'Opération enregistrée.') {
    setActionError(null)
    setActionSuccess(null)
    setIsConflict409(false)
    try {
      await fn()
      setActionSuccess(successMsg)
      setTimeout(() => setActionSuccess(null), 4000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action impossible.'
      const is409 = msg.includes('409') || msg.toLowerCase().includes('conflit') || msg.toLowerCase().includes('occupé')
      setIsConflict409(is409)
      setActionError(
        is409
          ? 'Conflit de concurrence (HTTP 409) : cette ressource a été modifiée par une autre session. Les données ont été actualisées, veuillez vérifier puis réessayer.'
          : msg
      )
      if (is409 && onRecordMutated) {
        onRecordMutated()
      }
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-patient-name"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={!actionBusy ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Drawer Surface */}
      <aside className="relative flex h-full w-full max-w-xl flex-col border-l border-border bg-surface shadow-2xl transition-all">
        {/* 1. STICKY TOP HEADER */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface/95 px-5 py-3.5 backdrop-blur-md">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-black text-text-primary bg-surface-muted px-2 py-0.5 rounded border border-border">
                {detail?.publicCode || '…'}
              </span>
              {detail ? (
                <>
                  <PriorityBadge
                    priority={detail.priority}
                    displayPriority={detail.displayPriority ?? detail.priority}
                    priorityValidated={detail.priorityValidated !== false}
                    registrationPriority={detail.registrationPriority}
                    criticalFlag={detail.criticalFlag}
                    size="sm"
                  />
                  <PatientStatusBadge
                    careStage={detail.careStage}
                    status={detail.status}
                    size="sm"
                  />
                </>
              ) : null}
            </div>
            <h2
              id="drawer-patient-name"
              className="mt-1 text-base font-extrabold text-text-primary truncate"
            >
              {detail?.patient?.fullName || 'Dossier patient'}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              disabled={actionBusy}
              title="Fermer le tiroir (Échap)"
              aria-label="Fermer"
              className="flex size-8 items-center justify-center rounded-xl border border-border text-text-secondary hover:bg-surface-muted hover:text-text-primary disabled:opacity-50"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* FEEDBACK BANNERS (Conflict, Error, Success) */}
        {actionError ? (
          <div className={cn(
            'px-5 py-2.5 text-xs font-semibold border-b flex items-center justify-between gap-2',
            isConflict409 ? 'bg-amber-50 text-amber-950 border-amber-300' : 'bg-rose-50 text-rose-950 border-rose-200'
          )}>
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="size-4 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-text-secondary hover:text-text-primary text-[11px] font-bold"
            >
              Fermer
            </button>
          </div>
        ) : null}

        {actionSuccess ? (
          <div className="px-5 py-2 text-xs font-semibold bg-emerald-50 text-emerald-900 border-b border-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        ) : null}

        {/* 2. MAIN SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading ? (
            <div className="py-16 text-center text-xs text-text-secondary animate-pulse">
              <Loader2 className="size-6 animate-spin mx-auto text-primary mb-2" />
              Chargement du dossier patient…
            </div>
          ) : detail ? (
            <div className="space-y-5">
              {/* Patient Basic Identity & Complaint Box */}
              <div className="rounded-xl border border-border bg-surface-muted/30 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
                  <span>
                    CIN : <strong>{detail.patient?.nationalId || 'Non renseigné'}</strong>
                  </span>
                  <span>
                    Arrivée :{' '}
                    <strong>
                      {detail.arrivedAt ? new Date(detail.arrivedAt).toLocaleTimeString('fr-FR') : '—'}
                    </strong>
                  </span>
                  {detail.activeBed ? (
                    <span className="font-bold text-text-primary flex items-center gap-1">
                      <BedDouble className="size-3 text-primary" />
                      {detail.activeBed.zoneName} · {detail.activeBed.bedLabel}
                    </span>
                  ) : null}
                </div>

                <div className="mt-2.5 pt-2 border-t border-border/60">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                    Motif de consultation / Plainte principale
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-text-primary leading-relaxed">
                    {detail.chiefComplaint || 'Aucun motif renseigné'}
                  </p>
                </div>
              </div>

              {/* Triage Panel (if nurse / allowed) */}
              {allowTriage && detail.status === 'waiting' ? (
                <div className="rounded-xl border border-border p-3.5 bg-surface">
                  <NurseTriagePanel detail={detail} busy={actionBusy} onSave={onValidateTriage} />
                </div>
              ) : null}

              {/* AI Clinical Documentation Panel */}
              {allowConsultation && detail?.visitId ? (
                <VisitDocumentationAiPanel visitId={detail.visitId} disabled={false} />
              ) : null}

              {/* Care Flow Panel (Critical, Transfer, Observation, Departure) */}
              {allowCareFlow ? (
                <VisitCareFlowPanel
                  detail={detail}
                  actionBusy={actionBusy}
                  allowCritical={allowCritical}
                  allowTransfer={allowTransfer}
                  allowObservation={allowObservation}
                  allowCompleteDeparture={allowCompleteDeparture}
                  onSetCritical={onSetCritical}
                  onTransfer={onTransfer}
                  onStartObservation={onStartObservation}
                  onEndObservation={onEndObservation}
                  onCompleteDeparture={onCompleteDeparture}
                />
              ) : null}

              {/* Clinician Consultation Panel */}
              {allowConsultation &&
              (detail.status === 'placed' ||
                detail.status === 'in_treatment' ||
                (detail.status === 'waiting' && detail.criticalFlag)) ? (
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

              {/* Record Tabs: Triage History, Exams, Movements */}
              <VisitRecordTabs
                detail={detail}
                allowExamActions={allowExamActions}
                actionBusy={actionBusy}
                onAfterMutation={onRecordMutated}
              />
            </div>
          ) : (
            <p className="py-12 text-center text-sm font-semibold text-rose-600">
              Impossible de charger le dossier de cette visite.
            </p>
          )}
        </div>

        {/* 3. STICKY CONTEXTUAL ACTION BAR AT BOTTOM */}
        {isActive && detail ? (
          <div className="sticky bottom-0 z-20 border-t border-border bg-surface/95 p-3.5 backdrop-blur-md shadow-lg space-y-2">
            {/* CALL PATIENT (Waiting status) */}
            {detail.status === 'waiting' && allowCall ? (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => runAction(onCall, 'Patient appelé.')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-sky-700 disabled:opacity-60 transition"
              >
                {actionBusy ? <Loader2 className="size-4 animate-spin" /> : <PhoneCall className="size-4" />}
                {detail.callCount > 0
                  ? `Rappeler le patient (${detail.callCount} appel(s) déjà émis)`
                  : 'Appeler le patient'}
              </button>
            ) : null}

            {/* PLACE TO BED (Waiting status) */}
            {detail.status === 'waiting' && allowPlace ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <BedDouble className="size-3.5 text-emerald-700" />
                    Assignation de lit
                  </label>
                  {bedsLoading ? (
                    <span className="text-[11px] text-text-secondary flex items-center gap-1">
                      <Loader2 className="size-3 animate-spin" /> Recherche lits…
                    </span>
                  ) : null}
                </div>

                <VisitBedFlowAiPanel visitId={detail.visitId} disabled={false} />

                {bedsLoading ? null : beds.length === 0 ? (
                  <EligibleResourcePicker
                    visitId={detail.visitId}
                    selectedBedId={selectedBedId}
                    onSelect={(s) => setSelectedBedId(String(s.bedId))}
                    onConfirm={(bedId) =>
                      runAction(() => onPlace(Number(bedId)), 'Patient placé au lit.')
                    }
                    confirmBusy={actionBusy}
                  />
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={selectedBedId}
                      onChange={(e) => setSelectedBedId(e.target.value)}
                      className="flex-1 rounded-xl border border-emerald-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-text-primary focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {beds.map((b) => (
                        <option key={b.bedId} value={b.bedId}>
                          {b.zoneName} · {b.roomName} · {b.bedLabel}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={actionBusy || !selectedBedId}
                      onClick={() =>
                        runAction(() => onPlace(Number(selectedBedId)), 'Patient placé au lit.')
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-60 shrink-0"
                    >
                      {actionBusy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                      Confirmer
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {/* RETURN TO WAITING (Placed status) */}
            {detail.status === 'placed' && allowReturn ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Motif de retour en attente (optionnel)"
                  className="flex-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs text-text-primary placeholder:text-text-secondary/70 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => setShowReturnConfirm(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-bold text-text-secondary hover:bg-surface-muted hover:text-text-primary disabled:opacity-50 shrink-0"
                >
                  <RotateCcw className="size-3.5" />
                  Retour attente
                </button>
              </div>
            ) : null}

            {/* CLOSE VISIT (Waiting, Placed, In Treatment) */}
            {allowClose && !showCloseForm ? (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setShowCloseForm(true)}
                className="w-full rounded-xl border border-border bg-surface-muted px-4 py-2 text-xs font-bold text-text-primary hover:bg-slate-200 transition"
              >
                Clôturer la visite (Sortie / Transfert)
              </button>
            ) : null}

            {showCloseForm ? (
              <div className="rounded-xl border border-border bg-surface-muted/50 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-text-primary">
                    Clôture de la visite
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCloseForm(false)}
                    className="text-text-secondary hover:text-text-primary text-xs font-semibold"
                  >
                    Annuler
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary mb-1">
                      Issue clinique *
                    </label>
                    <select
                      value={closeOutcome}
                      onChange={(e) => setCloseOutcome(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs font-semibold text-text-primary"
                    >
                      {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary mb-1">
                      Diagnostic principal
                    </label>
                    <input
                      type="text"
                      value={closeDiagnosis}
                      onChange={(e) => setCloseDiagnosis(e.target.value)}
                      placeholder="Diagnostic de sortie"
                      className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-secondary mb-1">
                    Notes cliniques de sortie
                  </label>
                  <textarea
                    rows={2}
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                    placeholder="Instructions de sortie, prescriptions, ordonnance..."
                    className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text-primary"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCloseForm(false)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-muted"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() =>
                      runAction(async () => {
                        await onCloseVisit({
                          outcome: closeOutcome,
                          diagnosis: closeDiagnosis.trim() || undefined,
                          notes: closeNotes.trim() || undefined,
                        })
                        setShowCloseForm(false)
                      }, 'Visite clôturée.')
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-black disabled:opacity-50"
                  >
                    {actionBusy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    Confirmer la clôture
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </aside>

      {/* Confirmation Dialog for Return to Waiting */}
      <ConfirmActionDialog
        open={showReturnConfirm}
        title="Retourner le patient en salle d'attente ?"
        description={`Le lit ${detail?.activeBed?.bedLabel || ''} sera libéré et le patient réintégrera la file d'attente.`}
        confirmLabel="Confirmer le retour"
        variant="warning"
        busy={actionBusy}
        onCancel={() => setShowReturnConfirm(false)}
        onConfirm={async () => {
          await runAction(() => onReturn(returnReason), 'Patient retourné en salle d\'attente.')
          setShowReturnConfirm(false)
        }}
      />
    </div>
  )
}
