import { createContext, useContext, useMemo } from 'react'

import { getRoleDashboardTheme } from '@/theme/roleTheme.js'

const RoleThemeContext = createContext(null)

export function RoleThemeProvider({ role, children }) {
  const theme = useMemo(() => getRoleDashboardTheme(role), [role])
  return <RoleThemeContext.Provider value={theme}>{children}</RoleThemeContext.Provider>
}

export function useRoleTheme() {
  const theme = useContext(RoleThemeContext)
  if (!theme) {
    throw new Error('useRoleTheme must be used within RoleThemeProvider')
  }
  return theme
}
