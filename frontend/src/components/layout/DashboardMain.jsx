import { dashboardMainClass, dashboardMainNarrowClass } from '@/components/layout/dashboardStyles.js'

export function DashboardMain({ children, narrow = false, className = '' }) {
  const base = narrow ? dashboardMainNarrowClass : dashboardMainClass
  return <main className={`${base} ${className}`.trim()}>{children}</main>
}
