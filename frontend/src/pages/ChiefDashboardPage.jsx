import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  BedDouble,
  Bot,
  LayoutDashboard,
  UsersRound,
} from 'lucide-react'

import { checkBackendHealth } from '@/api.js'
import { getStoredAuth, getHomeRouteForRole, logout } from '@/api/auth.js'
import { AppShell } from '@/components/layout/AppShell.jsx'
import { DashboardAlert } from '@/components/layout/DashboardAlert.jsx'
import { clearRoomTeam, fetchChiefOverview, fetchChiefTeams, saveRoomTeam } from '@/api/chief.js'
import { fetchWorklists } from '@/api/careFlow.js'
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
import {
  completeVisitDeparture,
  endObservation,
  setVisitCritical,
  startObservation,
  transferVisitBed,
} from '@/api/careFlow.js'
import { ChiefCommandHero } from '@/components/chief/ChiefCommandHero.jsx'
import { ChiefPipelinePlacement } from '@/components/chief/ChiefPipelinePlacement.jsx'
import { ChiefRegisterPatientModal } from '@/components/chief/ChiefRegisterPatientModal.jsx'
import { ChiefTeamsBoard } from '@/components/chief/ChiefTeamsBoard.jsx'
import { ChiefVisitDrawer } from '@/components/chief/ChiefVisitDrawer.jsx'
import { ChiefAiModePanel } from '@/components/chief/ChiefAiModePanel.jsx'
import { BedPlanPanel } from '@/components/beds/BedPlanPanel.jsx'
import { ResourceDetailsDrawer } from '@/components/resources/ResourceDetailsDrawer.jsx'
import { PatientWorklistTable } from '@/components/workflow/PatientWorklistTable.jsx'
import { ChiefHistorySection } from '@/components/chief/ChiefHistorySection.jsx'
import { ChiefSidecar } from '@/components/chief/ChiefSidecar.jsx'
import {
  countStaffedAssignableBeds,
  countUnstaffedFreeBeds,
  formatDuration,
  sortWaitingQueue,
} from '@/components/chief/chiefUtils.js'
import { useVisitEventStream } from '@/hooks/useVisitEventStream.js'
import { useSupervisionDashboard } from '@/hooks/useSupervisionDashboard.js'
import { PatientAnalyticsPanel } from '@/components/chief/PatientAnalyticsPanel.jsx'

const REFRESH_MS = 30_000
const CHIEF_ROLE = 'chief'

const NAV_ITEMS = [
  { id: 'flow', label: 'Supervision active', icon: LayoutDashboard },
  { id: 'analytics', label: 'Analyse patients', icon: BarChart3 },
  { id: 'beds', label: 'Plateau & lits', icon: BedDouble },
  { id: 'teams', label: 'Équipes & salles', icon: UsersRound },
  { id: 'ai', label: 'Pilotage IA', icon: Bot },
]

export default function ChiefDashboardPage() {
  const navigate = useNavigate()
  const auth = getStoredAuth()

  const [workspace, setWorkspace] = useState('flow')
  const [overview, setOverview] = useState(null)
  const [worklists, setWorklists] = useState(null)
  const [worklistsLoading, setWorklistsLoading] = useState(false)
  const [worklistsError, setWorklistsError] = useState(null)
  const [activeWorklistTab, setActiveWorklistTab] = useState('triage')

  const [teams, setTeams] = useState(null)
  const [teamsError, setTeamsError] = useState(null)
  const [teamBusy, setTeamBusy] = useState(false)
  const [backendHealth, setBackendHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  // Filters
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [zoneFilter, setZoneFilter] = useState('all')

  // Modals & Drawer
  const [registerOpen, setRegisterOpen] = useState(false)
  const [drawerVisitId, setDrawerVisitId] = useState(null)
  const [drawerDetail, setDrawerDetail] = useState(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [detailTick, setDetailTick] = useState(0)
  const [actionBusy, setActionBusy] = useState(false)
  const [resourceDrawerBed, setResourceDrawerBed] = useState(null)
  const [alertAckBusyId, setAlertAckBusyId] = useState(null)
  const [sidecarTab, setSidecarTab] = useState('alerts')

  const supervision = useSupervisionDashboard({
    enabled: auth?.user?.role === 'chief',
    zone: zoneFilter,
  })

  // Load all data
  const loadOverview = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const [overviewData, health, staffResult, worklistsData] = await Promise.all([
        fetchChiefOverview(),
        checkBackendHealth().catch(() => ({ status: 'error' })),
        fetchChiefTeams().then(
          (value) => ({ value, error: null }),
          (err) => ({ value: null, error: err instanceof Error ? err.message : 'Équipes indisponibles' })
        ),
        fetchWorklists().catch((err) => {
          setWorklistsError(err instanceof Error ? err.message : 'Worklists indisponibles')
          return null
        }),
      ])
      setOverview(overviewData)
      setBackendHealth(health)
      setTeams(staffResult.value)
      setTeamsError(staffResult.error)
      if (worklistsData) {
        setWorklists(worklistsData)
        setWorklistsError(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement du tableau de bord')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Manual reload for worklists only
  const reloadWorklists = useCallback(async () => {
    setWorklistsLoading(true)
    try {
      const data = await fetchWorklists()
      setWorklists(data)
      setWorklistsError(null)
    } catch (err) {
      setWorklistsError(err instanceof Error ? err.message : 'Erreur actualisation worklists')
    } finally {
      setWorklistsLoading(false)
    }
  }, [])

  // Auth guard
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

  // Periodic polling fallback (30s)
  useEffect(() => {
    if (auth?.user?.role !== 'chief') return undefined
    const id = setInterval(() => {
      loadOverview(true)
      supervision.reload(true)
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [auth?.user?.role, loadOverview, supervision.reload])

  // Shared SSE Stream subscription
  useVisitEventStream(() => {
    loadOverview(true)
    supervision.reload(true)
  }, auth?.user?.role === 'chief')

  // Patient detail for drawer
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

  // Quick actions from worklist table
  async function handleQuickCall(visitId) {
    setActionBusy(true)
    try {
      await callVisit(visitId)
      await loadOverview(true)
    } finally {
      setActionBusy(false)
    }
  }

  async function handleQuickPlace(visitId) {
    setDrawerVisitId(visitId)
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
    return result
  }

  const pipeline = overview?.pipeline
  const waitingOrder = useMemo(
    () => sortWaitingQueue([...(pipeline?.waitingUncalled || []), ...(pipeline?.waitingCalled || [])]),
    [pipeline]
  )

  const staffedAssignableBeds = useMemo(
    () => countStaffedAssignableBeds(overview?.beds),
    [overview?.beds]
  )
  const unstaffedFreeBeds = useMemo(() => countUnstaffedFreeBeds(overview?.beds), [overview?.beds])

  const placementCapacityTick = useMemo(
    () =>
      [
        overview?.timestamp,
        staffedAssignableBeds,
        unstaffedFreeBeds,
        waitingOrder.length,
        waitingOrder[0]?.visitId,
      ].join(':'),
    [overview?.timestamp, staffedAssignableBeds, unstaffedFreeBeds, waitingOrder]
  )

  const formattedLastUpdated = useMemo(() => {
    if (!overview?.timestamp) return null
    return new Date(overview.timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }, [overview?.timestamp])

  return (
    <AppShell
      role={CHIEF_ROLE}
      user={auth?.user}
      backendHealth={backendHealth}
      refreshing={refreshing}
      onRefresh={() => {
        loadOverview(true)
        supervision.reload(true)
      }}
      onLogout={() => {
        void logout()
        navigate('/login')
      }}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Recherche patient (Nom, code, CIN…)"
      navItems={NAV_ITEMS}
      activeNavId={workspace}
      onSelectNav={setWorkspace}
      lastUpdated={formattedLastUpdated}
    >
      {/* ERROR BANNER */}
      {error ? (
        <div className="mb-4">
          <DashboardAlert variant="error">{error}</DashboardAlert>
        </div>
      ) : null}

      {/* WORKSPACE: TEAMS */}
      {workspace === 'teams' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div>
              <h1 className="text-xl font-extrabold text-text-primary">
                Affectations d’équipes par salle
              </h1>
              <p className="text-xs text-text-secondary">
                Désignez les médecins référents et infirmiers affectés aux salles de soins.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWorkspace('flow')}
              className="text-xs font-bold text-primary hover:underline"
            >
              Retour à la supervision
            </button>
          </div>
          {teamsError ? <DashboardAlert variant="error">{teamsError}</DashboardAlert> : null}
          <ChiefTeamsBoard
            board={teams}
            currentUserId={auth?.user?.id}
            busy={teamBusy}
            onSave={handleSaveTeam}
            onClear={handleClearTeam}
          />
        </div>
      ) : workspace === 'ai' ? (
        /* WORKSPACE: AI CONTROL */
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div>
              <h1 className="text-xl font-extrabold text-text-primary">
                Pilotage IA & Coordination clinique
              </h1>
              <p className="text-xs text-text-secondary">
                Configuration des services d'assistance, agents d'admission et analyse de capacité.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWorkspace('flow')}
              className="text-xs font-bold text-primary hover:underline"
            >
              Retour à la supervision
            </button>
          </div>
          <ChiefAiModePanel />
        </div>
      ) : workspace === 'analytics' ? (
        <PatientAnalyticsPanel refreshToken={overview?.timestamp ?? null} />
      ) : workspace === 'beds' ? (
        /* WORKSPACE: FULL BED MAP */
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div>
              <h1 className="text-xl font-extrabold text-text-primary">
                Plan complet du plateau des lits
              </h1>
              <p className="text-xs text-text-secondary">
                Cartographie complète des lits, statuts d'occupation et disponibilité opérationnelle.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWorkspace('flow')}
              className="text-xs font-bold text-primary hover:underline"
            >
              Retour à la supervision
            </button>
          </div>
          <BedPlanPanel
            beds={overview?.beds}
            title="Plan complet des lits"
            subtitle="Occupation en temps réel. Cliquez sur un lit occupé pour accéder au dossier."
            assignFreeBeds={false}
            onSelectOccupied={setDrawerVisitId}
            onSelectResource={setResourceDrawerBed}
          />
          <ResourceDetailsDrawer
            bed={resourceDrawerBed}
            canMutate
            onClose={() => setResourceDrawerBed(null)}
            onUpdated={() => loadOverview(true)}
          />
        </div>
      ) : (
        /* WORKSPACE: MAIN FLOW / SUPERVISION COMMAND CENTER */
        <div className="space-y-5">
          <ChiefCommandHero
            stats={overview?.stats}
            pipeline={overview?.pipeline}
            beds={overview?.beds}
            supervisionKpis={supervision.kpis}
            formatDuration={formatDuration}
            lastUpdated={formattedLastUpdated}
            onRegister={() => setRegisterOpen(true)}
            onKpiClick={(target) => {
              if (target === 'triage') setActiveWorklistTab('triage')
              else if (target === 'beds') setWorkspace('beds')
              else if (target === 'priority') setPriorityFilter('2')
              else if (target === 'alerts') setSidecarTab('alerts')
            }}
          />

          {supervision.error ? (
            <DashboardAlert variant="info">{supervision.error}</DashboardAlert>
          ) : null}

          {/* 2. DUAL-COLUMN OPERATIONAL WORKSPACE (DESKTOP: ~65% / 35%) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT / CENTER COLUMN: PRIMARY WORKFLOW & PATIENTS */}
            <div className="lg:col-span-7 xl:col-span-8 min-w-0">
              <PatientWorklistTable
                worklists={worklists}
                loading={worklistsLoading || (loading && !worklists)}
                error={worklistsError}
                onRefresh={reloadWorklists}
                activeTab={activeWorklistTab}
                onTabChange={setActiveWorklistTab}
                onSelectVisit={setDrawerVisitId}
                searchQuery={search}
                priorityFilter={priorityFilter}
                zoneFilter={zoneFilter}
                onSearchChange={setSearch}
                onPriorityFilterChange={setPriorityFilter}
                onZoneFilterChange={setZoneFilter}
                canCall={true}
                canPlace={true}
                onQuickCall={handleQuickCall}
                onQuickPlace={handleQuickPlace}
                actionBusy={actionBusy}
                lead={
                  <ChiefPipelinePlacement
                    bare
                    waiting={waitingOrder}
                    staffedAssignableBeds={staffedAssignableBeds}
                    unstaffedFreeBeds={unstaffedFreeBeds}
                    capacityTick={placementCapacityTick}
                    onApplied={() => loadOverview(true)}
                    onOpenAi={() => setWorkspace('ai')}
                    onOpenTeams={() => setWorkspace('teams')}
                  />
                }
              />
            </div>

            {/* RIGHT COLUMN: BOUNDED TABBED SIDECAR */}
            <div className="lg:col-span-5 xl:col-span-4 min-w-0">
              <ChiefSidecar
                supervision={supervision}
                overview={overview}
                activeTab={sidecarTab}
                onTabChange={setSidecarTab}
                alertAckBusyId={alertAckBusyId}
                onSelectVisit={setDrawerVisitId}
                onAcknowledge={async (alertId) => {
                  setAlertAckBusyId(alertId)
                  try {
                    await supervision.acknowledgeAlert(alertId)
                  } finally {
                    setAlertAckBusyId(null)
                  }
                }}
                onOpenFullBedPlan={() => setWorkspace('beds')}
                onBedUpdated={() => loadOverview(true)}
                onOpenTeams={() => setWorkspace('teams')}
              />
            </div>
          </div>

          {/* 3. SECONDARY COLLAPSIBLE SECTION: REGISTRES & VISITES CLÔTURÉES */}
          <ChiefHistorySection
            activeVisits={overview?.activeAll || []}
            closedVisits={overview?.closedToday || []}
            onSelectVisit={setDrawerVisitId}
            defaultExpanded={false}
          />
        </div>
      )}

      {/* NEW PATIENT REGISTRATION MODAL */}
      <ChiefRegisterPatientModal
        open={registerOpen}
        role={CHIEF_ROLE}
        onClose={() => setRegisterOpen(false)}
        onSubmit={handleRegisterPatient}
        onOpenVisit={setDrawerVisitId}
      />

      {/* PATIENT VISIT DRAWER */}
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
        onCloseVisit={async (payload) => {
          await runVisitMutation(() => closeVisit(drawerVisitId, payload))
          if (payload?.outcome !== 'admitted') {
            setDrawerVisitId(null)
          }
        }}
        allowCareFlow
        allowCritical
        allowTransfer
        allowObservation
        allowCompleteDeparture
        onSetCritical={(critical) =>
          runVisitMutation(() => setVisitCritical(drawerVisitId, critical))
        }
        onTransfer={(bedId) => runVisitMutation(() => transferVisitBed(drawerVisitId, bedId))}
        onStartObservation={() => runVisitMutation(() => startObservation(drawerVisitId))}
        onEndObservation={() => runVisitMutation(() => endObservation(drawerVisitId))}
        onCompleteDeparture={async () => {
          await runVisitMutation(() => completeVisitDeparture(drawerVisitId))
          setDrawerVisitId(null)
        }}
        allowExamActions
        onRecordMutated={reloadVisitDetail}
      />
    </AppShell>
  )
}
