import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { checkBackendHealth } from '@/api.js'
import { displayName, getHomeRouteForRole, getStoredAuth, logout } from '@/api/auth.js'
import { getRoleDashboardMeta } from '@/theme/roleTheme.js'

export default function BoardPage() {
  const [backendStatus, setBackendStatus] = useState(null)
  const auth = getStoredAuth()
  const role = auth?.user?.role ?? 'nurse'
  const { theme, label } = getRoleDashboardMeta(role)

  useEffect(() => {
    checkBackendHealth().then(setBackendStatus)
  }, [])

  const homeRoute = auth?.user ? getHomeRouteForRole(auth.user.role) : '/login'

  return (
    <div
      className={`flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-5 font-sans text-foreground ${theme.selection}`}
    >
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-6 py-4 shadow-sm">
        <div
          className={`size-3 rounded-full ${backendStatus?.status === 'ok' ? 'animate-pulse bg-primary' : 'bg-destructive'}`}
        />
        <span className="text-sm font-semibold text-muted-foreground">
          Backend: {backendStatus?.status === 'ok' ? 'Connected' : 'Checking…'}
        </span>
      </div>

      {auth?.user && (
        <p className="text-sm text-muted-foreground">
          Signed in as{' '}
          <span className="font-bold text-foreground">{displayName(auth.user)}</span>
          {label ? (
            <>
              {' '}
              · <span className={`font-bold ${theme.accentTextStrong}`}>{label}</span>
            </>
          ) : null}
        </p>
      )}

      <div className="max-w-md text-center text-sm font-medium text-muted-foreground">
        <p>
          Cette page vérifie la connexion API et vous oriente vers votre{' '}
          <strong className="text-foreground">tableau par rôle</strong> (accueil, infirmier, médecin,
          chef). Le flux opérationnel complet vit dans ces tableaux ;{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">GET /api/board</code> reste le
          snapshot JSON pour votre rôle.
        </p>
      </div>

      <Link
        to={homeRoute}
        className={`inline-flex items-center justify-center rounded-2xl px-8 py-4 text-xl font-extrabold text-white ${theme.primaryBtn}`}
      >
        Ouvrir mon tableau
      </Link>

      {auth?.user?.role === 'admin' && (
        <Link
          to="/admin"
          className={`inline-flex items-center gap-2 rounded-2xl border px-6 py-3 text-sm font-extrabold shadow-sm transition ${theme.roleBadge} border-current/20 hover:opacity-90`}
        >
          Console Administration
        </Link>
      )}

      <Link
        to="/login"
        onClick={() => {
          void logout()
        }}
        className={`text-sm font-semibold hover:underline ${theme.accentTextStrong}`}
      >
        Sign out
      </Link>
    </div>
  )
}
