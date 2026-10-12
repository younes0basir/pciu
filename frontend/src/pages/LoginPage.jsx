import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const DEMO_ACCOUNTS = [
  { label: 'Accueil', email: 'receptionist@chu.ma', password: 'password123' },
  { label: 'Infirmier', email: 'nurse@chu.ma', password: 'password123' },
  { label: 'Médecin', email: 'doctor@chu.ma', password: 'password123' },
  { label: 'Chef', email: 'chief@chu.ma', password: 'password123' },
]

function fillLoginFields(email, password) {
  const emailInput = document.getElementById('email')
  const passwordInput = document.getElementById('password')
  if (emailInput instanceof HTMLInputElement) emailInput.value = email
  if (passwordInput instanceof HTMLInputElement) passwordInput.value = password
}
import { getHomeRouteForRole, login } from '@/api/auth.js'
import { PICU_HERO_IMAGE, picuTestimonials } from '@/auth/constants.js'
import { SignInPage } from '@/components/ui/sign-in.jsx'

export default function LoginPage() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSignIn(event) {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '')
    const password = String(formData.get('password') ?? '')

    setSubmitting(true)
    try {
      const auth = await login({ email, password })
      navigate(getHomeRouteForRole(auth?.user?.role))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connexion impossible.'
      setError(
        message.includes('Invalid email or password')
          ? 'Email ou mot de passe incorrect. En local, lancez npm run seed (backend) puis utilisez un compte démo ci‑dessous, ou admin@chu.ma avec ADMIN_PASSWORD du fichier backend/.env.'
          : message,
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-background text-foreground">
      <SignInPage
        heroImageSrc={PICU_HERO_IMAGE}
        testimonials={picuTestimonials}
        extraAboveForm={
          import.meta.env.DEV ? (
            <div className="animate-element animate-delay-250 rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-left text-xs text-amber-950">
              <p className="font-extrabold">Développement — comptes démo (mot de passe : password123)</p>
              <p className="mt-1 font-medium text-amber-900/90">
                Admin : <span className="font-mono">admin@chu.ma</span> → mot de passe{' '}
                <span className="font-mono">ADMIN_PASSWORD</span> dans{' '}
                <span className="font-mono">backend/.env</span> (réinitialisé à chaque démarrage API).
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    className="rounded-lg border border-amber-300/80 bg-white px-2.5 py-1 font-semibold text-amber-950 shadow-xs hover:bg-amber-100/80"
                    onClick={() => fillLoginFields(account.email, account.password)}
                  >
                    {account.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null
        }
        onSignIn={handleSignIn}
        onGoogleSignIn={() => setError('Google sign-in will connect when SSO is configured.')}
        onResetPassword={() => setError('Ask your admin to reset your PICU Board password.')}
        onCreateAccount={() => navigate('/register')}
        errorMessage={error}
        submitting={submitting}
      />
    </div>
  )
}
