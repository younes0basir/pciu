import { useState, useEffect } from 'react'
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  UsersRound,
  X,
} from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { displayName } from '@/api/auth.js'
import { getRoleDashboardMeta, getRoleDashboardTheme } from '@/theme/roleTheme.js'
import { RoleThemeProvider } from '@/contexts/RoleThemeContext.jsx'
import { cn } from '@/lib/utils.js'

export function AppShell({
  role = 'chief',
  user,
  backendHealth,
  refreshing = false,
  onRefresh,
  onLogout,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Recherche globale (Nom, code, CIN…)',
  navItems = [],
  activeNavId = 'flow',
  onSelectNav,
  lastUpdated = null,
  children,
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('picu_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const theme = getRoleDashboardTheme(role)
  const meta = getRoleDashboardMeta(role)
  const online = backendHealth?.status === 'ok'

  useEffect(() => {
    try {
      localStorage.setItem('picu_sidebar_collapsed', String(sidebarCollapsed))
    } catch {
      // storage disabled
    }
  }, [sidebarCollapsed])

  // Close mobile drawer on route/nav change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname, activeNavId])

  const defaultNavItems = [
    { id: 'flow', label: 'Supervision', icon: LayoutDashboard },
    { id: 'teams', label: 'Équipes & salles', icon: UsersRound },
    { id: 'ai', label: 'Mode IA', icon: Bot },
  ]

  const itemsToRender = navItems.length > 0 ? navItems : defaultNavItems

  return (
    <RoleThemeProvider role={role}>
      <div
        data-dashboard-role={role}
        className={cn(
          'dashboard-shell relative min-h-svh font-sans text-slate-800 antialiased flex flex-col bg-background selection:bg-primary/20',
          theme.selection
        )}
      >
        {/* Ambient background decoration */}
        <div className="dashboard-ambient pointer-events-none" aria-hidden="true">
          <span className={cn('dashboard-orb dashboard-orb-a', theme.orbA)} />
          <span className={cn('dashboard-orb dashboard-orb-b', theme.orbB)} />
        </div>

        {/* TOP BAR / HEADER */}
        <header
          className={cn(
            'sticky top-0 z-40 border-b bg-surface/85 shadow-2xs backdrop-blur-md backdrop-saturate-150 transition-colors',
            theme.headerBorder
          )}
        >
          <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-5">
            {/* Left: Mobile hamburger & Brand */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden flex size-9 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary hover:bg-surface-muted"
                aria-label="Ouvrir le menu de navigation"
              >
                <Menu className="size-5" />
              </button>

              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-xs font-black text-sm',
                    theme.iconGradient,
                    theme.iconShadow
                  )}
                  title="PICU - Plateforme Intelligente de Coordination des Urgences"
                >
                  P
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-sm sm:text-base tracking-tight text-text-primary">
                      PICU
                    </span>
                    <span className="text-[11px] font-semibold text-text-secondary hidden sm:inline">
                      · Urgences CHU Hassan II
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wider uppercase',
                        theme.roleBadge
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle: Global Search (if provided) */}
            {onSearchChange ? (
              <div className="hidden md:flex flex-1 max-w-md mx-4">
                <div className="relative w-full">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="search"
                    value={searchValue}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full rounded-xl border border-border bg-surface py-1.5 pl-9 pr-3 text-xs font-medium text-text-primary placeholder:text-text-secondary/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {searchValue ? (
                    <button
                      type="button"
                      onClick={() => onSearchChange('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Right: Sync Status, Refresh, User Profile, Logout */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Sync and Health badge */}
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border shadow-2xs',
                  online
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                )}
                title={
                  online
                    ? `Connecté en temps réel · Dernière synchro: ${lastUpdated || 'récente'}`
                    : 'Connexion interrompue - Tentative de reconnexion en cours'
                }
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full shrink-0',
                    online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  )}
                />
                <span className="hidden sm:inline font-bold">
                  {online ? 'En ligne' : 'Reconnexion…'}
                </span>
                {lastUpdated ? (
                  <span className="text-[10px] text-text-secondary opacity-75 hidden xl:inline">
                    · {lastUpdated}
                  </span>
                ) : null}
              </div>

              {/* Refresh button */}
              {onRefresh ? (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={refreshing}
                  title="Rafraîchir les données"
                  className="flex size-8 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary hover:bg-surface-muted hover:text-text-primary disabled:opacity-60"
                  aria-label="Rafraîchir"
                >
                  <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin text-primary')} />
                </button>
              ) : null}

              {/* User profile & Logout */}
              <div className="flex items-center gap-2 border-l border-border pl-2 sm:pl-3">
                <div className="hidden lg:block text-right">
                  <p className="max-w-[150px] truncate text-xs font-bold leading-tight text-text-primary">
                    {displayName(user)}
                  </p>
                  <p className="max-w-[150px] truncate text-[10px] text-text-secondary">
                    {user?.email || meta.label}
                  </p>
                </div>

                {onLogout ? (
                  <button
                    type="button"
                    onClick={onLogout}
                    title="Déconnexion"
                    aria-label="Se déconnecter"
                    className="flex size-8 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <LogOut className="size-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Mobile search bar if on mobile */}
          {onSearchChange ? (
            <div className="md:hidden px-3 pb-2 pt-1 border-t border-border/40">
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-secondary" />
                <input
                  type="search"
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-secondary/70 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          ) : null}
        </header>

        {/* BODY: SIDEBAR + MAIN WORKSPACE */}
        <div className="relative z-[1] flex-1 flex">
          {/* DESKTOP PERSISTENT SIDEBAR */}
          <aside
            className={cn(
              'hidden lg:flex flex-col border-r border-border bg-surface/75 backdrop-blur-md transition-all duration-200 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)]',
              sidebarCollapsed ? 'w-16' : 'w-56'
            )}
            aria-label="Navigation principale"
          >
            <div className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
              {itemsToRender.map((item) => {
                const Icon = item.icon
                const isActive = item.id === activeNavId
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectNav?.(item.id)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left group',
                      isActive
                        ? cn(theme.tabActive, 'shadow-xs')
                        : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    {!sidebarCollapsed ? (
                      <span className="truncate flex-1">{item.label}</span>
                    ) : null}
                    {!sidebarCollapsed && item.badge != null ? (
                      <span
                        className={cn(
                          'ml-auto rounded-full px-2 py-0.5 text-[10px] font-black',
                          isActive ? 'bg-white/20 text-white' : 'bg-surface-muted text-text-primary'
                        )}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>

            {/* Sidebar collapse toggle */}
            <div className="p-2 border-t border-border">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-text-secondary hover:bg-surface-muted hover:text-text-primary text-xs font-semibold"
                aria-label={sidebarCollapsed ? 'Agrandir la barre latérale' : 'Réduire la barre latérale'}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="size-4" />
                ) : (
                  <>
                    <ChevronLeft className="size-4" />
                    <span>Réduire menu</span>
                  </>
                )}
              </button>
            </div>
          </aside>

          {/* MOBILE OFF-CANVAS DRAWER */}
          {mobileMenuOpen ? (
            <div className="fixed inset-0 z-50 lg:hidden flex">
              <div
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
                onClick={() => setMobileMenuOpen(false)}
                aria-hidden="true"
              />
              <aside className="relative flex flex-col w-64 max-w-[80%] bg-surface border-r border-border p-4 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'flex size-8 items-center justify-center rounded-lg text-white font-black text-sm',
                        theme.iconGradient
                      )}
                    >
                      P
                    </div>
                    <span className="font-extrabold text-sm text-text-primary">Navigation</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 rounded-lg text-text-secondary hover:bg-surface-muted"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <div className="py-4 space-y-1 flex-1 overflow-y-auto">
                  {itemsToRender.map((item) => {
                    const Icon = item.icon
                    const isActive = item.id === activeNavId
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelectNav?.(item.id)
                          setMobileMenuOpen(false)
                        }}
                        className={cn(
                          'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left',
                          isActive
                            ? cn(theme.tabActive, 'shadow-xs')
                            : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate flex-1">{item.label}</span>
                        {item.badge != null ? (
                          <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-black bg-surface-muted">
                            {item.badge}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-text-secondary">
                  <span>{displayName(user)}</span>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="text-rose-600 font-bold hover:underline"
                  >
                    Déconnexion
                  </button>
                </div>
              </aside>
            </div>
          ) : null}

          {/* MAIN CONTENT WORKSPACE */}
          <main className="flex-1 min-w-0 p-3 sm:p-5 lg:p-6 max-w-[1850px] mx-auto w-full">
            {children}
          </main>
        </div>
      </div>
    </RoleThemeProvider>
  )
}
