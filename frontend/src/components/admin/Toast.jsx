import { useEffect } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

export function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => {
      onClose()
    }, 4500)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null

  const isSuccess = toast.type === 'success'
  const isError = toast.type === 'error'

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div
        className={`flex items-start gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-md ${
          isSuccess
            ? 'border-emerald-200 bg-white/95 text-emerald-900 shadow-emerald-500/10'
            : isError
            ? 'border-rose-200 bg-white/95 text-rose-900 shadow-rose-500/10'
            : 'border-sky-200 bg-white/95 text-sky-900 shadow-sky-500/10'
        }`}
      >
        <div
          className={`rounded-xl p-1.5 ${
            isSuccess
              ? 'bg-emerald-100 text-emerald-600'
              : isError
              ? 'bg-rose-100 text-rose-600'
              : 'bg-sky-100 text-sky-600'
          }`}
        >
          {isSuccess ? (
            <CheckCircle2 className="size-4" />
          ) : isError ? (
            <AlertCircle className="size-4" />
          ) : (
            <Info className="size-4" />
          )}
        </div>

        <div className="flex-1 pr-2">
          {toast.title && <h4 className="text-xs font-extrabold">{toast.title}</h4>}
          <p className="text-xs font-semibold leading-relaxed text-slate-700">{toast.message}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
