import { useEffect, useMemo, useState } from 'react'
import { BedDouble, HeartPulse, LayoutList } from 'lucide-react'

import { AppShell } from '@/components/layout/AppShell.jsx'
import { DashboardAlert } from '@/components/layout/DashboardAlert.jsx'
import { DashboardPageHeader } from '@/components/layout/DashboardPageHeader.jsx'
import { ChiefVisitDrawer } from '@/components/chief/ChiefVisitDrawer.jsx'
import { ClinicianKpiBar } from '@/components/clinician/ClinicianKpiBar.jsx'
import { ClinicianRoomBoard } from '@/components/clinician/ClinicianRoomBoard.jsx'
import { QueueWorkspace } from '@/components/accueil/QueueWorkspace.jsx'
import {
  boardVisitToCard,
  computeAccueilStats,
  filterAccueilWaiting,
} from '@/components/accueil/accueilUtils.js'
import { DoctorCaseloadPanel } from '@/components/doctor/DoctorCaseloadPanel.jsx'
import { NurseBedMapPanel } from '@/components/nurse/NurseBedMapPanel.jsx'
import { useClinicianDashboard } from '@/hooks/useClinicianDashboard.js'

const DOCTOR_ROLE = 'doctor'

const NAV_ITEMS = [
  { id: 'room', label: 'Ma salle', icon: HeartPulse },
  { id: 'beds', label: 'Plan des lits', icon: BedDouble },
  { id: 'queue', label: 'File d’attente', icon: LayoutList },
]

const WORKSPACE_META = {
  room: {
    title: 'Poste médecin',
    badge: 'Ma salle',
    description: 'Suivi des consultations et de l’occupation de votre salle.',
  },
  beds: {
    title: 'Plan des lits',
    badge: 'Vue hôpital',
    description: 'Cartographie des lits — ouvrez uniquement les patients de votre salle.',
  },
  queue: {
    title: 'File d’attente',
    badge: 'Lecture seule',
    description: 'Anticiper l’afflux vers votre salle (file gérée par accueil et infirmier).',
  },
}

export default function DoctorDashboardPage() {
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
    handleOpenConsultation,
    handleSaveConsultation,
    handleCloseVisit,
    handleStartObservation,
    handleEndObservation,
    handleCompleteDeparture,
    refreshDrawerDetail,
    logout,
  } = useClinicianDashboard(DOCTOR_ROLE)

  const [activeWorkspace, setActiveWorkspace] = useState('room')
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

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
    document.title = 'Médecin · PICU CARE'
  }, [])

  function openVisit(visitId) {
    setDrawerVisitId(visitId)
  }

  const meta = WORKSPACE_META[activeWorkspace] ?? WORKSPACE_META.room

  return (
    <AppShell
      role={DOCTOR_ROLE}
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

        {error ? <DashboardAlert variant="error">{error}</DashboardAlert> : null}

        {loading && !workspace ? (
          <p className="text-sm font-semibold text-text-secondary">Chargement du poste médecin…</p>
        ) : (
          <>
            {activeWorkspace === 'room' ? (
              <>
                <ClinicianKpiBar stats={workspace?.stats} role={DOCTOR_ROLE} />
                <div className="space-y-4">
                  <DoctorCaseloadPanel
                    pending={workspace?.pendingConsultation ?? []}
                    active={workspace?.activeConsultation ?? []}
                    onSelectVisit={openVisit}
                  />
                  <ClinicianRoomBoard
                    assignment={workspace?.assignment}
                    roomVisits={workspace?.roomVisits ?? []}
                    beds={workspace?.beds ?? []}
                    onSelectVisit={openVisit}
                  />
                </div>
              </>
            ) : null}

            {activeWorkspace === 'beds' ? (
              <NurseBedMapPanel
                beds={workspace?.allBeds ?? []}
                zones={workspace?.zones ?? []}
                highlightRoomId={workspace?.assignment?.roomId}
                assignFreeBeds={false}
                restrictOccupiedToRoom
                title="Plan des lits"
                subtitle={`Vue hôpital · ouvrez uniquement les patients de votre salle · ${workspace?.stats?.hospitalBedsFree ?? 0} lit(s) libre(s) au total`}
                onSelectOccupied={openVisit}
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
                onSelectVisit={openVisit}
                uncalledTitle="En attente"
                uncalledSubtitle="Non appelés"
                calledTitle="En attente"
                calledSubtitle="Appelés — placement infirmier"
                leading={
                  <DashboardAlert variant="info">
                    Lecture seule — la file est gérée par l’accueil et l’infirmier. Utile pour
                    anticiper l’afflux vers votre salle.
                  </DashboardAlert>
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
        consultationMode="doctor"
        allowCall={false}
        allowPlace={false}
        allowReturn={false}
        allowClose
        allowConsultation
        allowTriage={false}
        onOpenConsultation={handleOpenConsultation}
        onSaveConsultation={handleSaveConsultation}
        onCloseVisit={handleCloseVisit}
        allowCareFlow
        allowObservation
        allowCompleteDeparture
        onStartObservation={handleStartObservation}
        onEndObservation={handleEndObservation}
        onCompleteDeparture={handleCompleteDeparture}
        allowExamActions
        onRecordMutated={refreshDrawerDetail}
      />
    </AppShell>
  )
}
