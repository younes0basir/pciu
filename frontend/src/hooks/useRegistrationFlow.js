import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchRegisterHints, fetchRegisterPreflight } from '@/api/visits.js'

const PREFLIGHT_DEBOUNCE_MS = 450

export function useRegistrationFlow({ open, form }) {
  const [preflight, setPreflight] = useState(null)
  const [preflightLoading, setPreflightLoading] = useState(false)
  const [preflightError, setPreflightError] = useState(null)
  const [hints, setHints] = useState([])
  const [hintsLoading, setHintsLoading] = useState(false)
  const preflightTimer = useRef(null)

  const runPreflight = useCallback(async (nationalId) => {
    const cin = String(nationalId || '').trim()
    if (!cin) {
      setPreflight(null)
      setPreflightError(null)
      return
    }
    setPreflightLoading(true)
    setPreflightError(null)
    try {
      const data = await fetchRegisterPreflight(cin)
      setPreflight(data)
    } catch (err) {
      setPreflight(null)
      setPreflightError(err instanceof Error ? err.message : 'Recherche patient impossible')
    } finally {
      setPreflightLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setPreflight(null)
      setPreflightError(null)
      setHints([])
      return undefined
    }
    if (preflightTimer.current) clearTimeout(preflightTimer.current)
    preflightTimer.current = setTimeout(() => {
      runPreflight(form.nationalId)
    }, PREFLIGHT_DEBOUNCE_MS)
    return () => {
      if (preflightTimer.current) clearTimeout(preflightTimer.current)
    }
  }, [open, form.nationalId, runPreflight])

  useEffect(() => {
    if (!open) return undefined
    const complaint = form.chiefComplaint?.trim()
    if (!complaint && !form.arrivalMode) {
      setHints([])
      return undefined
    }
    let cancelled = false
    setHintsLoading(true)
    fetchRegisterHints({
      chiefComplaint: complaint || '',
      arrivalMode: form.arrivalMode || '',
      registrationPriority: Number(form.priority) || 3,
    })
      .then((data) => {
        if (!cancelled) setHints(data.suggestions || [])
      })
      .catch(() => {
        if (!cancelled) setHints([])
      })
      .finally(() => {
        if (!cancelled) setHintsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, form.chiefComplaint, form.arrivalMode, form.priority])

  const hasBlockingActiveVisit = Boolean(preflight?.activeVisit)

  return {
    preflight,
    preflightLoading,
    preflightError,
    hints,
    hintsLoading,
    hasBlockingActiveVisit,
    triageQueueCount: preflight?.queue?.triageQueueCount ?? null,
  }
}
