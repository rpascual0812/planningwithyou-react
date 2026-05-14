import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

function buildApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const base = (API_BASE_URL ?? '').replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${suffix}` : suffix
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ResetPasswordConfirmPage = () => {
  const navigate = useNavigate()
  const { token } = useParams<{ token: string }>()
  const isValidToken = useMemo(
    () => Boolean(token && UUID_PATTERN.test(token)),
    [token],
  )

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!isValidToken) {
    return <Navigate to="/reset-password" replace />
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch(buildApiUrl('/api/reset-password/confirm/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ token, password }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const detail =
          body?.token?.[0] || body?.password?.[0] || body?.detail || 'Something went wrong.'
        throw new Error(typeof detail === 'string' ? detail : 'Something went wrong.')
      }

      setSuccess(true)
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
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
          <h2 className="auth-title">Set a new Password</h2>
          <p className="auth-subtitle">
            Choose a strong password you haven't used before. You'll be signed
            out from other devices after the change.
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span className="auth-label">New password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(null)
                }}
                autoComplete="new-password"
                minLength={8}
                required
                disabled={submitting || success}
              />
              <small className="auth-hint">
                Minimum 8 characters. Use letters, numbers, and symbols.
              </small>
            </label>

            <label className="auth-field">
              <span className="auth-label">Confirm new password</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value)
                  setError(null)
                }}
                autoComplete="new-password"
                minLength={8}
                required
                disabled={submitting || success}
              />
            </label>

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="auth-success" role="status">
                Password updated. Redirecting to login…
              </p>
            )}

            <button
              type="submit"
              className="auth-button"
              disabled={submitting || success}
            >
              {submitting ? 'Updating...' : 'Update Password'}
            </button>
          </form>

          <p className="auth-switch mt-4">
            Remembered your password?{' '}
            <Link to="/login" className="auth-switch-link">
              Login
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

export default ResetPasswordConfirmPage
