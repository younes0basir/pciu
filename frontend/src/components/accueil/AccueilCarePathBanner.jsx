const STEPS = [
  { id: 'register', label: 'Enregistrer', owner: 'Accueil' },
  { id: 'call', label: 'Appeler', owner: 'Accueil' },
  { id: 'nurse', label: 'Triage & lit', owner: 'Infirmier' },
  { id: 'doctor', label: 'Consultation', owner: 'Médecin' },
]

const ACTIVE_INDEX = {
  accueil: 1,
  nurse: 2,
  doctor: 3,
}

export function AccueilCarePathBanner({ phase = 'accueil', calledCount = 0 }) {
  const activeIndex = ACTIVE_INDEX[phase] ?? 1
  const handoffHint =
    phase === 'accueil'
      ? calledCount > 0
        ? `${calledCount} patient(s) appelé(s) — prise en charge infirmière en salle d’attente ou au plan des lits.`
        : 'Après l’enregistrement, appelez le patient : il reste en file jusqu’à ce qu’un infirmier le place au lit.'
      : phase === 'nurse'
        ? 'Patients appelés par l’accueil : validez la priorité si besoin, puis placez-les sur un lit libre.'
        : 'Les étapes accueil et infirmier préparent la consultation médicale.';

  return (
    <section className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/90 to-white p-4 shadow-xs">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-sky-800">
            Parcours de prise en charge
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700">{handoffHint}</p>
        </div>
        <ol className="flex flex-wrap items-center gap-2">
          {STEPS.map((step, index) => {
            const done = index < activeIndex
            const current = index === activeIndex
            return (
              <li key={step.id} className="flex items-center gap-2">
                <span
                  className={`inline-flex flex-col rounded-xl border px-3 py-1.5 text-left ${
                    current
                      ? 'border-sky-300 bg-white ring-2 ring-sky-200'
                      : done
                        ? 'border-emerald-200 bg-emerald-50/80'
                        : 'border-slate-200 bg-slate-50/80'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {step.owner}
                  </span>
                  <span className="text-xs font-extrabold text-slate-900">{step.label}</span>
                </span>
                {index < STEPS.length - 1 ? (
                  <span className="hidden text-slate-300 sm:inline" aria-hidden="true">
                    →
                  </span>
                ) : null}
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
