import { priorityBadgeClass, statusLabel } from '@/components/chief/chiefUtils.js'
import { dashboardPanelClass, dashboardPanelHeaderClass } from '@/components/layout/dashboardStyles.js'

export function ClinicianRoomBoard({ assignment, roomVisits, beds, onSelectVisit }) {
  if (!assignment?.roomId) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center">
        <h2 className="text-sm font-extrabold text-slate-900">Aucune salle assignée</h2>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
          Le chef de service doit vous affecter à une salle (équipe médecin + infirmiers) pour voir vos
          patients ici.
        </p>
      </section>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <section className={`overflow-hidden ${dashboardPanelClass}`}>
        <header className={dashboardPanelHeaderClass}>
          <h2 className="text-sm font-extrabold text-slate-900">
            {assignment.zoneName} · {assignment.roomName}
          </h2>
          <p className="text-xs font-semibold text-slate-500">
            {roomVisits.length} patient(s) actif(s) · {beds.filter((b) => !b.occupied).length} lit(s)
            libre(s)
          </p>
        </header>
        <ul className="divide-y divide-slate-100">
          {roomVisits.length === 0 ? (
            <li className="px-4 py-10 text-center text-xs font-semibold text-slate-400">
              Aucun patient dans votre salle pour le moment.
            </li>
          ) : (
            roomVisits.map((visit) => (
              <li key={visit.visitId}>
                <button
                  type="button"
                  onClick={() => onSelectVisit(visit.visitId)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-sky-50/70"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-slate-500">
                        {visit.publicCode}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ring-1 ring-inset ${priorityBadgeClass(visit.priority)}`}
                      >
                        P{visit.priority}
                      </span>
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                        {statusLabel(visit.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-extrabold text-slate-900">{visit.patientName}</p>
                    <p className="text-xs font-semibold text-sky-800">
                      Lit {visit.bedLabel}
                      {visit.assignedAt
                        ? ` · depuis ${new Date(visit.assignedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                        : ''}
                    </p>
                  </div>
                  <span className="text-xs font-extrabold text-sky-700">Ouvrir →</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <aside className={`p-4 sm:p-5 ${dashboardPanelClass}`}>
        <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Équipe de salle</h3>
        {assignment.doctor ? (
          <p className="mt-2 text-sm font-extrabold text-emerald-900">
            Dr {assignment.doctor.firstName} {assignment.doctor.lastName}
          </p>
        ) : (
          <p className="mt-2 text-xs font-semibold text-rose-700">Médecin responsable non défini</p>
        )}
        {assignment.nurses?.length ? (
          <ul className="mt-3 space-y-1.5 text-xs font-semibold text-slate-700">
            {assignment.nurses.map((nurse) => (
              <li key={nurse.id}>
                {nurse.firstName} {nurse.lastName}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs font-semibold text-slate-500">Aucune infirmière liée.</p>
        )}
        <div className="mt-4 space-y-1.5">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Lits</p>
          {beds.map((bed) => (
            <div
              key={bed.bedId}
              className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-bold ${
                bed.occupied ? 'bg-rose-50 text-rose-900' : 'bg-emerald-50 text-emerald-900'
              }`}
            >
              <span>{bed.bedLabel}</span>
              <span>{bed.occupied ? 'Occupé' : 'Libre'}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
