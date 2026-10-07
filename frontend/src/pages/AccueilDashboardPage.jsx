import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserPlus } from 'lucide-react'

import { checkBackendHealth } from '@/api.js'
import { fetchBoard } from '@/api/board.js'
import { getHomeRouteForRole, getStoredAuth, logout } from '@/api/auth.js'
import { RoleDashboardHeader, RolePrimaryButton } from '@/components/layout/RoleDashboardHeader.jsx'
import { DashboardAlert } from '@/components/layout/DashboardAlert.jsx'
import { DashboardMain } from '@/components/layout/DashboardMain.jsx'
import { DashboardPageIntro } from '@/components/layout/DashboardPageIntro.jsx'
import { DashboardShell } from '@/components/layout/DashboardShell.jsx'
import { dashboardInputClass, dashboardSelectClass } from '@/components/layout/dashboardStyles.js'
import { registerVisit } from '@/api/visits.js'
import { AccueilKpiBar } from '@/components/accueil/AccueilKpiBar.jsx'
import { AccueilPipelineColumn } from '@/components/accueil/AccueilPipelineColumn.jsx'
import { AccueilQueueList } from '@/components/accueil/AccueilQueueList.jsx'
import {
  boardVisitToCard,
  computeAccueilStats,
  filterAccueilWaiting,
} from '@/components/accueil/accueilUtils.js'
import { ChiefRegisterPatientModal } from '@/components/chief/ChiefRegisterPatientModal.jsx'

const REFRESH_MS = 30_000
const ACCUEIL_ROLE = 'receptionist'

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
    <DashboardShell role={ACCUEIL_ROLE}>
        <RoleDashboardHeader
          role={ACCUEIL_ROLE}
          subtitle="Enregistrement et file d’attente · actualisation 30 s"
          backendHealth={backendHealth}
          refreshing={refreshing}
          onRefresh={() => loadBoard(true)}
          user={auth?.user}
          onLogout={() => {
            void logout()
            navigate('/login')
          }}
        />

        <DashboardMain>
        <DashboardPageIntro
          title="Tableau accueil"
          description="Enregistrement des arrivées et pilotage de la file d’attente en temps réel."
          meta={`Dernière mise à jour ${board?.timestamp ? new Date(board.timestamp).toLocaleTimeString('fr-FR') : '—'}`}
          actions={
            <>
              <RolePrimaryButton role={ACCUEIL_ROLE} onClick={() => setRegisterOpen(true)}>
                <UserPlus className="size-4" />
                Nouveau patient
              </RolePrimaryButton>
              <div className="relative sm:w-56">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nom, code, CIN…"
                  className={`${dashboardInputClass} pl-10`}
                />
              </div>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className={dashboardSelectClass}
              >
                <option value="all">Toutes priorités</option>
                <option value="2">P1–P2</option>
                <option value="3">P1–P3</option>
                <option value="5">P1–P5</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`max-w-[200px] ${dashboardSelectClass}`}
              >
                <option value="all">Tous les statuts</option>
                <option value="uncalled">Non appelés</option>
                <option value="called">Appelés</option>
              </select>
            </>
          }
        />

        {notice ? <DashboardAlert variant="success">{notice}</DashboardAlert> : null}
        {error ? <DashboardAlert variant="error">{error}</DashboardAlert> : null}

        {loading && !board ? (
          <p className="py-20 text-center text-sm font-semibold text-slate-500">Chargement du tableau…</p>
        ) : (
          <>
            <AccueilKpiBar stats={stats} />

            <div>
              <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">
                File d’attente
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                <AccueilPipelineColumn
                  title="En attente"
                  subtitle="Jamais appelé"
                  visits={pipeline.uncalled}
                  tone="slate"
                />
                <AccueilPipelineColumn
                  title="En attente"
                  subtitle="Appelé, pas au lit"
                  visits={pipeline.called}
                  tone="amber"
                />
              </div>
            </div>

            <AccueilQueueList visits={filteredWaiting} />
          </>
        )}
        </DashboardMain>

        <ChiefRegisterPatientModal
          open={registerOpen}
          role={ACCUEIL_ROLE}
          onClose={() => setRegisterOpen(false)}
          onSubmit={handleRegisterPatient}
        />
    </DashboardShell>
  )
}
