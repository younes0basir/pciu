import { useState } from 'react'
import { X, Edit3, AlertCircle, Loader2, ShieldCheck, Check } from 'lucide-react'
import { ROLE_CONFIG } from './roleConfig.js'

const AVAILABLE_ROLES = ['doctor', 'nurse', 'receptionist', 'chief']

export function EditUserModal({ isOpen, onClose, user, onUpdated }) {
  if (!isOpen || !user) return null

  return (
    <EditUserModalContent
      user={user}
      onClose={onClose}
      onUpdated={onUpdated}
    />
  )
}

function EditUserModalContent({ user, onClose, onUpdated }) {
  const [firstName, setFirstName] = useState(user.firstName || '')
  const [lastName, setLastName] = useState(user.lastName || '')
  const [email, setEmail] = useState(user.email || '')
  const [role, setRole] = useState(user.role || 'nurse')
  const [isActive, setIsActive] = useState(user.isActive ?? true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isCurrentAdmin = user.role === 'admin'

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!firstName.trim() || !lastName.trim()) {
      setError('Veuillez saisir le prénom et le nom.')
      return
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Veuillez saisir une adresse email valide.')
      return
    }

    setLoading(true)
    try {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        isActive,
      }
      if (!isCurrentAdmin) {
        payload.role = role
      }

      await onUpdated(user.id, payload)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la modification.')
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
      <div className="relative z-10 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl border border-sky-100 bg-white p-7 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sky-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 border border-sky-200">
              <Edit3 className="size-5" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">Modifier le Compte</h3>
              <p className="text-xs font-semibold text-slate-500">
                Mettre à jour l'identité ou les droits d'accès
              </p>
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
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Name inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Prénom *</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-sky-500/20 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Nom *</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-sky-500/20 transition"
              />
            </div>
          </div>

          {/* Email input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Adresse Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-sky-500/20 transition"
            />
          </div>

          {/* Role selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Rôle Opérationnel</label>
            {isCurrentAdmin ? (
              <div className="flex items-center gap-2 rounded-2xl border border-purple-200 bg-purple-50 p-3 text-xs font-bold text-purple-700">
                <ShieldCheck className="size-4 shrink-0" />
                <span>Compte Administrateur Système (verrouillé par l'environnement)</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_ROLES.map((r) => {
                  const conf = ROLE_CONFIG[r]
                  const Icon = conf.icon
                  const isSelected = role === r
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`flex items-center gap-2 p-2.5 rounded-2xl border text-xs font-extrabold transition ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-400/20'
                          : 'border-slate-200 bg-slate-50/40 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{conf.label}</span>
                      {isSelected && <Check className="size-3.5 ml-auto text-sky-600" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Active status toggle */}
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
            <div>
              <p className="text-xs font-bold text-slate-800">Statut du compte</p>
              <p className="text-[11px] font-semibold text-slate-500">
                {isActive ? 'Compte actif et autorisé à se connecter' : 'Compte désactivé (accès bloqué)'}
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={isCurrentAdmin}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-disabled:cursor-not-allowed peer-disabled:opacity-50"></div>
            </label>
          </div>

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
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-6 py-2.5 text-xs font-extrabold text-white shadow-md shadow-sky-600/20 hover:bg-sky-700 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  Enregistrer les modifications
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
