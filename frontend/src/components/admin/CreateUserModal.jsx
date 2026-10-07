import { useState } from 'react'
import { X, UserPlus, AlertCircle, Loader2, Link2, Copy, Check, Sparkles } from 'lucide-react'
import { ROLE_CONFIG } from './roleConfig.js'
import { RoleBadge } from './RoleBadge.jsx'

const AVAILABLE_ROLES = ['doctor', 'nurse', 'receptionist', 'chief']

export function CreateUserModal({ isOpen, onClose, onCreated }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [selectedRole, setSelectedRole] = useState('nurse')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Success state with activation link
  const [createdResult, setCreatedResult] = useState(null)
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  function resetForm() {
    setFirstName('')
    setLastName('')
    setEmail('')
    setSelectedRole('nurse')
    setError(null)
    setCreatedResult(null)
    setCopied(false)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!firstName.trim() || !lastName.trim()) {
      setError('Veuillez saisir le prénom et le nom.')
      return
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Veuillez saisir une adresse email professionnelle valide.')
      return
    }

    setLoading(true)
    try {
      const response = await onCreated({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        role: selectedRole,
      })

      const token = response?.tempToken || response?.user?.tempToken
      const link = `${window.location.origin}/setup-password?token=${token}`

      setCreatedResult({
        user: response?.user || response,
        tempToken: token,
        activationLink: link,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du compte.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopyLink() {
    if (!createdResult?.activationLink) return
    try {
      await navigator.clipboard.writeText(createdResult.activationLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
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
      <div className="relative z-10 w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl border border-sky-100 bg-white p-7 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sky-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 border border-sky-200">
              <UserPlus className="size-5" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">Nouveau Compte Personnel</h3>
              <p className="text-xs font-semibold text-slate-500">
                Génération automatique d'un jeton temporaire d'activation
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

        {createdResult ? (
          /* Step 2: Show Temporary Token & Activation Link */
          <div className="mt-5 space-y-5 animate-in fade-in zoom-in-95">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-600" /> Compte créé avec succès !
                </span>
                <RoleBadge role={createdResult.user?.role} size="xs" />
              </div>
              <p className="text-sm font-extrabold text-slate-900">
                {createdResult.user?.fullName || `${createdResult.user?.firstName} ${createdResult.user?.lastName}`}
              </p>
              <p className="text-xs font-semibold text-slate-600">{createdResult.user?.email}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                  <Link2 className="size-3.5 text-sky-600" /> Lien d'Activation Unique
                </label>
                <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  Valable 7 jours
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                Aucun mot de passe n'a été attribué par l'administrateur. Le praticien utilisera ce lien sécurisé pour définir son propre mot de passe personnel.
              </p>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  readOnly
                  value={createdResult.activationLink}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-semibold text-slate-700 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-sky-700 transition"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5" /> Copié !
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" /> Copier
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-2xl bg-slate-900 px-6 py-2.5 text-xs font-extrabold text-white hover:bg-slate-800 transition"
              >
                Terminé
              </button>
            </div>
          </div>
        ) : (
          /* Step 1: Account Info Form */
          <>
            {error && (
              <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-700">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              {/* Role Selection Cards */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Rôle Opérationnel & Permissions *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {AVAILABLE_ROLES.map((role) => {
                    const conf = ROLE_CONFIG[role]
                    const Icon = conf.icon
                    const isSelected = selectedRole === role
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setSelectedRole(role)}
                        className={`flex flex-col text-left p-3 rounded-2xl border transition-all text-xs ${
                          isSelected
                            ? 'border-sky-500 bg-sky-50/70 shadow-xs ring-2 ring-sky-400/30'
                            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div
                              className={`size-7 rounded-xl flex items-center justify-center ${
                                isSelected ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                              }`}
                            >
                              <Icon className="size-4" />
                            </div>
                            <span className="font-extrabold text-slate-800">{conf.label}</span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{conf.enLabel}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-snug">{conf.description}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Name inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Prénom *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ex. Amina"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-sky-500/20 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Nom *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Ex. Tazi"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-sky-500/20 transition"
                  />
                </div>
              </div>

              {/* Email input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">Adresse Email Professionnelle *</label>
                  <span className="text-[11px] font-semibold text-slate-400">Recommandé: @chu.ma</span>
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="a.tazi@chu.ma"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-sky-500/20 transition"
                />
              </div>

              {/* Security info note */}
              <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-3.5 text-xs text-sky-900 flex items-start gap-2.5">
                <Sparkles className="size-4 text-sky-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-semibold">
                  <strong>Sécurité renforcée :</strong> Vous n'attribuez aucun mot de passe. Le système générera un jeton temporaire et fournira un lien d'invitation sécurisé pour que le collaborateur configure son propre mot de passe.
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
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-6 py-2.5 text-xs font-extrabold text-white shadow-md shadow-sky-600/20 hover:bg-sky-700 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                  <Loader2 className="size-4 animate-spin" />
                  Génération du jeton…
                </>
              ) : (
                <>
                  <UserPlus className="size-4" />
                  Créer et Générer le Jeton
                </>
              )}
            </button>
          </div>
        </form>
          </>
        )}
      </div>
    </div>
  )
}
