const VARIANTS = {
  error: 'border-rose-200/90 bg-rose-50/95 text-rose-900',
  success: 'border-emerald-200/90 bg-emerald-50/95 text-emerald-900',
  info: 'border-sky-200/90 bg-sky-50/95 text-sky-950',
}

export function DashboardAlert({ variant = 'error', children, className = '' }) {
  if (!children) return null
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`rounded-2xl border px-4 py-3 text-sm font-semibold leading-relaxed shadow-xs ${VARIANTS[variant] ?? VARIANTS.info} ${className}`}
    >
      {children}
    </div>
  )
}
