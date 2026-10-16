import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, UserPlus, X } from 'lucide-react'

import { ConfirmActionDialog } from '@/components/ui/ConfirmActionDialog.jsx'
import { PriorityBadge } from '@/components/ui/StatusBadge.jsx'
import { useRegistrationFlow } from '@/hooks/useRegistrationFlow.js'
import { getRoleDashboardTheme } from '@/theme/roleTheme.js'
import { cn } from '@/lib/utils.js'

const ARRIVAL_MODES = ['À pied', 'Ambulance', 'Brancard', 'Autre']
const STEPS = [
  { id: 1, label: 'Identité' },
  { id: 2, label: 'Signalement' },
  { id: 3, label: 'Confirmation' },
]

const emptyForm = {
  firstName: '',
  lastName: '',
  nationalId: '',
  phone: '',
  priority: '3',
  chiefComplaint: '',
  arrivalMode: 'À pied',
  criticalFlag: false,
}

export function RegisterPatientModal({
  open,
  onClose,
  onSubmit,
  role = 'chief',
  onSuccessCall,
  canCallAfterRegister = false,
  onOpenVisit,
}) {
  const tone = getRoleDashboardTheme(role)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [confirmHighPriority, setConfirmHighPriority] = useState(false)
  const [successResult, setSuccessResult] = useState(null)
  const [callBusy, setCallBusy] = useState(false)

  const flow = useRegistrationFlow({ open: open && !successResult, form })

  useEffect(() => {
    if (!open) {
      setStep(1)
      setForm(emptyForm)
      setError(null)
      setSuccessResult(null)
      setConfirmHighPriority(false)
    }
  }, [open])

  if (!open) return null

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function applyKnownPatient() {
    const p = flow.preflight?.patient
    if (!p) return
    setForm((prev) => ({
      ...prev,
      firstName: p.firstName || prev.firstName,
      lastName: p.lastName || prev.lastName,
      phone: p.phone || prev.phone,
      nationalId: p.nationalId || prev.nationalId,
    }))
  }

  function validateStep(current) {
    if (current === 1) {
      if (!form.firstName.trim() || !form.lastName.trim()) {
        setError('Prénom et nom sont obligatoires.')
        return false
      }
      if (flow.hasBlockingActiveVisit) {
        setError('Une visite est déjà active pour ce patient — ouvrez le dossier existant.')
        return false
      }
    }
    if (current === 2) {
      if (!form.chiefComplaint.trim()) {
        setError('Le motif principal est obligatoire.')
        return false
      }
    }
    setError(null)
    return true
  }

  function goNext() {
    if (!validateStep(step)) return
    if (step === 2) {
      const p = Number(form.priority)
      if (p <= 2) {
        setConfirmHighPriority(true)
        return
      }
    }
    setStep((s) => Math.min(3, s + 1))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!validateStep(3)) return
    if (flow.hasBlockingActiveVisit) {
      setError('Enregistrement impossible : visite active en cours.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const result = await onSubmit({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        nationalId: form.nationalId.trim() || undefined,
        phone: form.phone.trim() || undefined,
        priority: Number(form.priority),
        chiefComplaint: form.chiefComplaint.trim(),
        arrivalMode: form.arrivalMode || undefined,
        criticalFlag: form.criticalFlag,
      })
      setSuccessResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    if (submitting || callBusy) return
    setError(null)
    onClose()
  }

  async function handleCallNow() {
    if (!successResult?.visitId || !onSuccessCall) return
    setCallBusy(true)
    try {
      await onSuccessCall(successResult.visitId)
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Appel impossible.')
    } finally {
      setCallBusy(false)
    }
  }

  const registrationPriority = Number(form.priority) || 3

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
          type="button"
          aria-label="Fermer"
          className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
          onClick={handleClose}
        />
        <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
            <div className="flex items-center gap-2">
              <div className={`flex size-9 items-center justify-center rounded-xl ${tone.modalIcon}`}>
                <UserPlus className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Nouveau patient</h2>
                <p className="text-xs font-semibold text-slate-500">
                  {successResult ? 'Enregistrement réussi' : STEPS.find((s) => s.id === step)?.label}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <X className="size-4" />
            </button>
          </div>

          {!successResult ? (
            <nav aria-label="Étapes d'enregistrement" className="flex gap-1 px-5 pt-3">
              {STEPS.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    'flex-1 rounded-lg py-1.5 text-center text-[11px] font-bold',
                    step === s.id
                      ? 'bg-primary/15 text-primary'
                      : step > s.id
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-slate-100 text-slate-500',
                  )}
                >
                  {s.label}
                </div>
              ))}
            </nav>
          ) : null}

          {successResult ? (
            <div className="space-y-4 px-5 py-6">
              <p className="text-sm font-semibold text-emerald-800">
                Patient enregistré — file triage (
                {flow.triageQueueCount != null ? `${flow.triageQueueCount} en attente` : '—'}).
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold text-slate-500">Code visite</p>
                <p className="text-lg font-mono font-black text-slate-900">{successResult.publicCode}</p>
                <p className="text-xs text-slate-600 mt-1">
                  Étape : triage en attente · signalement accueil P{successResult.priority ?? registrationPriority}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {onOpenVisit ? (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenVisit(successResult.visitId)
                      handleClose()
                    }}
                    className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-white"
                  >
                    Ouvrir le dossier
                  </button>
                ) : null}
                {canCallAfterRegister && onSuccessCall ? (
                  <button
                    type="button"
                    disabled={callBusy}
                    onClick={handleCallNow}
                    className="w-full rounded-xl border border-primary bg-white py-2.5 text-sm font-bold text-primary disabled:opacity-50"
                  >
                    {callBusy ? 'Appel…' : 'Appeler maintenant'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700"
                >
                  Fermer
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={step === 3 ? handleSubmit : (e) => e.preventDefault()} className="space-y-4 px-5 py-4">
              {error ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
                  {error}
                </p>
              ) : null}

              {step === 1 ? (
                <>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-600">CIN / N° national</span>
                    <input
                      value={form.nationalId}
                      onChange={(e) => updateField('nationalId', e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
                      placeholder="Recherche automatique si renseigné"
                    />
                  </label>
                  {flow.preflightLoading ? (
                    <p className="text-xs text-slate-500">Recherche patient…</p>
                  ) : null}
                  {flow.preflightError ? (
                    <p className="text-xs font-semibold text-amber-800">{flow.preflightError}</p>
                  ) : null}
                  {flow.preflight?.patient ? (
                    <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs">
                      <p className="font-bold text-sky-950">
                        Patient connu : {flow.preflight.patient.firstName} {flow.preflight.patient.lastName}
                      </p>
                      <button
                        type="button"
                        onClick={applyKnownPatient}
                        className="mt-1 font-bold text-primary hover:underline"
                      >
                        Reprendre les coordonnées
                      </button>
                    </div>
                  ) : null}
                  {flow.hasBlockingActiveVisit ? (
                    <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900">
                      Visite active : {flow.preflight.activeVisit.publicCode} (
                      {flow.preflight.activeVisit.careStage || flow.preflight.activeVisit.status}). Enregistrement
                      bloqué.
                      {onOpenVisit ? (
                        <button
                          type="button"
                          className="ml-2 underline"
                          onClick={() => {
                            onOpenVisit(flow.preflight.activeVisit.visitId)
                            handleClose()
                          }}
                        >
                          Ouvrir le dossier
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-bold text-slate-600">Prénom *</span>
                      <input
                        required
                        value={form.firstName}
                        onChange={(e) => updateField('firstName', e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-slate-600">Nom *</span>
                      <input
                        required
                        value={form.lastName}
                        onChange={(e) => updateField('lastName', e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-600">Téléphone</span>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
                    />
                  </label>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <p className="text-xs text-slate-600 rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
                    <strong>Signalement à l&apos;accueil</strong> — distinct du triage infirmier. La priorité
                    clinique sera validée au triage.
                  </p>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-600">Motif principal *</span>
                    <textarea
                      required
                      rows={3}
                      value={form.chiefComplaint}
                      onChange={(e) => updateField('chiefComplaint', e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
                      placeholder="Ex. douleur thoracique, traumatisme…"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-bold text-slate-600">Signalement accueil *</span>
                      <select
                        value={form.priority}
                        onChange={(e) => updateField('priority', e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
                      >
                        <option value="1">P1 — Critique (signalement)</option>
                        <option value="2">P2 — Urgent (signalement)</option>
                        <option value="3">P3 — Standard (défaut)</option>
                        <option value="4">P4 — Faible</option>
                        <option value="5">P5 — Non urgent</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-slate-600">Mode d&apos;arrivée</span>
                      <select
                        value={form.arrivalMode}
                        onChange={(e) => updateField('arrivalMode', e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
                      >
                        {ARRIVAL_MODES.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge
                      priority={registrationPriority}
                      priorityValidated={false}
                      registrationPriority={registrationPriority}
                      size="sm"
                    />
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-rose-100 bg-rose-50/80 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={form.criticalFlag}
                      onChange={(e) => updateField('criticalFlag', e.target.checked)}
                      className="mt-1 size-4 rounded border-rose-300"
                    />
                    <span className="text-sm font-semibold text-rose-900">
                      Danger immédiat suspecté (circuit critique — alerte équipe)
                    </span>
                  </label>
                  {flow.hintsLoading ? (
                    <p className="text-xs text-slate-500">Analyse des suggestions…</p>
                  ) : null}
                  {flow.hints.map((hint, idx) => (
                    <p
                      key={`${hint.type}-${idx}`}
                      className={cn(
                        'rounded-xl px-3 py-2 text-xs font-medium',
                        hint.severity === 'warning'
                          ? 'border border-amber-200 bg-amber-50 text-amber-950'
                          : 'border border-sky-200 bg-sky-50 text-sky-950',
                      )}
                    >
                      {hint.message}
                    </p>
                  ))}
                </>
              ) : null}

              {step === 3 ? (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <p className="font-bold text-slate-900">Récapitulatif</p>
                  <p>
                    <span className="text-slate-500">Patient :</span> {form.firstName} {form.lastName}
                    {form.nationalId ? ` · ${form.nationalId}` : ''}
                  </p>
                  <p>
                    <span className="text-slate-500">Motif :</span> {form.chiefComplaint}
                  </p>
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-500">Signalement :</span>
                    <PriorityBadge
                      priority={registrationPriority}
                      priorityValidated={false}
                      registrationPriority={registrationPriority}
                      size="sm"
                    />
                    {form.criticalFlag ? (
                      <span className="text-xs font-bold text-rose-700">Circuit critique coché</span>
                    ) : null}
                  </p>
                  <p>
                    <span className="text-slate-500">Arrivée :</span> {form.arrivalMode}
                  </p>
                </div>
              ) : null}

              <div className="flex gap-2 pt-2">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <ChevronLeft className="size-4" />
                    Retour
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                )}
                {step < 3 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={step === 1 && flow.hasBlockingActiveVisit}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-sm font-extrabold text-white disabled:opacity-50',
                      tone.modalButton,
                    )}
                  >
                    Suivant
                    <ChevronRight className="size-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting || flow.hasBlockingActiveVisit}
                    className={cn(
                      'flex-1 rounded-xl py-2.5 text-sm font-extrabold text-white disabled:opacity-60',
                      tone.modalButton,
                    )}
                  >
                    {submitting ? 'Enregistrement…' : 'Confirmer l’enregistrement'}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>

      <ConfirmActionDialog
        open={confirmHighPriority}
        title="Signalement P1 / P2 à l'accueil"
        description="Ce niveau est un signalement initial uniquement. La priorité clinique sera confirmée par l'infirmier de triage. Continuer ?"
        confirmLabel="Continuer"
        variant="warning"
        onCancel={() => setConfirmHighPriority(false)}
        onConfirm={() => {
          setConfirmHighPriority(false)
          setStep(3)
        }}
      />
    </>
  )
}
