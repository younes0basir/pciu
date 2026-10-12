import { useCallback, useEffect, useState } from 'react'
import { Loader2, Trash2, UserPlus } from 'lucide-react'

import { createDemoArrivals, deleteDemoArrivals, fetchDemoArrivals } from '@/api/adminDemo.js'
import { RolePrimaryButton } from '@/components/layout/RoleDashboardHeader.jsx'

export function AdminDemoArrivalsPanel({ onToast }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const loadSummary = useCallback(async () => {
    const data = await fetchDemoArrivals()
    setSummary(data)
    return data
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadSummary()
      .catch((err) => {
        if (!cancelled) {
          onToast(
            'error',
            'Arrivées fictives',
            err instanceof Error ? err.message : 'Impossible de lire les arrivées fictives.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadSummary, onToast])

  async function handleCreate() {
    setBusy('create')
    setConfirmDelete(false)
    try {
      const result = await createDemoArrivals()
      await loadSummary()
      onToast(
        'success',
        '10 arrivées ajoutées',
        `${result.created} patients fictifs sont en file, à la même heure d’arrivée.`,
      )
    } catch (err) {
      onToast('error', 'Ajout impossible', err instanceof Error ? err.message : 'La création a échoué.')
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete() {
    setBusy('delete')
    try {
      const result = await deleteDemoArrivals()
      setConfirmDelete(false)
      await loadSummary()
      onToast(
        'success',
        'Fictifs supprimés',
        result.visitsDeleted
          ? `${result.visitsDeleted} visite(s) et ${result.patientsDeleted} patient(s) retirés.`
          : 'Aucune arrivée fictive à supprimer.',
      )
    } catch (err) {
      onToast('error', 'Suppression impossible', err instanceof Error ? err.message : 'La suppression a échoué.')
    } finally {
      setBusy(null)
    }
  }

  const fictiveCount = summary?.visits ?? 0
  const deleteDisabled = busy != null || fictiveCount === 0

  return (
    <section className="rounded-3xl border border-purple-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-slate-900">Arrivées fictives</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
            Ajoute 10 patients en attente, tous à la même heure, avec une priorité et un motif tirés au hasard.
            La suppression ne retire que ces enregistrements marqués, y compris s’ils ont déjà été placés.
          </p>
          <p className="mt-2 text-sm font-bold text-purple-800" aria-live="polite">
            {loading
              ? 'Lecture des arrivées fictives…'
              : `${fictiveCount} visite(s) fictive(s) en base${
                  summary?.waiting != null ? ` · ${summary.waiting} encore en attente` : ''
                }`}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <RolePrimaryButton
            role="admin"
            onClick={handleCreate}
            disabled={busy != null}
            aria-busy={busy === 'create'}
            className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'create' ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
            Ajouter 10 arrivées
          </RolePrimaryButton>

          {confirmDelete ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy != null}
                aria-busy={busy === 'delete'}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === 'delete' ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
                Confirmer la suppression
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={busy != null}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-400/30 disabled:opacity-60"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={deleteDisabled}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-extrabold text-rose-800 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Supprimer les fictifs
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
