import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Database, Loader2, RotateCcw } from 'lucide-react'

import { fetchDatabaseSnapshot, resetDatabase } from '@/api/adminDatabase.js'

const CUSTOM_DEFAULTS = {
  clearClinical: true,
  clearRoomTeams: true,
  clearResourceEvents: true,
  resetBedStatus: true,
  clearNonAdminStaff: false,
  clearDemoStaffOnly: false,
  reseedDemoStaff: true,
  rebuildInfrastructure: false,
  reseedInfrastructure: true,
  syncAdminFromEnv: true,
}

function StatPill({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-lg font-extrabold text-slate-900">{value ?? '—'}</p>
    </div>
  )
}

export function AdminDatabaseResetPanel({ onToast, onResetComplete }) {
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState('custom')
  const [confirmPhrase, setConfirmPhrase] = useState('')
  const [custom, setCustom] = useState(CUSTOM_DEFAULTS)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const confirmRequired = meta?.confirmPhrase ?? 'REINITIALISER'
  const phraseOk = confirmPhrase.trim() === confirmRequired

  const loadSnapshot = useCallback(async () => {
    const data = await fetchDatabaseSnapshot()
    setMeta(data)
    return data
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadSnapshot()
      .catch((err) => {
        if (!cancelled) {
          onToast(
            'error',
            'Base de données',
            err instanceof Error ? err.message : 'Impossible de lire l’état de la base.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadSnapshot, onToast])

  const snapshot = meta?.snapshot

  const customSummary = useMemo(() => {
    const labels = []
    if (custom.clearClinical) labels.push('visites & patients')
    if (custom.clearRoomTeams) labels.push('équipes de salle')
    if (custom.clearResourceEvents) labels.push('historique lits')
    if (custom.resetBedStatus) labels.push('statut des lits')
    if (custom.clearNonAdminStaff) labels.push('tout le personnel (hors admin)')
    if (custom.clearDemoStaffOnly) labels.push('comptes démo uniquement')
    if (custom.reseedDemoStaff) labels.push('recharger comptes démo')
    if (custom.rebuildInfrastructure) labels.push('reconstruire zones/lits')
    else if (custom.reseedInfrastructure) labels.push('réappliquer zones/lits (upsert)')
    if (custom.syncAdminFromEnv) labels.push('sync admin (.env)')
    return labels
  }, [custom])

  function toggleCustom(key) {
    setCustom((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      if (key === 'clearNonAdminStaff' && next.clearNonAdminStaff) {
        next.clearDemoStaffOnly = false
      }
      if (key === 'clearDemoStaffOnly' && next.clearDemoStaffOnly) {
        next.clearNonAdminStaff = false
      }
      if (key === 'rebuildInfrastructure' && next.rebuildInfrastructure) {
        next.reseedInfrastructure = false
        next.clearClinical = true
      }
      if (key === 'reseedInfrastructure' && next.reseedInfrastructure) {
        next.rebuildInfrastructure = false
      }
      return next
    })
  }

  async function handleReset() {
    if (!phraseOk) return
    setBusy(true)
    try {
      const payload =
        mode === 'full'
          ? { mode: 'full', confirmPhrase: confirmPhrase.trim() }
          : { mode: 'custom', confirmPhrase: confirmPhrase.trim(), options: custom }

      const result = await resetDatabase(payload)
      setConfirmPhrase('')
      await loadSnapshot()
      onResetComplete?.()
      onToast(
        'success',
        mode === 'full' ? 'Base réinitialisée' : 'Réinitialisation appliquée',
        mode === 'full'
          ? 'État initial démo restauré (données cliniques, personnel non-admin, infrastructure).'
          : `Actions : ${customSummary.join(', ') || 'aucune'}.`,
      )
      return result
    } catch (err) {
      onToast('error', 'Réinitialisation impossible', err instanceof Error ? err.message : 'Échec de l’opération.')
    } finally {
      setBusy(false)
    }
  }

  const resetDisabled = busy || !phraseOk || (mode === 'custom' && customSummary.length === 0)

  return (
    <section className="rounded-3xl border border-rose-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-rose-50 p-2 text-rose-600">
                <Database className="size-4" aria-hidden="true" />
              </div>
              <h2 className="text-base font-extrabold text-slate-900">Réinitialisation de la base</h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
              Remet l’environnement de démo à zéro ou applique une purge ciblée. Les comptes administrateur sont
              conservés ; une réinitialisation complète supprime tout le reste du personnel et recharge les comptes
              démo (<span className="font-mono text-xs">password123</span>).
            </p>
            <p className="mt-2 flex items-start gap-2 text-sm font-bold text-amber-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Irréversible — réservé aux environnements de test.
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setMode('full')}
              className={`rounded-2xl px-4 py-2.5 text-sm font-extrabold transition ${
                mode === 'full'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Réinitialisation complète
            </button>
            <button
              type="button"
              onClick={() => setMode('custom')}
              className={`rounded-2xl px-4 py-2.5 text-sm font-extrabold transition ${
                mode === 'custom'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Personnalisée
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm font-bold text-slate-500">Lecture des volumes en base…</p>
        ) : snapshot ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            <StatPill label="Visites" value={snapshot.visits} />
            <StatPill label="Patients" value={snapshot.patients} />
            <StatPill label="Personnel" value={snapshot.users} />
            <StatPill label="Admins" value={snapshot.admin_users} />
            <StatPill label="Lits" value={snapshot.beds} />
            <StatPill label="Événements" value={snapshot.visit_events} />
          </div>
        ) : null}

        {mode === 'full' ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 text-sm font-semibold text-rose-900">
            Supprime toutes les visites et patients, équipes de salle, historique des lits, tout le personnel hors
            admin, reconstruit zones/chambres/lits, recharge les 4 comptes démo et synchronise l’admin depuis{' '}
            <span className="font-mono text-xs">ADMIN_*</span> dans le fichier .env.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ['clearClinical', 'Visites, patients & données liées'],
                ['clearRoomTeams', 'Équipes médecin / infirmiers par salle'],
                ['clearResourceEvents', 'Historique statut des lits'],
                ['resetBedStatus', 'Remettre tous les lits en « prêt »'],
                ['reseedDemoStaff', 'Recharger les 4 comptes démo (upsert)'],
                ['syncAdminFromEnv', 'Synchroniser l’admin depuis .env'],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    checked={custom[key]}
                    onChange={() => toggleCustom(key)}
                    className="size-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500/30"
                  />
                  <span className="text-sm font-bold text-slate-800">{label}</span>
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs font-extrabold text-slate-500 hover:text-slate-800"
            >
              {showAdvanced ? 'Masquer options avancées' : 'Options avancées (personnel & infrastructure)'}
            </button>

            {showAdvanced ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ['clearNonAdminStaff', 'Supprimer tout le personnel (sauf admin)'],
                  ['clearDemoStaffOnly', 'Supprimer uniquement les comptes démo @chu.ma'],
                  ['rebuildInfrastructure', 'Effacer et reconstruire zones, salles et lits'],
                  ['reseedInfrastructure', 'Réappliquer le plan lits par défaut (sans effacer)'],
                ].map(([key, label]) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/40 px-3 py-2.5"
                  >
                    <input
                      type="checkbox"
                      checked={custom[key]}
                      onChange={() => toggleCustom(key)}
                      className="size-4 rounded border-amber-300 text-amber-700 focus:ring-amber-500/30"
                    />
                    <span className="text-sm font-bold text-amber-950">{label}</span>
                  </label>
                ))}
              </div>
            ) : null}

            {customSummary.length > 0 ? (
              <p className="text-xs font-semibold text-slate-500">
                Sera exécuté : {customSummary.join(' · ')}
              </p>
            ) : (
              <p className="text-xs font-bold text-rose-600">Sélectionnez au moins une action.</p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="db-reset-confirm" className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
              Confirmation — saisir {confirmRequired}
            </label>
            <input
              id="db-reset-confirm"
              type="text"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder={confirmRequired}
              className="mt-1.5 w-full max-w-md rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 placeholder:font-semibold placeholder:text-slate-300 focus:border-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-500/20"
            />
          </div>

          <button
            type="button"
            onClick={handleReset}
            disabled={resetDisabled}
            aria-busy={busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}
            {mode === 'full' ? 'Réinitialiser complètement' : 'Appliquer la sélection'}
          </button>
        </div>
      </div>
    </section>
  )
}
