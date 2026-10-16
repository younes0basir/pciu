import { useEffect, useMemo, useState } from 'react'
import { BedDouble, HeartPulse, LayoutList } from 'lucide-react'

import { AppShell } from '@/components/layout/AppShell.jsx'
import { DashboardAlert } from '@/components/layout/DashboardAlert.jsx'
import { DashboardPageHeader } from '@/components/layout/DashboardPageHeader.jsx'
import { ChiefVisitDrawer } from '@/components/chief/ChiefVisitDrawer.jsx'
import { ClinicianKpiBar } from '@/components/clinician/ClinicianKpiBar.jsx'
import { ClinicianRoomBoard } from '@/components/clinician/ClinicianRoomBoard.jsx'
import { ClinicianWaitingPanel } from '@/components/clinician/ClinicianWaitingPanel.jsx'
import { QueueWorkspace } from '@/components/accueil/QueueWorkspace.jsx'
import {
  boardVisitToCard,
  computeAccueilStats,
  filterAccueilWaiting,
} from '@/components/accueil/accueilUtils.js'
import { NurseBedMapPanel } from '@/components/nurse/NurseBedMapPanel.jsx'
import { NurseQuickPlaceModal } from '@/components/nurse/NurseQuickPlaceModal.jsx'
import { useClinicianDashboard } from '@/hooks/useClinicianDashboard.js'
import { WorklistsPanel } from '@/components/workflow/WorklistsPanel.jsx'
import { setBedOperationalStatus } from '@/api/careFlow.js'

const NURSE_ROLE = 'nurse'

const NAV_ITEMS = [
  { id: 'room', label: 'Ma salle', icon: HeartPulse },
  { id: 'beds', label: 'Salles & lits', icon: BedDouble },
  { id: 'queue', label: 'File d’attente', icon: LayoutList },
]

const WORKSPACE_META = {
  room: {
    title: 'Poste infirmier',
    badge: 'Ma salle',
    description: 'Triage, lits, file d’attente et rédaction de consultation pour le médecin de salle.',
  },
  beds: {
    title: 'Salles & lits',
    badge: 'Placement',
    description: 'Cartographie des lits et placement rapide des patients appelés.',
  },
  queue: {
    title: 'File d’attente',
    badge: 'Worklists',
    description: 'Vue complète de la file, worklists et patients prêts à placer.',
  },
}

export default function NurseDashboardPage() {
  const {
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
    handleSetCritical,
    handleTransfer,
    handleStartObservation,
    handleEndObservation,
    handleCompleteDeparture,
    refreshDrawerDetail,
    logout,
  } = useClinicianDashboard(NURSE_ROLE)

  const [activeWorkspace, setActiveWorkspace] = useState('room')
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [quickPlaceBed, setQuickPlaceBed] = useState(null)
  const [notice, setNotice] = useState(null)

  const priorityMax = priorityFilter === 'all' ? null : Number(priorityFilter)

  const waitingQueue = workspace?.waitingQueue ?? []

  const filterOpts = useMemo(
    () => ({ search, priorityMax, statusFilter }),
    [search, priorityMax, statusFilter]
  )

  const filteredWaiting = useMemo(
    () => filterAccueilWaiting(waitingQueue, filterOpts),
    [waitingQueue, filterOpts]
  )

  const queueStats = useMemo(() => computeAccueilStats(waitingQueue), [waitingQueue])

  const pipeline = useMemo(() => {
    const uncalled = filteredWaiting.filter((v) => !v.isCalled).map(boardVisitToCard)
    const called = filteredWaiting.filter((v) => v.isCalled).map(boardVisitToCard)
    return { uncalled, called }
  }, [filteredWaiting])

  const formattedLastUpdated = useMemo(() => {
    if (!workspace?.timestamp) return null
    return new Date(workspace.timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }, [workspace?.timestamp])

  const roomMeta = workspace?.assignment?.roomName
    ? ` · Salle ${workspace.assignment.roomName}`
    : ''

  useEffect(() => {
    document.title = 'Infirmier · PICU CARE'
  }, [])

  async function confirmQuickPlace(visitId, bedId) {
    await handlePlaceVisit(visitId, bedId)
    setQuickPlaceBed(null)
    setNotice('Patient placé au lit avec succès.')
  }

  async function handleMarkBedReady(bed) {
    if (!bed?.bedId) return
    try {
      await setBedOperationalStatus(bed.bedId, 'ready')
      await loadWorkspace(true)
      setNotice(`${bed.bedLabel} est de nouveau prêt.`)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Impossible de valider le lit.')
    }
  }

  const meta = WORKSPACE_META[activeWorkspace] ?? WORKSPACE_META.room

  return (
    <AppShell
      role={NURSE_ROLE}
      user={auth?.user}
      backendHealth={backendHealth}
      refreshing={refreshing}
      onRefresh={() => loadWorkspace(true)}
      onLogout={logout}
      searchValue={search}
      onSearchChange={activeWorkspace === 'queue' ? setSearch : undefined}
      searchPlaceholder="Recherche patient (Nom, code, CIN…)"
      navItems={NAV_ITEMS}
      activeNavId={activeWorkspace}
      onSelectNav={setActiveWorkspace}
      lastUpdated={formattedLastUpdated}
    >
      <div className="space-y-4">
        <DashboardPageHeader
          title={meta.title}
          badge={meta.badge}
          description={meta.description}
          meta={roomMeta}
          actions={
            activeWorkspace !== 'room' ? (
              <button
                type="button"
                onClick={() => setActiveWorkspace('room')}
                className="text-xs font-bold text-primary hover:underline"
              >
                Retour à ma salle
              </button>
            ) : null
          }
        />

        {notice ? <DashboardAlert variant="success">{notice}</DashboardAlert> : null}
        {error ? <DashboardAlert variant="error">{error}</DashboardAlert> : null}

        {loading && !workspace ? (
          <p className="text-sm font-semibold text-text-secondary">Chargement du poste infirmier…</p>
        ) : (
          <>
            {activeWorkspace === 'room' ? (
              <>
                <ClinicianKpiBar stats={workspace?.stats} role={NURSE_ROLE} />
                <div className="space-y-4">
                  <ClinicianWaitingPanel
                    waiting={workspace?.waitingToPlace ?? []}
                    onSelectVisit={(id) => {
                      setNotice(null)
                      setDrawerVisitId(id)
                    }}
                  />
                  <ClinicianRoomBoard
                    assignment={workspace?.assignment}
                    roomVisits={workspace?.roomVisits ?? []}
                    beds={workspace?.beds ?? []}
                    onSelectVisit={(id) => {
                      setNotice(null)
                      setDrawerVisitId(id)
                    }}
                  />
                </div>
              </>
            ) : null}

            {activeWorkspace === 'beds' ? (
              <NurseBedMapPanel
                beds={workspace?.allBeds ?? []}
                zones={workspace?.zones ?? []}
                highlightRoomId={workspace?.assignment?.roomId}
                onSelectOccupied={(visitId) => {
                  setNotice(null)
                  setDrawerVisitId(visitId)
                }}
                onSelectFree={(bed) => {
                  setNotice(null)
                  if (bed.operationalStatus && bed.operationalStatus !== 'ready') {
                    void handleMarkBedReady(bed)
                    return
                  }
                  setQuickPlaceBed(bed)
                }}
              />
            ) : null}

            {activeWorkspace === 'queue' ? (
              <QueueWorkspace
                stats={queueStats}
                pipeline={pipeline}
                filteredWaiting={filteredWaiting}
                priorityFilter={priorityFilter}
                statusFilter={statusFilter}
                onPriorityFilterChange={setPriorityFilter}
                onStatusFilterChange={setStatusFilter}
                onSelectVisit={(visitId) => {
                  setNotice(null)
                  setDrawerVisitId(visitId)
                }}
                uncalledTitle="En attente"
                uncalledSubtitle="Jamais appelé · triage possible"
                calledTitle="En attente"
                calledSubtitle="Appelé · prêt à placer"
                carePathPhase="nurse"
                leading={
                  <WorklistsPanel
                    onSelectVisit={(visitId) => {
                      setNotice(null)
                      setDrawerVisitId(visitId)
                    }}
                  />
                }
              />
            ) : null}
          </>
        )}
      </div>

      <ChiefVisitDrawer
        open={Boolean(drawerVisitId)}
        loading={drawerLoading}
        detail={drawerDetail}
        actionBusy={actionBusy}
        onClose={() => setDrawerVisitId(null)}
        clinicians={clinicians}
        currentUserId={auth?.user?.id}
        roomTeam={roomTeam}
        consultationMode="nurse"
        allowCall={false}
        allowPlace
        allowReturn
        allowClose
        allowConsultation
        allowTriage
        onPlace={handlePlace}
        onOpenConsultation={handleOpenConsultation}
        onSaveConsultation={handleSaveConsultation}
        onReturn={handleReturn}
        onCloseVisit={handleCloseVisit}
        onValidateTriage={handleValidateTriage}
        allowCareFlow
        allowCritical
        allowTransfer
        allowObservation
        allowCompleteDeparture
        onSetCritical={handleSetCritical}
        onTransfer={handleTransfer}
        onStartObservation={handleStartObservation}
        onEndObservation={handleEndObservation}
        onCompleteDeparture={handleCompleteDeparture}
        allowExamActions
        onRecordMutated={refreshDrawerDetail}
      />

      <NurseQuickPlaceModal
        open={Boolean(quickPlaceBed)}
        bed={quickPlaceBed}
        waitingPatients={waitingQueue}
        busy={actionBusy}
        onClose={() => setQuickPlaceBed(null)}
        onConfirm={confirmQuickPlace}
      />
    </AppShell>
  )
}
