import { useState } from 'react'
import { UserPlus, X } from 'lucide-react'

import { getRoleDashboardTheme } from '@/theme/roleTheme.js'

const ARRIVAL_MODES = ['À pied', 'Ambulance', 'Brancard', 'Autre']

const emptyForm = {
  firstName: '',
  lastName: '',
  nationalId: '',
  phone: '',
  priority: '3',
  chiefComplaint: '',
  arrivalMode: 'À pied',
}

export function ChiefRegisterPatientModal({ open, onClose, onSubmit, role = 'chief' }) {
  const tone = getRoleDashboardTheme(role)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  if (!open) return null

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
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
      })
      setForm(emptyForm)
      onClose()
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    if (submitting) return
    setError(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        onClick={handleClose}
      />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            <div className={`flex size-9 items-center justify-center rounded-xl ${tone.modalIcon}`}>
              <UserPlus className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Nouveau patient</h2>
              <p className="text-xs font-semibold text-slate-500">Enregistrement aux urgences</p>
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

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
              {error}
            </p>
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
            <span className="text-xs font-bold text-slate-600">CIN / N° national</span>
            <input
              value={form.nationalId}
              onChange={(e) => updateField('nationalId', e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-slate-600">Téléphone</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold text-slate-600">Priorité *</span>
              <select
                value={form.priority}
                onChange={(e) => updateField('priority', e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
              >
                <option value="1">P1 — Critique</option>
                <option value="2">P2 — Urgent</option>
                <option value="3">P3 — Standard</option>
                <option value="4">P4 — Faible</option>
                <option value="5">P5 — Non urgent</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-600">Mode d’arrivée</span>
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

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 rounded-xl py-2.5 text-sm font-extrabold text-white shadow-sm hover:opacity-95 disabled:opacity-60 ${tone.modalButton}`}
            >
              {submitting ? 'Enregistrement…' : 'Enregistrer le patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
