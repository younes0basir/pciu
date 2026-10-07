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
import { ClinicianWaitingPanel } from '@/components/clinician/ClinicianWaitingPanel.jsx'
import { AccueilKpiBar } from '@/components/accueil/AccueilKpiBar.jsx'
import { AccueilPipelineColumn } from '@/components/accueil/AccueilPipelineColumn.jsx'
import { AccueilQueueList } from '@/components/accueil/AccueilQueueList.jsx'
import {
  boardVisitToCard,
  computeAccueilStats,
  filterAccueilWaiting,
} from '@/components/accueil/accueilUtils.js'
import { NurseBedMapPanel } from '@/components/nurse/NurseBedMapPanel.jsx'
import { NurseQuickPlaceModal } from '@/components/nurse/NurseQuickPlaceModal.jsx'
import { useClinicianDashboard } from '@/hooks/useClinicianDashboard.js'

const NURSE_ROLE = 'nurse'

const TABS = [
  { id: 'room', label: 'Ma salle', icon: HeartPulse },
  { id: 'beds', label: 'Salles & lits', icon: BedDouble },
  { id: 'queue', label: 'File d’attente', icon: LayoutList },
]

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
    logout,
  } = useClinicianDashboard(NURSE_ROLE)

  const [activeTab, setActiveTab] = useState('room')
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

  useEffect(() => {
    document.title = 'Infirmier · PICU CARE'
  }, [])

  async function confirmQuickPlace(visitId, bedId) {
    await handlePlaceVisit(visitId, bedId)
    setQuickPlaceBed(null)
    setNotice('Patient placé au lit avec succès.')
  }

  return (
    <DashboardShell role={NURSE_ROLE}>
        <RoleDashboardHeader
          role={NURSE_ROLE}
          subtitle="Triage, placement, suivi de salle et consultation pour le médecin"
          backendHealth={backendHealth}
          refreshing={refreshing}
          onRefresh={() => loadWorkspace(true)}
          user={auth?.user}
          onLogout={logout}
        />

        <DashboardMain narrow>
        <DashboardPageIntro
          title="Poste infirmier"
          description="Triage, lits, file d’attente et rédaction de consultation pour le médecin de salle."
          meta={`Dernière mise à jour ${workspace?.timestamp ? new Date(workspace.timestamp).toLocaleTimeString('fr-FR') : '—'}${workspace?.assignment?.roomName ? ` · Salle ${workspace.assignment.roomName}` : ''}`}
          tabs={
            <DashboardTabBar
              role={NURSE_ROLE}
              tabs={TABS}
              activeId={activeTab}
              onChange={setActiveTab}
              ariaLabel="Sections infirmier"
            />
          }
        />

          {notice ? <DashboardAlert variant="success">{notice}</DashboardAlert> : null}
          {error ? <DashboardAlert variant="error">{error}</DashboardAlert> : null}

          {loading && !workspace ? (
            <p className="text-sm font-semibold text-slate-500">Chargement du poste infirmier…</p>
          ) : (
            <>
              <ClinicianKpiBar stats={workspace?.stats} role={NURSE_ROLE} />

              {activeTab === 'room' ? (
                <div className="space-y-5">
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
              ) : null}

              {activeTab === 'beds' ? (
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
                    setQuickPlaceBed(bed)
                  }}
                />
              ) : null}

              {activeTab === 'queue' ? (
                <div className="space-y-5">
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
                      subtitle="Jamais appelé · triage possible"
                      visits={pipeline.uncalled}
                      tone="slate"
                      onSelectVisit={(visitId) => {
                        setNotice(null)
                        setDrawerVisitId(visitId)
                      }}
                    />
                    <AccueilPipelineColumn
                      title="En attente"
                      subtitle="Appelé · prêt à placer"
                      visits={pipeline.called}
                      tone="amber"
                      onSelectVisit={(visitId) => {
                        setNotice(null)
                        setDrawerVisitId(visitId)
                      }}
                    />
                  </div>

                  <AccueilQueueList
                    visits={filteredWaiting}
                    onSelectVisit={(visitId) => {
                      setNotice(null)
                      setDrawerVisitId(visitId)
                    }}
                  />
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
        />

        <NurseQuickPlaceModal
          open={Boolean(quickPlaceBed)}
          bed={quickPlaceBed}
          waitingPatients={waitingQueue}
          busy={actionBusy}
          onClose={() => setQuickPlaceBed(null)}
          onConfirm={confirmQuickPlace}
        />
    </DashboardShell>
  )
}
