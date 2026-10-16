import { useCallback, useEffect, useState } from 'react'

import {
  acknowledgeSupervisionAlert,
  evaluateSupervisionAlerts,
  fetchSupervisionAlerts,
  fetchSupervisionBottlenecks,
  fetchSupervisionCoordination,
  fetchSupervisionOverview,
} from '@/api/supervision.js'

export function useSupervisionDashboard({ enabled = true, zone = 'all' } = {}) {
  const [kpis, setKpis] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [bottlenecks, setBottlenecks] = useState([])
  const [coordination, setCoordination] = useState(null)
  const [alertFilter, setAlertFilter] = useState('active')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastSyncAt, setLastSyncAt] = useState(null)

  const reload = useCallback(
    async (isBackground = false) => {
      if (!enabled) return
      if (!isBackground) setLoading(true)
      setError(null)
      try {
        await evaluateSupervisionAlerts().catch(() => {})
        const [overviewRes, alertsRes, bottlenecksRes, coordinationRes] = await Promise.all([
          fetchSupervisionOverview(zone),
          fetchSupervisionAlerts(alertFilter, 50),
          fetchSupervisionBottlenecks(zone),
          fetchSupervisionCoordination(),
        ])
        setKpis(overviewRes?.data?.kpis ?? null)
        setAlerts(alertsRes?.data?.alerts ?? [])
        setBottlenecks(bottlenecksRes?.data?.signals ?? [])
        setCoordination(coordinationRes?.data ?? null)
        setLastSyncAt(new Date().toISOString())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Supervision indisponible')
      } finally {
        if (!isBackground) setLoading(false)
      }
    },
    [enabled, zone, alertFilter],
  )

  useEffect(() => {
    if (!enabled) return undefined
    reload(false)
    return undefined
  }, [enabled, zone, alertFilter, reload])

  const acknowledgeAlert = useCallback(
    async (alertId) => {
      await acknowledgeSupervisionAlert(alertId)
      await reload(true)
    },
    [reload],
  )

  return {
    kpis,
    alerts,
    bottlenecks,
    coordination,
    alertFilter,
    setAlertFilter,
    loading,
    error,
    lastSyncAt,
    reload,
    acknowledgeAlert,
  }
}
