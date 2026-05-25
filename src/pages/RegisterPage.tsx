import { useEffect, useMemo, useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import PasswordInput from '../components/PasswordInput'
import SearchableSelect from '../components/SearchableSelect'
import { useAuthSession } from '../context/AuthSessionContext'
import { registerAccount } from '../services/register'
import { fetchPublicSupplierTypes, type SupplierTypeRecord } from '../services/supplierTypes'

const RegisterPage = () => {
  const navigate = useNavigate()
  const { syncAuthState } = useAuthSession()
  const [companyName, setCompanyName] = useState('')
  const [supplierTypeId, setSupplierTypeId] = useState('')
  const [supplierTypes, setSupplierTypes] = useState<SupplierTypeRecord[]>([])
  const [typesLoading, setTypesLoading] = useState(true)
  const [typesError, setTypesError] = useState<string | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setTypesLoading(true)
    setTypesError(null)
    void fetchPublicSupplierTypes()
      .then((rows) => {
        if (!cancelled) setSupplierTypes(rows)
      })
      .catch(() => {
        if (!cancelled) {
          setSupplierTypes([])
          setTypesError('Could not load company types. Refresh the page to try again.')
        }
      })
      .finally(() => {
        if (!cancelled) setTypesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const companyTypeOptions = useMemo(
    () =>
      supplierTypes.map((type) => ({
        value: String(type.id),
        label: type.name,
      })),
    [supplierTypes],
  )

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!supplierTypeId) {
      setError('Please choose a company type.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (!agree) {
      setError('Please accept the Terms of use & Conditions.')
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      await registerAccount({
        company_name: companyName.trim(),
        supplier_type_id: Number(supplierTypeId),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        mobile_number: mobile.trim(),
        password,
      })
      syncAuthState()
      navigate('/', { replace: true })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Registration failed. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
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
          <h2 className="auth-title">Create your Account</h2>
          <p className="auth-subtitle">
            Sign up to start managing your projects and bookings with the team.
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span className="auth-label">Company name</span>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoComplete="organization"
                required
              />
            </label>

            <SearchableSelect
              label="Company type"
              value={supplierTypeId}
              onChange={setSupplierTypeId}
              options={companyTypeOptions}
              placeholder="Choose company type…"
              searchPlaceholder="Search company types…"
              required
              disabled={Boolean(typesError)}
              loading={typesLoading}
              emptyMessage="No company types match your search"
              hint={
                typesError ??
                'Select the supplier category that best describes your business.'
              }
            />

            <label className="auth-field">
              <span className="auth-label">First name</span>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                required
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Last name</span>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
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
                We'll never share your email with anyone.
              </small>
            </label>

            <label className="auth-field">
              <span className="auth-label">Mobile number</span>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                autoComplete="tel"
                required
              />
              <small className="auth-hint">
                We'll never share your mobile number with anyone.
              </small>
            </label>

            <label className="auth-field">
              <span className="auth-label">Password</span>
              <PasswordInput
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                required
                minLength={6}
                disabled={isSubmitting}
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Confirm Password</span>
              <PasswordInput
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                required
                minLength={6}
                disabled={isSubmitting}
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

            <button
              type="submit"
              className="auth-button"
              disabled={typesLoading || isSubmitting}
            >
              {isSubmitting ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div className="auth-divider">
            <span>OR</span>
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
