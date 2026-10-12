import { useCallback, useEffect, useState } from 'react'
import { Activity, Loader2 } from 'lucide-react'

import { fetchCapacity } from '@/api/careFlow.js'

const TONE = {
  normal: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  high_load: 'border-amber-200 bg-amber-50 text-amber-950',
  saturated: 'border-rose-200 bg-rose-50 text-rose-950',
}

const LABEL = {
  normal: 'Charge normale',
  high_load: 'Charge élevée',
  saturated: 'Service saturé',
}

export function CapacityBanner() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const payload = await fetchCapacity()
      setData(payload)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load])

  if (loading && !data) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Calcul de la charge…
      </p>
    )
  }

  if (!data) return null

  const tone = TONE[data.loadStatus] || TONE.normal
  const m = data.metrics || {}

  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${tone}`}>
      <Activity className="size-5 shrink-0 opacity-80" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold">{LABEL[data.loadStatus] || data.loadStatus}</p>
        <p className="text-xs font-medium opacity-90">
          {m.readyFreeBeds ?? 0} ressource(s) prête(s) libre(s) · {m.waitingCare ?? 0} en attente soins ·{' '}
          {m.dispositionPending ?? 0} en boarding · {m.p1p2Active ?? 0} P1/P2 actifs
        </p>
      </div>
    </div>
  )
}
