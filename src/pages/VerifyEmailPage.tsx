import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuthSession } from '../context/AuthSessionContext'
import { verifyEmailToken } from '../services/verifyEmail'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const VerifyEmailPage = () => {
  const navigate = useNavigate()
  const { syncAuthState } = useAuthSession()
  const { token } = useParams<{ token: string }>()
  const isValidToken = useMemo(
    () => Boolean(token && UUID_PATTERN.test(token)),
    [token],
  )

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isValidToken || !token) return

    let cancelled = false
    setStatus('loading')
    setMessage(null)

    void verifyEmailToken(token)
      .then(() => {
        if (cancelled) return
        setStatus('success')
        setMessage('Your email is verified. Signing you in…')
        syncAuthState()
        window.setTimeout(() => {
          navigate('/', { replace: true })
        }, 1200)
      })
      .catch((err) => {
        if (cancelled) return
        setStatus('error')
        setMessage(
          err instanceof Error
            ? err.message
            : 'Verification failed. Please try again.',
        )
      })

    return () => {
      cancelled = true
    }
  }, [isValidToken, token, syncAuthState, navigate])

  if (!isValidToken) {
    return <Navigate to="/login" replace />
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
          <h2 className="auth-title">Verify your email</h2>
          {status === 'loading' && (
            <p className="auth-subtitle">Confirming your email address…</p>
          )}
          {status === 'success' && (
            <p className="auth-subtitle auth-subtitle--success" role="status">
              {message}
            </p>
          )}
          {status === 'error' && (
            <>
              <p className="auth-error" role="alert">
                {message}
              </p>
              <p className="auth-switch">
                <Link to="/login" className="auth-switch-link">
                  Back to login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default VerifyEmailPage
