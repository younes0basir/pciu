import { useEffect, useRef } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils.js'

export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'warning', // 'warning' | 'danger' | 'primary'
  busy = false,
  onConfirm,
  onCancel,
}) {
  const confirmBtnRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !busy) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    confirmBtnRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, busy, onCancel])

  if (!open) return null

  const variantStyles = {
    warning: {
      icon: AlertTriangle,
      iconBox: 'bg-amber-100 text-amber-700',
      confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white',
    },
    danger: {
      icon: AlertTriangle,
      iconBox: 'bg-rose-100 text-rose-700',
      confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white',
    },
    primary: {
      icon: AlertTriangle,
      iconBox: 'bg-primary/10 text-primary',
      confirmBtn: 'bg-primary hover:bg-primary/90 text-white',
    },
  }[variant] || {
    icon: AlertTriangle,
    iconBox: 'bg-amber-100 text-amber-700',
    confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white',
  }

  const Icon = variantStyles.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={!busy ? onCancel : undefined}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl transition-all"
      >
        <div className="flex items-start gap-4">
          <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', variantStyles.iconBox)}>
            <Icon className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="confirm-dialog-title" className="text-base font-bold text-text-primary">
              {title}
            </h3>
            <p id="confirm-dialog-description" className="mt-1 text-xs text-text-secondary leading-relaxed">
              {description}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg p-1 text-text-secondary hover:bg-surface-muted hover:text-text-primary"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-text-secondary hover:bg-surface-muted hover:text-text-primary disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-xs disabled:opacity-50',
              variantStyles.confirmBtn
            )}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
