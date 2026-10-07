import { useState } from 'react'
import { X, KeyRound, Copy, Check, AlertCircle, Loader2, Link2, ShieldAlert } from 'lucide-react'
import { RoleBadge } from './RoleBadge.jsx'

export function ResetPasswordModal({ isOpen, onClose, user, onGenerateTempToken }) {
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  if (!isOpen || !user) return null

  function handleClose() {
    setError(null)
    setResult(null)
    setCopied(false)
    onClose()
  }

  async function handleGenerate() {
    setError(null)
    setLoading(true)
    try {
      const data = await onGenerateTempToken(user.id)
      const token = data?.tempToken
      const link = `${window.location.origin}/setup-password?token=${token}`
      setResult({
        tempToken: token,
        activationLink: link,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la génération du jeton temporaire.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!result?.activationLink) return
    try {
      await navigator.clipboard.writeText(result.activationLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={handleClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-amber-100 bg-white p-7 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
              <KeyRound className="size-5" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">Jeton Temporaire d'Accès</h3>
              <p className="text-xs font-semibold text-slate-500">
                Réinitialisation sécurisée sans mot de passe admin
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-700">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-slate-800">{user.fullName || `${user.firstName} ${user.lastName}`}</span>
              <RoleBadge role={user.role} size="xs" />
            </div>
            <p className="text-slate-500 font-semibold">{user.email}</p>
          </div>

          {result ? (
            <div className="space-y-3 animate-in fade-in">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs text-emerald-900">
                <p className="font-bold mb-1 flex items-center gap-1.5 text-emerald-700">
                  <Check className="size-4" /> Nouveau jeton temporaire généré !
                </p>
                L'ancien mot de passe a été révoqué. Le collaborateur doit utiliser ce lien pour en définir un nouveau (valide 48h).
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Link2 className="size-3.5 text-sky-600" /> Lien de Réinitialisation
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={result.activationLink}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono font-semibold text-slate-800 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-amber-700 transition"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3.5" /> Copié
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" /> Copier
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-2xl bg-slate-900 px-6 py-2.5 text-xs font-extrabold text-white hover:bg-slate-800 transition"
                >
                  Fermer
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900 space-y-2 leading-relaxed">
                <p className="font-bold flex items-center gap-1.5 text-amber-800">
                  <ShieldAlert className="size-4" />
                  Règle de sécurité stricte
                </p>
                <p>
                  Pour respecter les bonnes pratiques de sécurité, l'administrateur ne crée pas de mot de passe à la place du collaborateur.
                </p>
                <p>
                  Un jeton temporaire à usage unique sera généré. Vous pourrez lui envoyer le lien pour qu'il configure son mot de passe en toute confidentialité.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="rounded-2xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-2xl bg-amber-600 px-6 py-2.5 text-xs font-extrabold text-white shadow-md shadow-amber-600/20 hover:bg-amber-700 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Génération…
                    </>
                  ) : (
                    <>
                      <KeyRound className="size-4" />
                      Générer le Jeton Temporaire
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
