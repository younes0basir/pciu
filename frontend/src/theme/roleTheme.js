import { ROLE_CONFIG } from '@/components/admin/roleConfig.js'

/** Tailwind class bundles for dashboard chrome — one palette per role. */
const DASHBOARD_PALETTE = {
  receptionist: {
    headerBorder: 'border-indigo-200/50',
    iconGradient: 'bg-gradient-to-br from-indigo-500 to-violet-600',
    iconShadow: 'shadow-indigo-500/25',
    roleBadge: 'bg-indigo-100/90 text-indigo-900 ring-1 ring-indigo-200/60',
    emailText: 'text-indigo-700',
    refreshActive: 'text-indigo-600',
    tabActive: 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white',
    orbA: 'bg-indigo-400/40',
    orbB: 'bg-violet-400/30',
    primaryBtn:
      'bg-gradient-to-r from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/20 hover:brightness-105 active:scale-[0.98]',
    modalIcon: 'bg-indigo-100 text-indigo-800',
    modalButton: 'bg-gradient-to-r from-indigo-500 to-violet-600',
    accentText: 'text-indigo-800',
    accentTextStrong: 'text-indigo-700',
    selection: 'selection:bg-indigo-500 selection:text-white',
  },
  chief: {
    headerBorder: 'border-amber-200/50',
    iconGradient: 'bg-gradient-to-br from-amber-500 to-orange-600',
    iconShadow: 'shadow-amber-500/25',
    roleBadge: 'bg-amber-100/90 text-amber-900 ring-1 ring-amber-200/60',
    emailText: 'text-amber-700',
    refreshActive: 'text-amber-600',
    tabActive: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white',
    orbA: 'bg-amber-400/35',
    orbB: 'bg-orange-400/25',
    primaryBtn:
      'bg-gradient-to-r from-amber-500 to-orange-600 shadow-md shadow-amber-500/20 hover:brightness-105 active:scale-[0.98]',
    modalIcon: 'bg-amber-100 text-amber-800',
    modalButton: 'bg-gradient-to-r from-amber-500 to-orange-600',
    accentText: 'text-amber-800',
    accentTextStrong: 'text-amber-700',
    selection: 'selection:bg-amber-500 selection:text-white',
  },
  admin: {
    headerBorder: 'border-purple-200/50',
    iconGradient: 'bg-gradient-to-br from-purple-600 to-indigo-700',
    iconShadow: 'shadow-purple-500/25',
    roleBadge: 'bg-purple-100/90 text-purple-900 ring-1 ring-purple-200/60',
    emailText: 'text-purple-700',
    refreshActive: 'text-purple-600',
    tabActive: 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white',
    orbA: 'bg-purple-500/30',
    orbB: 'bg-indigo-400/25',
    primaryBtn:
      'bg-gradient-to-r from-purple-600 to-indigo-700 shadow-md shadow-purple-600/25 hover:brightness-105 active:scale-[0.98]',
    modalIcon: 'bg-purple-100 text-purple-800',
    modalButton: 'bg-gradient-to-r from-purple-600 to-indigo-700',
    accentText: 'text-purple-800',
    accentTextStrong: 'text-purple-700',
    selection: 'selection:bg-purple-600 selection:text-white',
  },
  doctor: {
    headerBorder: 'border-emerald-200/50',
    iconGradient: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    iconShadow: 'shadow-emerald-500/25',
    roleBadge: 'bg-emerald-100/90 text-emerald-900 ring-1 ring-emerald-200/60',
    emailText: 'text-emerald-700',
    refreshActive: 'text-emerald-600',
    tabActive: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white',
    orbA: 'bg-emerald-400/35',
    orbB: 'bg-teal-400/25',
    primaryBtn:
      'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/20 hover:brightness-105 active:scale-[0.98]',
    modalIcon: 'bg-emerald-100 text-emerald-800',
    modalButton: 'bg-gradient-to-r from-emerald-500 to-teal-600',
    accentText: 'text-emerald-800',
    accentTextStrong: 'text-emerald-700',
    selection: 'selection:bg-emerald-600 selection:text-white',
  },
  nurse: {
    headerBorder: 'border-sky-200/50',
    iconGradient: 'bg-gradient-to-br from-sky-500 to-blue-600',
    iconShadow: 'shadow-sky-500/25',
    roleBadge: 'bg-sky-100/90 text-sky-900 ring-1 ring-sky-200/60',
    emailText: 'text-sky-700',
    refreshActive: 'text-sky-600',
    tabActive: 'bg-gradient-to-r from-sky-500 to-blue-600 text-white',
    orbA: 'bg-sky-400/35',
    orbB: 'bg-blue-400/25',
    primaryBtn:
      'bg-gradient-to-r from-sky-500 to-blue-600 shadow-md shadow-sky-500/20 hover:brightness-105 active:scale-[0.98]',
    modalIcon: 'bg-sky-100 text-sky-800',
    modalButton: 'bg-gradient-to-r from-sky-500 to-blue-600',
    accentText: 'text-sky-800',
    accentTextStrong: 'text-sky-700',
    selection: 'selection:bg-sky-600 selection:text-white',
  },
}

const FALLBACK_ROLE = 'receptionist'

export function getRoleDashboardTheme(role) {
  return DASHBOARD_PALETTE[role] ?? DASHBOARD_PALETTE[FALLBACK_ROLE]
}

export function getRoleDashboardMeta(role) {
  const config = ROLE_CONFIG[role]
  const theme = getRoleDashboardTheme(role)
  return {
    theme,
    label: config?.label ?? role ?? 'PICU',
    icon: config?.icon ?? null,
  }
}
