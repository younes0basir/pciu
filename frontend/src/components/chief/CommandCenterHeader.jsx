import { UserPlus } from 'lucide-react'

export function CommandCenterHeader({ onRegister, streamStale = false, lastSyncLabel = null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface p-4 rounded-2xl border border-border shadow-2xs">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-lg sm:text-xl font-black text-text-primary">Supervision des Urgences</h1>
          <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[11px] font-bold">
            Command Center
          </span>
        </div>
        <p className="text-xs text-text-secondary mt-0.5">
          Coordination en temps réel des parcours, flux de lits et alertes opérationnelles.
        </p>
        {streamStale ? (
          <p className="text-xs font-semibold text-amber-700 mt-1" role="status">
            Connexion interrompue — données potentiellement anciennes
            {lastSyncLabel ? ` (dernière synchro ${lastSyncLabel})` : ''}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onRegister}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition active:scale-[0.98]"
        >
          <UserPlus className="size-4" aria-hidden />
          <span>Nouveau patient</span>
        </button>
      </div>
    </div>
  )
}
