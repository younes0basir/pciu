import { useEffect, useState } from 'react'
import { ClipboardCheck, Loader2 } from 'lucide-react'

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

  useEffect(() => {
    setPriority(String(detail?.priority ?? 3))
    setNote('')
    setLocalError(null)
    setSaved(false)
  }, [detail?.visitId, detail?.priority])

  if (!detail || detail.status !== 'waiting') return null

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
