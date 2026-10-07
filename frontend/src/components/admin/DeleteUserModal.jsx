import { useState } from 'react'
import { X, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { RoleBadge } from './RoleBadge.jsx'

export function DeleteUserModal({ isOpen, onClose, user, currentUserId, onDelete }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (!isOpen || !user) return null

  const isSelf = String(user.id) === String(currentUserId)
  const isEnvAdmin = user.role === 'admin'

  async function handleConfirm() {
    if (isSelf || isEnvAdmin) return
    setError(null)
    setLoading(true)
    try {
      await onDelete(user.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-rose-100 bg-white p-7 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rose-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200">
              <Trash2 className="size-5" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">Supprimer le Compte</h3>
              <p className="text-xs font-semibold text-slate-500">Action irréversible sur le personnel</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-700">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 space-y-4">
          {/* User info card */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-extrabold text-slate-900 text-sm">{user.fullName || `${user.firstName} ${user.lastName}`}</p>
              <RoleBadge role={user.role} />
            </div>
            <p className="text-xs font-semibold text-slate-600">{user.email}</p>
          </div>

          {isSelf ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-800">
              <p className="font-bold mb-1">Action non autorisée</p>
              Vous ne pouvez pas supprimer votre propre compte administrateur actuellement connecté.
            </div>
          ) : isEnvAdmin ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-800">
              <p className="font-bold mb-1">Compte système protégé</p>
              Le compte administrateur principal provisionné par le serveur ne peut pas être supprimé.
            </div>
          ) : (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-900 leading-relaxed">
              <p className="font-bold flex items-center gap-1.5 mb-1.5 text-rose-700">
                <AlertTriangle className="size-4" />
                Attention :
              </p>
              Êtes-vous sûr de vouloir supprimer définitivement ce compte ? Si ce praticien a un historique de consultations cliniques, le compte sera automatiquement désactivé afin de préserver l'intégrité médicolégale des audits.
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-2xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading || isSelf || isEnvAdmin}
              className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-6 py-2.5 text-xs font-extrabold text-white shadow-md shadow-rose-600/20 hover:bg-rose-700 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Suppression…
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  Confirmer la suppression
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
