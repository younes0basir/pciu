import { Shield } from 'lucide-react'
import { ROLE_CONFIG } from './roleConfig.js'

export { ROLE_CONFIG }

export function RoleBadge({ role, showIcon = true, size = 'sm' }) {
  const config = ROLE_CONFIG[role] || {
    label: role,
    icon: Shield,
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
  }
  const Icon = config.icon

  const sizeClasses = size === 'xs' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border shadow-2xs ${config.badgeBg} ${sizeClasses}`}
    >
      {showIcon && <Icon className="size-3.5" />}
      <span>{config.label}</span>
    </span>
  )
}
