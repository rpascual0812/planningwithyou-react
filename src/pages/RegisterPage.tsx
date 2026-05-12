import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const RegisterPage = () => {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (!agree) {
      setError('Please accept the Terms of use & Conditions.')
      return
    }
    setError(null)
    // Demo only – no backend; treat a valid form as a successful signup
    // and drop the user into the dashboard.
    navigate('/', { replace: true })
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
          <img src="/src/assets/images/logo.png" alt="Logo" width="64" height="64" />
        </div>

        <div className="auth-card">
          <h2 className="auth-title">Create your Account</h2>
          <p className="auth-subtitle">
            Sign up to start managing your projects and bookings with the team.
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span className="auth-label">Full name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Email address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
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
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Confirm Password</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />
            </label>

            <label className="auth-remember">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
              />
              <span>I agree to the Terms of use &amp; Conditions</span>
            </label>

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="auth-button">
              Create Account
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
            Already have an account?{' '}
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

export default RegisterPage
