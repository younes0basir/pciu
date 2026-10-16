import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutList, UserPlus } from 'lucide-react'

import { checkBackendHealth } from '@/api.js'
import { fetchBoard } from '@/api/board.js'
import { getHomeRouteForRole, getStoredAuth, logout } from '@/api/auth.js'
import { AppShell } from '@/components/layout/AppShell.jsx'
import { DashboardAlert } from '@/components/layout/DashboardAlert.jsx'
import { DashboardPageHeader } from '@/components/layout/DashboardPageHeader.jsx'
import { callVisit, fetchVisitDetails, registerVisit } from '@/api/visits.js'
import { setVisitCritical } from '@/api/careFlow.js'
import { ChiefVisitDrawer } from '@/components/chief/ChiefVisitDrawer.jsx'
import { useVisitEventStream } from '@/hooks/useVisitEventStream.js'
import { QueueWorkspace } from '@/components/accueil/QueueWorkspace.jsx'
import {
  boardVisitToCard,
  computeAccueilStats,
  filterAccueilWaiting,
} from '@/components/accueil/accueilUtils.js'
import { ChiefRegisterPatientModal } from '@/components/chief/ChiefRegisterPatientModal.jsx'

const REFRESH_MS = 30_000
const ACCUEIL_ROLE = 'receptionist'

const NAV_ITEMS = [{ id: 'flow', label: 'File d’attente', icon: LayoutList }]

export default function AccueilDashboardPage() {
  const navigate = useNavigate()
  const auth = getStoredAuth()

  const [board, setBoard] = useState(null)
  const [backendHealth, setBackendHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [registerOpen, setRegisterOpen] = useState(false)
  const [drawerVisitId, setDrawerVisitId] = useState(null)
  const [drawerDetail, setDrawerDetail] = useState(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)

  const priorityMax = priorityFilter === 'all' ? null : Number(priorityFilter)

  const loadBoard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const [data, health] = await Promise.all([
        fetchBoard(),
        checkBackendHealth().catch(() => ({ status: 'error' })),
      ])
      setBoard(data)
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
    if (auth.user?.role !== 'receptionist') {
      navigate(getHomeRouteForRole(auth.user?.role))
      return
    }
    loadBoard()
  }, [auth?.token, auth?.user?.role, navigate, loadBoard])

  useEffect(() => {
    if (auth?.user?.role !== 'receptionist') return undefined
    const id = setInterval(() => loadBoard(true), REFRESH_MS)
    return () => clearInterval(id)
  }, [auth?.user?.role, loadBoard])

  useVisitEventStream(() => loadBoard(true), auth?.user?.role === 'receptionist')

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
  }, [drawerVisitId])

  useEffect(() => {
    document.title = 'Accueil · PICU CARE'
  }, [])

  const waiting = board?.waiting ?? []

  const filterOpts = useMemo(
    () => ({ search, priorityMax, statusFilter }),
    [search, priorityMax, statusFilter]
  )

  const filteredWaiting = useMemo(
    () => filterAccueilWaiting(waiting, filterOpts),
    [waiting, filterOpts]
  )

  const stats = useMemo(() => computeAccueilStats(waiting), [waiting])

  const pipeline = useMemo(() => {
    const uncalled = filteredWaiting.filter((v) => !v.isCalled).map(boardVisitToCard)
    const called = filteredWaiting.filter((v) => v.isCalled).map(boardVisitToCard)
    return { uncalled, called }
  }, [filteredWaiting])

  const formattedLastUpdated = useMemo(() => {
    if (!board?.timestamp) return null
    return new Date(board.timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }, [board?.timestamp])

  async function runVisitMutation(fn) {
    setActionBusy(true)
    setError(null)
    try {
      await fn()
      await loadBoard(true)
      if (drawerVisitId) {
        const detail = await fetchVisitDetails(drawerVisitId)
        setDrawerDetail(detail)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action impossible')
    } finally {
      setActionBusy(false)
    }
  }

  async function handleRegisterPatient(payload) {
    const result = await registerVisit(payload)
    await loadBoard(true)
    setNotice(
      result?.publicCode
        ? `${result.patientName || 'Patient'} enregistré · ${result.publicCode}`
        : 'Patient enregistré dans la file d’attente.'
    )
    return result
  }

  return (
    <AppShell
      role={ACCUEIL_ROLE}
      user={auth?.user}
      backendHealth={backendHealth}
      refreshing={refreshing}
      onRefresh={() => loadBoard(true)}
      onLogout={() => {
        void logout()
        navigate('/login')
      }}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Recherche patient (Nom, code, CIN…)"
      navItems={NAV_ITEMS}
      activeNavId="flow"
      onSelectNav={() => {}}
      lastUpdated={formattedLastUpdated}
    >
      <div className="space-y-4">
        <DashboardPageHeader
          title="Tableau accueil"
          badge="Enregistrement & file"
          description="Enregistrement des arrivées et pilotage de la file d’attente en temps réel."
          actions={
            <button
              type="button"
              onClick={() => setRegisterOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-primary/90 active:scale-[0.98]"
            >
              <UserPlus className="size-4" />
              <span>Nouveau patient</span>
            </button>
          }
        />

        {notice ? <DashboardAlert variant="success">{notice}</DashboardAlert> : null}
        {error ? <DashboardAlert variant="error">{error}</DashboardAlert> : null}

        {loading && !board ? (
          <p className="py-12 text-center text-sm font-semibold text-text-secondary">
            Chargement du tableau…
          </p>
        ) : (
          <QueueWorkspace
            stats={stats}
            pipeline={pipeline}
            filteredWaiting={filteredWaiting}
            priorityFilter={priorityFilter}
            statusFilter={statusFilter}
            onPriorityFilterChange={setPriorityFilter}
            onStatusFilterChange={setStatusFilter}
            onSelectVisit={setDrawerVisitId}
            uncalledTitle="À appeler"
            uncalledSubtitle="Enregistrés · action accueil : ouvrir la fiche et appeler"
            calledTitle="Chez l’infirmier"
            calledSubtitle="Appelés · en attente de triage et placement au lit"
            carePathPhase="accueil"
          />
        )}
      </div>

      <ChiefRegisterPatientModal
        open={registerOpen}
        role={ACCUEIL_ROLE}
        onClose={() => setRegisterOpen(false)}
        onSubmit={handleRegisterPatient}
        canCallAfterRegister
        onSuccessCall={async (visitId) => {
          await callVisit(visitId)
          await loadBoard(true)
          setNotice('Patient enregistré et appelé.')
        }}
        onOpenVisit={setDrawerVisitId}
      />

      <ChiefVisitDrawer
        open={Boolean(drawerVisitId)}
        loading={drawerLoading}
        detail={drawerDetail}
        actionBusy={actionBusy}
        onClose={() => setDrawerVisitId(null)}
        clinicians={[]}
        currentUserId={auth?.user?.id}
        allowCall
        allowPlace={false}
        allowReturn={false}
        allowClose={false}
        allowConsultation={false}
        allowTriage={false}
        onCall={() => runVisitMutation(() => callVisit(drawerVisitId))}
        allowCareFlow
        allowCritical
        onSetCritical={(critical) =>
          runVisitMutation(() => setVisitCritical(drawerVisitId, critical))
        }
      />
    </AppShell>
  )
}
