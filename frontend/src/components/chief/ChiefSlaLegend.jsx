export function ChiefSlaLegend({ sla }) {
  if (!sla) return null
  return (
    <p className="text-[11px] font-semibold text-slate-500">
      Seuils SLA : attente non appelée {sla.uncalledWaitingMinutes} min · appelé sans lit{' '}
      {sla.calledWaitingMinutes} min · au lit sans consult. {sla.placedWithoutStartMinutes} min ·
      prise en charge {sla.inTreatmentMinutes} min
      <span className="text-slate-400"> (variables CHIEF_SLA_* )</span>
    </p>
  )
}
