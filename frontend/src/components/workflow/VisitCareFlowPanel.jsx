import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowRightLeft, BedDouble, Loader2, Stethoscope } from 'lucide-react'

import { fetchAvailableBeds } from '@/api/visits.js'
import { CARE_STAGE_LABELS } from '@/components/chief/chiefUtils.js'

export function VisitCareFlowPanel({
  detail,
  actionBusy,
  allowCritical = false,
  allowTransfer = false,
  allowObservation = false,
  allowCompleteDeparture = false,
  onSetCritical,
  onTransfer,
  onStartObservation,
  onEndObservation,
  onCompleteDeparture,
}) {
  const [transferBedId, setTransferBedId] = useState('')
  const [beds, setBeds] = useState([])
  const [bedsLoading, setBedsLoading] = useState(false)
  const [localError, setLocalError] = useState(null)

  const careStage = detail?.careStage
  const isActive = detail && detail.status !== 'discharged' && careStage !== 'completed'

  useEffect(() => {
    if (!detail?.visitId || !allowTransfer || !detail.activeBed) {
      setBeds([])
      return
    }
    let cancelled = false
    setBedsLoading(true)
    fetchAvailableBeds()
      .then((data) => {
        if (!cancelled) {
          setBeds(data.beds || [])
          if (data.beds?.[0]) setTransferBedId(String(data.beds[0].bedId))
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
  }, [detail?.visitId, detail?.activeBed?.bedId, allowTransfer])

  if (!isActive) return null

  async function run(fn) {
    setLocalError(null)
    try {
      await fn()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Action impossible.')
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/50 p-3">
      <h3 className="text-xs font-extrabold uppercase tracking-wide text-violet-900">
        Parcours V3
      </h3>
      {careStage ? (
        <p className="text-xs font-semibold text-violet-800">
          Étape : {CARE_STAGE_LABELS[careStage] || careStage}
          {detail.criticalFlag ? ' · Signalé critique' : ''}
          {detail.outcome ? ` · Décision : ${detail.outcome}` : ''}
        </p>
      ) : null}
      {localError ? <p className="text-xs font-semibold text-rose-700">{localError}</p> : null}

      {allowCritical ? (
        <button
          type="button"
          disabled={actionBusy}
          onClick={() =>
            run(() => onSetCritical?.(!detail.criticalFlag))
          }
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-extrabold ${
            detail.criticalFlag
              ? 'border border-rose-300 bg-white text-rose-800'
              : 'bg-rose-600 text-white hover:bg-rose-700'
          } disabled:opacity-60`}
        >
          {actionBusy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <AlertTriangle className="size-4" />
          )}
          {detail.criticalFlag ? 'Retirer le signal critique' : 'Signaler urgence critique'}
        </button>
      ) : null}

      {allowTransfer && detail.activeBed ? (
        <div className="rounded-xl border border-violet-200/80 bg-white p-2.5">
          <label className="flex items-center gap-1 text-xs font-bold text-slate-600">
            <ArrowRightLeft className="size-3.5" />
            Transférer vers une autre ressource
          </label>
          {bedsLoading ? (
            <p className="mt-1 text-xs text-slate-500">Chargement…</p>
          ) : beds.length === 0 ? (
            <p className="mt-1 text-xs font-semibold text-amber-700">Aucune ressource prête libre.</p>
          ) : (
            <select
              value={transferBedId}
              onChange={(e) => setTransferBedId(e.target.value)}
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
            disabled={actionBusy || !transferBedId}
            onClick={() => run(() => onTransfer?.(Number(transferBedId)))}
            className="mt-2 w-full rounded-xl bg-violet-700 py-2 text-sm font-extrabold text-white disabled:opacity-60"
          >
            Confirmer le transfert
          </button>
        </div>
      ) : null}

      {allowObservation && (careStage === 'in_care' || careStage === 'in_observation') ? (
        <div className="flex gap-2">
          {careStage === 'in_care' ? (
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => run(onStartObservation)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-2 text-sm font-extrabold text-slate-800 disabled:opacity-60"
            >
              <Stethoscope className="size-4" />
              Observation
            </button>
          ) : (
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => run(onEndObservation)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 py-2 text-sm font-extrabold text-white disabled:opacity-60"
            >
              Fin observation
            </button>
          )}
        </div>
      ) : null}

      {allowCompleteDeparture && careStage === 'disposition_pending' ? (
        <button
          type="button"
          disabled={actionBusy}
          onClick={() => run(onCompleteDeparture)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2.5 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {actionBusy ? <Loader2 className="size-4 animate-spin" /> : <BedDouble className="size-4" />}
          Confirmer le départ des urgences
        </button>
      ) : null}
    </div>
  )
}
