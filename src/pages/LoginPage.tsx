import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthSession } from '../context/AuthSessionContext'
import { loginWithJwt } from '../services/auth'

const LoginPage = () => {
  const navigate = useNavigate()
  const { syncAuthState } = useAuthSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit: NonNullable<React.ComponentProps<'form'>['onSubmit']> =
    async (e) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await loginWithJwt({ email, password, remember })
      syncAuthState()
      navigate('/', { replace: true })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to log in. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
    }

  return (
    <div className="auth-page">

      {/* Layered soft waves at the bottom of the viewport. */}
      <svg
        className="auth-bg-waves"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0,220 C220,260 420,150 720,180 C980,205 1180,275 1440,235 L1440,320 L0,320 Z"
          fill="rgba(82, 181, 133, 0.18)"
        />
        <path
          d="M0,250 C260,210 480,290 760,240 C1020,196 1220,240 1440,260 L1440,320 L0,320 Z"
          fill="rgba(31, 58, 95, 0.10)"
        />
        <path
          d="M0,280 C240,250 440,310 720,290 C1000,272 1240,310 1440,290 L1440,320 L0,320 Z"
          fill="rgba(82, 181, 133, 0.10)"
        />
      </svg>

      <div className="auth-card-wrap">
        <div className="auth-logo" aria-hidden="true">
          <img 
                src="/src/assets/images/logo.png"
                alt="Planning With You"
                width="84"
              />
        </div>

        <div className="auth-card">
          <h2 className="auth-title">Login to your Account</h2>
          <p className="auth-subtitle">
            Get started with our app, just create an account and enjoy the
            experience.
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span className="auth-label">Email address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
                autoComplete="email"
                required
                disabled={isSubmitting}
              />
              <small className="auth-hint">
                We'll never share your email with anyone else.
              </small>
            </label>

            <label className="auth-field">
              <span className="auth-label">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(null)
                }}
                autoComplete="current-password"
                required
                disabled={isSubmitting}
              />
            </label>

            <label className="auth-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={isSubmitting}
              />
              <span>remember me</span>
            </label>

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            <p className="auth-switch">
              <Link to="/reset-password" className="auth-switch-link">
                Forgot password?
              </Link>
            </p>

            <button type="submit" className="auth-button" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Continue'}
            </button>
          </form>

          <div className="auth-divider">
            <span>OR</span>
          </div>

          <div className="auth-social">
            <button
              type="button"
              className="auth-social-btn auth-social-btn--facebook"
              aria-label="Continue with Facebook"
            >
              <i className="bi bi-facebook" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="auth-social-btn auth-social-btn--google"
              aria-label="Continue with Google"
            >
              <i className="bi bi-google" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="auth-social-btn auth-social-btn--apple"
              aria-label="Continue with Apple"
            >
              <i className="bi bi-apple" aria-hidden="true" />
            </button>
          </div>

          <p className="auth-switch">
            Don't have an account?{' '}
            <Link to="/register" className="auth-switch-link">
              Register
            </Link>
          </p>

          <a href="#" className="auth-terms">
            Terms of use &amp; Conditions
          </a>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
