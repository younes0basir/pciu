import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
      setError(err instanceof Error ? err.message : 'Sign in failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-background text-foreground">
      <SignInPage
        heroImageSrc={PICU_HERO_IMAGE}
        testimonials={picuTestimonials}
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
