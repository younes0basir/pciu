import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHomeRouteForRole, register } from '@/api/auth.js'
import { PICU_REGISTER_HERO_IMAGE } from '@/auth/constants.js'
import { SignUpPage } from '@/components/ui/sign-up.jsx'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSignUp(event) {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)
    const fullName = String(formData.get('fullName') ?? '')
    const email = String(formData.get('email') ?? '')
    const password = String(formData.get('password') ?? '')
    const confirmPassword = String(formData.get('confirmPassword') ?? '')
    const role = String(formData.get('role') ?? '')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const auth = await register({ fullName, email, password, role })
      navigate(getHomeRouteForRole(auth?.user?.role))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-background text-foreground">
      <SignUpPage
        heroImageSrc={PICU_REGISTER_HERO_IMAGE}
        onSignUp={handleSignUp}
        onSignIn={() => navigate('/login')}
        errorMessage={error}
        submitting={submitting}
      />
    </div>
  )
}
