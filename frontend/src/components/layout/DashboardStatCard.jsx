import { StatCard } from '@/components/ui/StatCard.jsx'

/**
 * @deprecated Use `StatCard` from `@/components/ui/StatCard.jsx`.
 * Kept as a thin alias so legacy dashboard KPI bars stay visually identical.
 */
export function DashboardStatCard(props) {
  return <StatCard {...props} />
}
