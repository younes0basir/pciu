import { useEffect, useRef } from 'react'

import { getStoredAuth } from '@/api/auth.js'

const API_BASE = import.meta.env.VITE_API_URL || '/api'
const LAST_EVENT_ID_KEY = 'pciu_last_visit_event_id'

function readLastEventId() {
  try {
    const raw = sessionStorage.getItem(LAST_EVENT_ID_KEY)
    const n = Number(raw)
    return Number.isInteger(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

function storeLastEventId(id) {
  try {
    sessionStorage.setItem(LAST_EVENT_ID_KEY, String(id))
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Subscribes to visit_events via SSE and debounces refresh callbacks.
 */
export function useVisitEventStream(onInvalidate, enabled = true) {
  const onInvalidateRef = useRef(onInvalidate)
  onInvalidateRef.current = onInvalidate

  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    const auth = getStoredAuth()
    if (!auth?.token) {
      return undefined
    }

    let es = null
    let debounceTimer = null
    let closed = false

    const scheduleInvalidate = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      debounceTimer = setTimeout(() => {
        onInvalidateRef.current?.()
      }, 400)
    }

    const connect = () => {
      if (closed) {
        return
      }

      const sinceId = readLastEventId()
      const params = new URLSearchParams({ token: auth.token })
      if (sinceId) {
        params.set('sinceId', String(sinceId))
      }

      es = new EventSource(`${API_BASE}/events/stream?${params.toString()}`)

      es.addEventListener('visit_event', (message) => {
        try {
          const payload = JSON.parse(message.data)
          if (payload?.id != null) {
            storeLastEventId(payload.id)
          }
        } catch {
          // still refresh on malformed payloads
        }
        scheduleInvalidate()
      })

      es.onerror = () => {
        es?.close()
        es = null
        if (!closed) {
          setTimeout(connect, 5_000)
        }
      }
    }

    connect()

    return () => {
      closed = true
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      es?.close()
    }
  }, [enabled])
}
