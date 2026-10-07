import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { checkBackendHealth } from '@/api.js'
import { fetchClinicianWorkspace } from '@/api/clinician.js'
import { getHomeRouteForRole, getStoredAuth, logout } from '@/api/auth.js'
import {
  closeVisit,
  fetchVisitDetails,
  placeVisit,
  returnVisitToWaiting,
  saveVisitConsultation,
  startVisitConsultation,
  updateVisitPriority,
} from '@/api/visits.js'

const REFRESH_MS = 30_000

export function useClinicianDashboard(expectedRole) {
  const navigate = useNavigate()
  const auth = getStoredAuth()

  const [workspace, setWorkspace] = useState(null)
  const [backendHealth, setBackendHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const [drawerVisitId, setDrawerVisitId] = useState(null)
  const [drawerDetail, setDrawerDetail] = useState(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [detailTick, setDetailTick] = useState(0)
  const [actionBusy, setActionBusy] = useState(false)

  const loadWorkspace = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const [data, health] = await Promise.all([
        fetchClinicianWorkspace(),
        checkBackendHealth().catch(() => ({ status: 'error' })),
      ])
      setWorkspace(data)
      setBackendHealth(health)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!auth?.token) {
      navigate('/login')
      return
    }
    if (auth.user?.role !== expectedRole) {
      navigate(getHomeRouteForRole(auth.user?.role))
      return
    }
    loadWorkspace()
  }, [auth?.token, auth.user?.role, expectedRole, navigate, loadWorkspace])

  useEffect(() => {
    if (auth.user?.role !== expectedRole) return undefined
    const id = setInterval(() => loadWorkspace(true), REFRESH_MS)
    return () => clearInterval(id)
  }, [auth.user?.role, expectedRole, loadWorkspace])

  useEffect(() => {
    if (!drawerVisitId) {
      setDrawerDetail(null)
      return
    }
    let cancelled = false
    setDrawerLoading(true)
    fetchVisitDetails(drawerVisitId)
      .then((data) => {
        if (!cancelled) setDrawerDetail(data)
      })
      .catch(() => {
        if (!cancelled) setDrawerDetail(null)
      })
      .finally(() => {
        if (!cancelled) setDrawerLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [drawerVisitId, detailTick])

  const roomTeam = useMemo(() => {
    const assignment = workspace?.assignment
    if (!assignment?.roomId) return null
    return {
      name: assignment.roomName,
      doctor: assignment.doctor,
      nurses: assignment.nurses,
    }
  }, [workspace?.assignment])

  const clinicians = useMemo(() => {
    const list = []
    if (workspace?.assignment?.doctor) list.push(workspace.assignment.doctor)
    if (auth?.user?.role === 'doctor' && auth.user?.id) {
      const self = {
        id: auth.user.id,
        firstName: auth.user.firstName,
        lastName: auth.user.lastName,
        role: 'doctor',
      }
      if (!list.some((p) => String(p.id) === String(self.id))) list.unshift(self)
    }
    return list
  }, [workspace?.assignment?.doctor, auth?.user])

  async function afterAction() {
    setDetailTick((t) => t + 1)
    await loadWorkspace(true)
  }

  async function handlePlace(bedId) {
    if (!drawerVisitId) return
    await handlePlaceVisit(drawerVisitId, bedId)
  }

  async function handlePlaceVisit(visitId, bedId) {
    if (!visitId || !bedId) return
    setActionBusy(true)
    try {
      await placeVisit(visitId, bedId)
      await afterAction()
    } finally {
      setActionBusy(false)
    }
  }

  async function handleValidateTriage(payload) {
    if (!drawerVisitId) return
    setActionBusy(true)
    try {
      await updateVisitPriority(drawerVisitId, payload)
      await afterAction()
    } finally {
      setActionBusy(false)
    }
  }

  async function handleOpenConsultation(payload) {
    if (!drawerVisitId) return
    setActionBusy(true)
    try {
      await startVisitConsultation(drawerVisitId, payload)
      await afterAction()
    } finally {
      setActionBusy(false)
    }
  }

  async function handleSaveConsultation(payload) {
    if (!drawerVisitId) return
    setActionBusy(true)
    try {
      await saveVisitConsultation(drawerVisitId, payload)
      await afterAction()
    } finally {
      setActionBusy(false)
    }
  }

  async function handleReturn(reason) {
    if (!drawerVisitId) return
    setActionBusy(true)
    try {
      await returnVisitToWaiting(drawerVisitId, reason)
      await afterAction()
    } finally {
      setActionBusy(false)
    }
  }

  async function handleCloseVisit(payload) {
    if (!drawerVisitId) return
    setActionBusy(true)
    try {
      await closeVisit(drawerVisitId, payload)
      setDrawerVisitId(null)
      await loadWorkspace(true)
    } finally {
      setActionBusy(false)
    }
  }

  return {
    auth,
    workspace,
    backendHealth,
    loading,
    refreshing,
    error,
    loadWorkspace,
    drawerVisitId,
    setDrawerVisitId,
    drawerDetail,
    drawerLoading,
    actionBusy,
    roomTeam,
    clinicians,
    handlePlace,
    handlePlaceVisit,
    handleValidateTriage,
    handleOpenConsultation,
    handleSaveConsultation,
    handleReturn,
    handleCloseVisit,
    logout: () => {
      void logout()
      navigate('/login')
    },
  }
}
