import { RoleThemeProvider } from '@/contexts/RoleThemeContext.jsx'
import { getRoleDashboardTheme } from '@/theme/roleTheme.js'

export function DashboardShell({ role, children, className = '' }) {
  const theme = getRoleDashboardTheme(role)

  return (
    <RoleThemeProvider role={role}>
      <div
        data-dashboard-role={role}
        className={`dashboard-shell relative min-h-svh font-sans text-slate-800 antialiased ${theme.selection} ${className}`}
      >
        <div className="dashboard-ambient pointer-events-none" aria-hidden="true">
          <span className={`dashboard-orb dashboard-orb-a ${theme.orbA}`} />
          <span className={`dashboard-orb dashboard-orb-b ${theme.orbB}`} />
        </div>
        <div className="relative z-[1]">{children}</div>
      </div>
    </RoleThemeProvider>
  )
}
