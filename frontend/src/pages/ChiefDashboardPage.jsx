import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, Search, UserPlus, UsersRound } from 'lucide-react'

import { checkBackendHealth } from '@/api.js'
import { getStoredAuth, getHomeRouteForRole, logout } from '@/api/auth.js'
import { RoleDashboardHeader, RolePrimaryButton } from '@/components/layout/RoleDashboardHeader.jsx'
import { DashboardAlert } from '@/components/layout/DashboardAlert.jsx'
import { DashboardMain } from '@/components/layout/DashboardMain.jsx'
import { DashboardPageIntro } from '@/components/layout/DashboardPageIntro.jsx'
import { DashboardShell } from '@/components/layout/DashboardShell.jsx'
import { DashboardTabBar } from '@/components/layout/DashboardTabBar.jsx'
import { dashboardInputClass, dashboardSelectClass } from '@/components/layout/dashboardStyles.js'
import { clearRoomTeam, fetchChiefOverview, fetchChiefTeams, saveRoomTeam } from '@/api/chief.js'
import {
  callVisit,
  closeVisit,
  fetchVisitDetails,
  placeVisit,
  registerVisit,
  returnVisitToWaiting,
  saveVisitConsultation,
  startVisitConsultation,
} from '@/api/visits.js'
import { ChiefActiveTable } from '@/components/chief/ChiefActiveTable.jsx'
import { ChiefBedMap } from '@/components/chief/ChiefBedMap.jsx'
import { ChiefClosedTodayTable } from '@/components/chief/ChiefClosedTodayTable.jsx'
import { ChiefKpiBar } from '@/components/chief/ChiefKpiBar.jsx'
import { ChiefPipelineColumn } from '@/components/chief/ChiefPipelineColumn.jsx'
import { ChiefRegisterPatientModal } from '@/components/chief/ChiefRegisterPatientModal.jsx'
import { ChiefSlaLegend } from '@/components/chief/ChiefSlaLegend.jsx'
import { ChiefTeamsBoard } from '@/components/chief/ChiefTeamsBoard.jsx'
import { ChiefStuckAlerts } from '@/components/chief/ChiefStuckAlerts.jsx'
import { ChiefVisitDrawer } from '@/components/chief/ChiefVisitDrawer.jsx'
import {
  filterChiefVisits,
  formatDuration,
  OUTCOME_LABELS,
  STUCK_FILTER_OPTIONS,
} from '@/components/chief/chiefUtils.js'

const REFRESH_MS = 30_000
const CHIEF_ROLE = 'chief'

const CHIEF_TABS = [
  { id: 'flow', label: 'Supervision', icon: LayoutDashboard },
  { id: 'teams', label: 'Équipes & salles', icon: UsersRound },
]

export default function ChiefDashboardPage() {
  const navigate = useNavigate()
  const auth = getStoredAuth()

  const [workspace, setWorkspace] = useState('flow')
  const [overview, setOverview] = useState(null)
  const [teams, setTeams] = useState(null)
  const [teamsError, setTeamsError] = useState(null)
  const [teamBusy, setTeamBusy] = useState(false)
  const [backendHealth, setBackendHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [zoneFilter, setZoneFilter] = useState('all')
  const [stuckFilter, setStuckFilter] = useState('all')

  const [registerOpen, setRegisterOpen] = useState(false)
  const [drawerVisitId, setDrawerVisitId] = useState(null)
  const [drawerDetail, setDrawerDetail] = useState(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [detailTick, setDetailTick] = useState(0)
  const [actionBusy, setActionBusy] = useState(false)

  const priorityMax = priorityFilter === 'all' ? null : Number(priorityFilter)

  const loadOverview = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const [data, health, staffResult] = await Promise.all([
        fetchChiefOverview(),
        checkBackendHealth().catch(() => ({ status: 'error' })),
        fetchChiefTeams().then(
          (value) => ({ value, error: null }),
          (err) => ({ value: null, error: err instanceof Error ? err.message : 'Équipes indisponibles' })
        ),
      ])
      setOverview(data)
      setBackendHealth(health)
      setTeams(staffResult.value)
      setTeamsError(staffResult.error)
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
    if (auth.user?.role !== 'chief') {
      navigate(getHomeRouteForRole(auth.user?.role))
      return
    }
    loadOverview()
  }, [auth?.token, auth?.user?.role, navigate, loadOverview])

  useEffect(() => {
    if (auth?.user?.role !== 'chief') return undefined
    const id = setInterval(() => loadOverview(true), REFRESH_MS)
    return () => clearInterval(id)
  }, [auth?.user?.role, loadOverview])

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

  const reloadVisitDetail = useCallback(() => {
    setDetailTick((t) => t + 1)
  }, [])

  async function runVisitMutation(mutator) {
    if (!drawerVisitId) return
    setActionBusy(true)
    try {
      await mutator()
      await loadOverview(true)
      reloadVisitDetail()
    } catch (err) {
      setActionBusy(false)
      throw err
    }
    setActionBusy(false)
  }

  async function handleSaveTeam(roomId, payload) {
    setTeamBusy(true)
    try {
      const next = await saveRoomTeam(roomId, payload)
      setTeams(next)
      setTeamsError(null)
    } finally {
      setTeamBusy(false)
    }
  }

  async function handleClearTeam(roomId) {
    setTeamBusy(true)
    try {
      const next = await clearRoomTeam(roomId)
      setTeams(next)
      setTeamsError(null)
    } finally {
      setTeamBusy(false)
    }
  }

  const roomTeam = useMemo(() => {
    const roomId = drawerDetail?.activeBed?.roomId
    if (!teams || roomId == null) return null
    for (const zone of teams.zones || []) {
      const room = zone.rooms.find((item) => String(item.roomId) === String(roomId))
      if (room) return { ...room, zoneName: zone.name }
    }
    return null
  }, [teams, drawerDetail?.activeBed?.roomId])

  async function handleRegisterPatient(payload) {
    const result = await registerVisit(payload)
    await loadOverview(true)
    if (result?.visitId) {
      setDrawerVisitId(result.visitId)
    }
    return result
  }

  const filterOpts = useMemo(
    () => ({ search, priorityMax, zoneName: zoneFilter, stuckFilter }),
    [search, priorityMax, zoneFilter, stuckFilter]
  )

  const applyFilter = useCallback(
    (visits) => filterChiefVisits(visits || [], filterOpts),
    [filterOpts]
  )

  const pipeline = overview?.pipeline
  const filtered = useMemo(() => {
    if (!pipeline) return null
    return {
      waitingUncalled: applyFilter(pipeline.waitingUncalled),
      waitingCalled: applyFilter(pipeline.waitingCalled),
      placed: applyFilter(pipeline.placed),
      inTreatment: applyFilter(pipeline.inTreatment),
      closedToday: applyFilter(overview.closedToday || []),
      activeAll: applyFilter(overview.activeAll || []),
      stuckAlerts: applyFilter(overview.stuckAlerts || []),
    }
  }, [pipeline, overview?.closedToday, overview?.activeAll, overview?.stuckAlerts, applyFilter])

  return (
    <DashboardShell role={CHIEF_ROLE}>
      <RoleDashboardHeader
        role={CHIEF_ROLE}
        badgeLabel="Chef de service"
        subtitle="Supervision du parcours urgences · actualisation 30 s"
        backendHealth={backendHealth}
        refreshing={refreshing}
        onRefresh={() => loadOverview(true)}
        user={auth?.user}
        onLogout={() => {
          void logout()
          navigate('/login')
        }}
      />

      <DashboardMain>
        <DashboardPageIntro
          title={workspace === 'teams' ? 'Équipes & salles' : 'Tableau de supervision'}
          description={
            workspace === 'teams'
              ? 'Médecins, infirmières liées et salle dont ils ont la charge.'
              : 'Supervision du parcours urgences, SLA et actions sur les visites.'
          }
          meta={`Dernière mise à jour ${overview?.timestamp ? new Date(overview.timestamp).toLocaleTimeString('fr-FR') : '—'}`}
          tabs={
            <DashboardTabBar
              role={CHIEF_ROLE}
              tabs={CHIEF_TABS}
              activeId={workspace}
              onChange={setWorkspace}
              ariaLabel="Espaces du chef de service"
            />
          }
          actions={
            workspace === 'flow' ? (
              <>
                <RolePrimaryButton role={CHIEF_ROLE} onClick={() => setRegisterOpen(true)}>
                  <UserPlus className="size-4" />
                  Nouveau patient
                </RolePrimaryButton>
                <div className="relative sm:w-56">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
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
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value)}
                  className={dashboardSelectClass}
                >
                  <option value="all">Toutes zones</option>
                  <option value="__none__">Sans lit (salle d’attente)</option>
                  {(overview?.zones || []).map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
                <select
                  value={stuckFilter}
                  onChange={(e) => setStuckFilter(e.target.value)}
                  className={`max-w-[200px] ${dashboardSelectClass}`}
                >
                  {STUCK_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </>
            ) : null
          }
        />

        {workspace === 'flow' ? <ChiefSlaLegend sla={overview?.sla} /> : null}

        {error ? <DashboardAlert variant="error">{error}</DashboardAlert> : null}

        {loading && !overview ? (
          <p className="py-20 text-center text-sm font-semibold text-slate-500">Chargement du tableau…</p>
        ) : workspace === 'teams' ? (
          <>
            {teamsError ? <DashboardAlert variant="error">{teamsError}</DashboardAlert> : null}
            <ChiefTeamsBoard
              board={teams}
              currentUserId={auth?.user?.id}
              busy={teamBusy}
              onSave={handleSaveTeam}
              onClear={handleClearTeam}
            />
          </>
        ) : (
          <>
            <ChiefKpiBar stats={overview?.stats} formatDuration={formatDuration} />

            <ChiefStuckAlerts
              alerts={filtered?.stuckAlerts ?? []}
              sla={overview?.sla}
              onSelectVisit={setDrawerVisitId}
            />

            <div>
              <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">
                Pipeline Kanban
              </h2>
              <div className="grid gap-3 lg:grid-cols-5">
              <ChiefPipelineColumn
                title="En attente"
                subtitle="Jamais appelé"
                visits={filtered?.waitingUncalled ?? []}
                tone="slate"
                onSelectVisit={setDrawerVisitId}
              />
              <ChiefPipelineColumn
                title="En attente"
                subtitle="Appelé, pas au lit"
                visits={filtered?.waitingCalled ?? []}
                tone="amber"
                onSelectVisit={setDrawerVisitId}
              />
              <ChiefPipelineColumn
                title="Au lit"
                subtitle="En attente de consultation"
                visits={filtered?.placed ?? []}
                tone="sky"
                onSelectVisit={setDrawerVisitId}
              />
              <ChiefPipelineColumn
                title="En prise en charge"
                subtitle="Consultation en cours"
                visits={filtered?.inTreatment ?? []}
                tone="emerald"
                onSelectVisit={setDrawerVisitId}
              />
              <ChiefPipelineColumn
                title="Clôturées aujourd’hui"
                subtitle="Sortie / transfert / LWBS"
                visits={
                  filtered?.closedToday?.map((v) => ({
                    ...v,
                    chiefComplaint: v.outcome
                      ? `${OUTCOME_LABELS[v.outcome] || v.outcome} · ${v.chiefComplaint || ''}`
                      : v.chiefComplaint,
                  })) ?? []
                }
                tone="violet"
                onSelectVisit={setDrawerVisitId}
              />
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <ChiefActiveTable
                visits={filtered?.activeAll ?? []}
                onSelectVisit={setDrawerVisitId}
              />
              <ChiefClosedTodayTable
                visits={filtered?.closedToday ?? []}
                onSelectVisit={setDrawerVisitId}
              />
            </div>

            <ChiefBedMap
              beds={overview?.beds}
              title="Plan des lits"
              subtitle="Occupation en temps réel. Ouvrez un lit occupé pour le dossier."
              assignFreeBeds={false}
              onSelectOccupied={setDrawerVisitId}
            />
          </>
        )}
      </DashboardMain>

      <ChiefRegisterPatientModal
        open={registerOpen}
        role={CHIEF_ROLE}
        onClose={() => setRegisterOpen(false)}
        onSubmit={handleRegisterPatient}
      />

      <ChiefVisitDrawer
        open={Boolean(drawerVisitId)}
        loading={drawerLoading}
        detail={drawerDetail}
        actionBusy={actionBusy}
        onClose={() => setDrawerVisitId(null)}
        clinicians={teams?.clinicians || []}
        currentUserId={auth?.user?.id}
        roomTeam={roomTeam}
        onCall={() => runVisitMutation(() => callVisit(drawerVisitId))}
        onPlace={(bedId) => runVisitMutation(() => placeVisit(drawerVisitId, bedId))}
        onOpenConsultation={(payload) =>
          runVisitMutation(() => startVisitConsultation(drawerVisitId, payload))
        }
        onSaveConsultation={(payload) =>
          runVisitMutation(() => saveVisitConsultation(drawerVisitId, payload))
        }
        onReturn={(reason) => runVisitMutation(() => returnVisitToWaiting(drawerVisitId, reason))}
        onCloseVisit={(payload) => runVisitMutation(() => closeVisit(drawerVisitId, payload))}
      />
    </DashboardShell>
  )
}
