import { LogOut, RefreshCw } from 'lucide-react'

import { displayName } from '@/api/auth.js'
import { dashboardIconButtonClass } from '@/components/layout/dashboardStyles.js'
import { getRoleDashboardMeta } from '@/theme/roleTheme.js'

export function RoleDashboardHeader({
  role,
  badgeLabel,
  subtitle,
  backendHealth,
  refreshing,
  onRefresh,
  user,
  onLogout,
  maxWidthClass = 'max-w-[1600px]',
  trailing,
}) {
  const { theme, label, icon: Icon } = getRoleDashboardMeta(role)
  const badge = badgeLabel ?? label
  const online = backendHealth?.status === 'ok'

  return (
    <header
      className={`sticky top-0 z-30 border-b ${theme.headerBorder} bg-white/75 shadow-sm shadow-slate-200/40 backdrop-blur-xl backdrop-saturate-150`}
    >
      <div
        className={`mx-auto flex ${maxWidthClass} items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8`}
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <div
            className={`flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${theme.iconGradient} ${theme.iconShadow}`}
          >
            {Icon ? <Icon className="size-6" aria-hidden="true" /> : null}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-slate-900">PICU CARE</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase ${theme.roleBadge}`}
              >
                {badge}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  online ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80' : 'bg-rose-50 text-rose-800 ring-1 ring-rose-200/80'
                }`}
                title={online ? 'Backend connecté' : 'Backend indisponible'}
              >
                <span
                  className={`size-1.5 rounded-full ${online ? 'animate-pulse bg-emerald-500' : 'bg-rose-500'}`}
                />
                {online ? 'En ligne' : 'Hors ligne'}
              </span>
            </div>
            <p className="truncate text-xs font-semibold text-slate-500">{subtitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {trailing}
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            title="Rafraîchir"
            aria-label="Rafraîchir les données"
            className={dashboardIconButtonClass}
          >
            <RefreshCw className={`size-4 ${refreshing ? `animate-spin ${theme.refreshActive}` : ''}`} />
          </button>

          <div className="flex items-center gap-2 border-l border-slate-200/80 pl-2 sm:gap-2.5 sm:pl-3">
            <div className="hidden text-right md:block">
              <p className="max-w-[180px] truncate text-xs font-extrabold leading-tight text-slate-900">
                {displayName(user)}
              </p>
              <p className={`max-w-[180px] truncate text-[11px] font-semibold ${theme.emailText}`}>
                {user?.email}
              </p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              title="Se déconnecter"
              aria-label="Se déconnecter"
              className={`${dashboardIconButtonClass} hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600`}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export function RolePrimaryButton({ role, className = '', children, ...props }) {
  const { theme } = getRoleDashboardMeta(role)
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-extrabold text-white transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500/25 ${theme.primaryBtn} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
