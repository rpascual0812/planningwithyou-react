import { useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLegalLinks from '../components/AuthLegalLinks'

import logo from '/assets/images/logo.png';

const generateUuid = (): string => {
  const c =
    typeof globalThis !== 'undefined'
      ? (globalThis.crypto as Crypto | undefined)
      : undefined
  if (c?.randomUUID) return c.randomUUID()
  // RFC 4122 v4 fallback for older browsers.
  const bytes = new Uint8Array(16)
  if (c?.getRandomValues) {
    c.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
    .slice(6, 8)
    .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
}

const ResetPasswordPage = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    const resetToken = generateUuid()
    setToken(resetToken)
    setSubmitted(true)
    navigate(`/reset-password/${resetToken}`)
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
                src={logo}
                alt="Planning With You"
                width="84"
              />
        </div>

        <div className="auth-card">
          <h2 className="auth-title">Reset your Password</h2>
          <p className="auth-subtitle">
            Enter your email address and we'll send instructions to help you get
            back into your account.
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span className="auth-label">Email address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setSubmitted(false)
                }}
                autoComplete="email"
                required
              />
              <small className="auth-hint">
                We'll send a password reset link to this email.
              </small>
            </label>

            {submitted && token && (
              <div className="auth-reset-link" role="status">
                <p>If the email exists, a reset link has been sent:</p>
                <Link to={`/reset-password/${token}`} className="auth-switch-link">
                  /reset-password/{token}
                </Link>
              </div>
            )}

            <button type="submit" className="auth-button">
              Send Reset Link
            </button>
          </form>

          <p className="auth-switch mt-4">
            Remembered your password?{' '}
            <Link to="/login" className="auth-switch-link">
              Login
            </Link>
          </p>

          <p className="auth-switch">
            Don't have an account?{' '}
            <Link to="/register" className="auth-switch-link">
              Register
            </Link>
          </p>

          <AuthLegalLinks />
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordPage
