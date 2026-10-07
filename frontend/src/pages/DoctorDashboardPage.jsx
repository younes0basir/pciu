import { useEffect, useMemo, useState } from 'react'
import { BedDouble, HeartPulse, LayoutList, Search } from 'lucide-react'

import { RoleDashboardHeader } from '@/components/layout/RoleDashboardHeader.jsx'
import { DashboardAlert } from '@/components/layout/DashboardAlert.jsx'
import { DashboardMain } from '@/components/layout/DashboardMain.jsx'
import { DashboardPageIntro } from '@/components/layout/DashboardPageIntro.jsx'
import { DashboardShell } from '@/components/layout/DashboardShell.jsx'
import { DashboardTabBar } from '@/components/layout/DashboardTabBar.jsx'
import { dashboardInputClass, dashboardSelectClass } from '@/components/layout/dashboardStyles.js'
import { ChiefVisitDrawer } from '@/components/chief/ChiefVisitDrawer.jsx'
import { ClinicianKpiBar } from '@/components/clinician/ClinicianKpiBar.jsx'
import { ClinicianRoomBoard } from '@/components/clinician/ClinicianRoomBoard.jsx'
import { AccueilKpiBar } from '@/components/accueil/AccueilKpiBar.jsx'
import { AccueilPipelineColumn } from '@/components/accueil/AccueilPipelineColumn.jsx'
import { AccueilQueueList } from '@/components/accueil/AccueilQueueList.jsx'
import {
  boardVisitToCard,
  computeAccueilStats,
  filterAccueilWaiting,
} from '@/components/accueil/accueilUtils.js'
import { DoctorCaseloadPanel } from '@/components/doctor/DoctorCaseloadPanel.jsx'
import { NurseBedMapPanel } from '@/components/nurse/NurseBedMapPanel.jsx'
import { useClinicianDashboard } from '@/hooks/useClinicianDashboard.js'

const DOCTOR_ROLE = 'doctor'

const TABS = [
  { id: 'room', label: 'Ma salle', icon: HeartPulse },
  { id: 'beds', label: 'Plan des lits', icon: BedDouble },
  { id: 'queue', label: 'File d’attente', icon: LayoutList },
]

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
    logout,
  } = useClinicianDashboard(DOCTOR_ROLE)

  const [activeTab, setActiveTab] = useState('room')
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

  useEffect(() => {
    document.title = 'Médecin · PICU CARE'
  }, [])

  function openVisit(visitId) {
    setDrawerVisitId(visitId)
  }

  return (
    <DashboardShell role={DOCTOR_ROLE}>
        <RoleDashboardHeader
          role={DOCTOR_ROLE}
          subtitle="Consultations, clôtures et vue file — salle assignée"
          backendHealth={backendHealth}
          refreshing={refreshing}
          onRefresh={() => loadWorkspace(true)}
          user={auth?.user}
          onLogout={logout}
        />

        <DashboardMain narrow>
        <DashboardPageIntro
          title="Poste médecin"
          description="Suivi des consultations et de l’occupation de votre salle."
          meta={`Dernière mise à jour ${workspace?.timestamp ? new Date(workspace.timestamp).toLocaleTimeString('fr-FR') : '—'}${workspace?.assignment?.roomName ? ` · Salle ${workspace.assignment.roomName}` : ''}`}
          tabs={
            <DashboardTabBar
              role={DOCTOR_ROLE}
              tabs={TABS}
              activeId={activeTab}
              onChange={setActiveTab}
              ariaLabel="Sections médecin"
            />
          }
        />

          {error ? <DashboardAlert variant="error">{error}</DashboardAlert> : null}

          {loading && !workspace ? (
            <p className="text-sm font-semibold text-slate-500">Chargement du poste médecin…</p>
          ) : (
            <>
              <ClinicianKpiBar stats={workspace?.stats} role={DOCTOR_ROLE} />

              {activeTab === 'room' ? (
                <div className="space-y-5">
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
              ) : null}

              {activeTab === 'beds' ? (
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

              {activeTab === 'queue' ? (
                <div className="space-y-5">
                  <DashboardAlert variant="info">
                    Lecture seule — la file est gérée par l’accueil et l’infirmier. Utile pour anticiper
                    l’afflux vers votre salle.
                  </DashboardAlert>

                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="relative flex-1 sm:max-w-xs">
                      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Nom, code, CIN…"
                        className={`${dashboardInputClass} pl-10`}
                      />
                    </div>
                    <select
                      value={priorityFilter}
                      onChange={(event) => setPriorityFilter(event.target.value)}
                      className={dashboardSelectClass}
                    >
                      <option value="all">Toutes priorités</option>
                      <option value="2">P1–P2</option>
                      <option value="3">P1–P3</option>
                      <option value="5">P1–P5</option>
                    </select>
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className={dashboardSelectClass}
                    >
                      <option value="all">Tous</option>
                      <option value="uncalled">Non appelés</option>
                      <option value="called">Appelés</option>
                    </select>
                  </div>

                  <AccueilKpiBar stats={queueStats} />

                  <div className="grid gap-3 lg:grid-cols-2">
                    <AccueilPipelineColumn
                      title="En attente"
                      subtitle="Non appelés"
                      visits={pipeline.uncalled}
                      tone="slate"
                    />
                    <AccueilPipelineColumn
                      title="En attente"
                      subtitle="Appelés — placement infirmier"
                      visits={pipeline.called}
                      tone="amber"
                    />
                  </div>

                  <AccueilQueueList visits={filteredWaiting} />
                </div>
              ) : null}
            </>
          )}
        </DashboardMain>

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
        />
    </DashboardShell>
  )
}
