import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

function GlassInputWrapper({ children }) {
  return (
    <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-sky-400/70 focus-within:bg-sky-500/10">
      {children}
    </div>
  )
}

export function SignUpPage({
  title = (
    <span className="font-light tracking-tighter text-foreground">
      Join <span className="font-semibold text-sky-600">PICU Board</span>
    </span>
  ),
  description = 'Create a staff account and choose the role you use on the floor.',
  heroImageSrc,
  onSignUp,
  onSignIn,
  errorMessage,
  submitting = false,
}) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="flex h-dvh w-dvw flex-col font-sans md:flex-row">
      <section className="flex flex-1 items-center justify-center overflow-y-auto p-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <h1 className="animate-element animate-delay-100 text-4xl leading-tight font-semibold md:text-5xl">
              {title}
            </h1>
            <p className="animate-element animate-delay-200 text-muted-foreground">{description}</p>

            <form className="space-y-5" onSubmit={onSignUp}>
              <div className="animate-element animate-delay-300">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="fullName">
                  Full name
                </label>
                <GlassInputWrapper>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Dr. Amal Benali"
                    className="w-full rounded-2xl bg-transparent p-4 text-sm focus:outline-none"
                  />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-350">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="email">
                  Work email
                </label>
                <GlassInputWrapper>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@chu.ma"
                    className="w-full rounded-2xl bg-transparent p-4 text-sm focus:outline-none"
                  />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-380">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="role">
                  Role
                </label>
                <GlassInputWrapper>
                  <select
                    id="role"
                    name="role"
                    required
                    defaultValue="receptionist"
                    className="w-full rounded-2xl bg-transparent p-4 text-sm focus:outline-none"
                  >
                    <option value="receptionist">Reception</option>
                    <option value="nurse">Nurse</option>
                    <option value="doctor">Doctor</option>
                    <option value="chief">Chief</option>
                  </select>
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-400">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="password">
                  Password
                </label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      placeholder="Create a password"
                      className="w-full rounded-2xl bg-transparent p-4 pr-12 text-sm focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-3 flex items-center"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-muted-foreground transition-colors hover:text-foreground" />
                      ) : (
                        <Eye className="h-5 w-5 text-muted-foreground transition-colors hover:text-foreground" />
                      )}
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-450">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="confirmPassword">
                  Confirm password
                </label>
                <GlassInputWrapper>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    className="w-full rounded-2xl bg-transparent p-4 text-sm focus:outline-none"
                  />
                </GlassInputWrapper>
              </div>

              {errorMessage && (
                <p className="rounded-2xl bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive" role="alert">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="animate-element animate-delay-600 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <p className="animate-element animate-delay-900 text-center text-sm text-muted-foreground">
              Already have access?{' '}
              <button type="button" onClick={onSignIn} className="text-sky-600 transition-colors hover:underline">
                Sign in
              </button>
            </p>
          </div>
        </div>
      </section>

      {heroImageSrc && (
        <section className="relative hidden flex-1 p-4 md:block">
          <div
            className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImageSrc})` }}
          />
        </section>
      )}
    </div>
  )
}
