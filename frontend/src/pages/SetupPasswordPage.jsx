import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react'
import { getHomeRouteForRole, setupPasswordWithToken, validateTempToken } from '@/api/auth.js'
import { RoleBadge } from '@/components/admin/RoleBadge.jsx'

export default function SetupPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const urlToken = searchParams.get('token') || ''
  const [token, setToken] = useState(urlToken)

  const [validating, setValidating] = useState(false)
  const [tokenError, setTokenError] = useState(null)
  const [userProfile, setUserProfile] = useState(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Validate token on mount or when token changes
  useEffect(() => {
    if (!token.trim()) return

    let isMounted = true
    setValidating(true)
    setTokenError(null)

    validateTempToken(token.trim())
      .then((data) => {
        if (!isMounted) return
        setUserProfile(data.user)
      })
      .catch((err) => {
        if (!isMounted) return
        setTokenError(err instanceof Error ? err.message : 'Jeton invalide ou expiré.')
        setUserProfile(null)
      })
      .finally(() => {
        if (isMounted) setValidating(false)
      })

    return () => {
      isMounted = false
    }
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)

    if (!token.trim()) {
      setSubmitError('Jeton d’activation manquant.')
      return
    }

    if (newPassword.length < 6) {
      setSubmitError('Le mot de passe doit comporter au moins 6 caractères.')
      return
    }

    if (newPassword !== confirmPassword) {
      setSubmitError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setSubmitting(true)
    try {
      const data = await setupPasswordWithToken({
        token: token.trim(),
        newPassword,
      })
      setSuccess(true)
      setTimeout(() => {
        navigate(getHomeRouteForRole(data.user?.role))
      }, 1500)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Échec de la configuration du mot de passe.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-sky-50 via-white to-slate-100 p-4 font-sans text-slate-800 antialiased selection:bg-sky-500 selection:text-white">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25">
            <Shield className="size-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">PICU CARE</h1>
          <p className="text-xs font-semibold text-slate-500">
            Activation du Compte Professionnel Urgences
          </p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-sky-100/80 bg-white p-7 shadow-xl shadow-slate-200/50 backdrop-blur-md">
          {success ? (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto flex size-14 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 shadow-sm animate-in zoom-in-75">
                <CheckCircle2 className="size-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Compte Activé avec Succès !</h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  Redirection vers votre espace de travail en cours…
                </p>
              </div>
              <div className="flex justify-center pt-2">
                <Loader2 className="size-5 animate-spin text-sky-600" />
              </div>
            </div>
          ) : (
            <>
              {/* Token Input (if not in URL or invalid) */}
              {!urlToken && (
                <div className="mb-5 pb-5 border-b border-slate-100">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Jeton d'activation temporaire
                  </label>
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value.trim())}
                    placeholder="Collez votre jeton temporaire reçu…"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-mono font-semibold text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-sky-500/20 transition"
                  />
                </div>
              )}

              {/* Validating Spinner */}
              {validating && (
                <div className="py-6 text-center space-y-2">
                  <Loader2 className="mx-auto size-6 animate-spin text-sky-600" />
                  <p className="text-xs font-semibold text-slate-500">Vérification de votre invitation…</p>
                </div>
              )}

              {/* Token Error */}
              {tokenError && (
                <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="size-4 text-rose-600 shrink-0" />
                    <span className="font-bold">Lien ou jeton invalide</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-700">{tokenError}</p>
                  <p className="text-[11px] text-slate-500 pt-1">
                    Contactez votre administrateur pour obtenir un nouveau lien d'activation.
                  </p>
                </div>
              )}

              {/* Verified Staff Member Card */}
              {userProfile && (
                <div className="mb-5 rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Collaborateur Invité
                    </span>
                    <RoleBadge role={userProfile.role} size="xs" />
                  </div>
                  <p className="text-sm font-extrabold text-slate-900">{userProfile.fullName}</p>
                  <p className="text-xs font-semibold text-slate-600">{userProfile.email}</p>
                </div>
              )}

              {submitError && (
                <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-700">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Password Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Définir votre Mot de Passe *
                    </label>
                    <span className="text-[11px] font-semibold text-slate-400">Min. 6 caractères</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Votre mot de passe personnel"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 pr-11 text-sm font-semibold text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-sky-500/20 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Confirmer le Mot de Passe *
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Retapez votre mot de passe"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-sky-500/20 transition"
                  />
                </div>

                {/* Password match feedback */}
                {confirmPassword && (
                  <p
                    className={`text-[11px] font-bold flex items-center gap-1 ${
                      newPassword === confirmPassword ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {newPassword === confirmPassword ? (
                      <>
                        <Check className="size-3" /> Mots de passe identiques
                      </>
                    ) : (
                      <>
                        <AlertCircle className="size-3" /> Les mots de passe ne correspondent pas
                      </>
                    )}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting || validating || Boolean(tokenError)}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 py-3 text-xs font-extrabold text-white shadow-md shadow-sky-600/25 hover:from-sky-500 hover:to-blue-500 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Activation en cours…
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-4" />
                      Activer mon compte & Accéder
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-slate-500">
          Vous avez déjà activé votre compte ?{' '}
          <Link to="/login" className="font-bold text-sky-600 hover:underline">
            Se connecter directement
          </Link>
        </div>
      </div>
    </div>
  )
}
