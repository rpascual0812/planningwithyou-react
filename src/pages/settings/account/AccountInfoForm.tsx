import { useCallback, useEffect, useState } from 'react'
import { fetchSecuredFileBlobUrl } from '../../../lib/securedFileUrl'
import {
  fetchCurrentAccount,
  updateAccount,
  type AccountRecord,
} from '../../../services/accounts'

const TIMEZONES = [...Intl.supportedValuesOf('timeZone')].sort()

const AccountInfoForm = () => {
  const [accountId, setAccountId] = useState<number | null>(null)
  const [accountName, setAccountName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactMobile, setContactMobile] = useState('')
  const [timezone, setTimezone] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoDisplayUrl, setLogoDisplayUrl] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const applyAccount = useCallback((account: AccountRecord) => {
    setAccountId(account.id)
    setAccountName(account.name ?? '')
    setContactPerson(account.contact_person ?? '')
    setContactEmail(account.contact_email ?? '')
    setContactMobile(account.contact_mobile_number ?? '')
    setTimezone(account.timezone ?? '')
    setLogoUrl(account.logo_url ?? '')
    setLogoFile(null)
    setLogoPreview(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchCurrentAccount()
      .then((account) => {
        if (!cancelled) applyAccount(account)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load account')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [applyAccount])

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null)
      return
    }
    const url = URL.createObjectURL(logoFile)
    setLogoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [logoFile])

  useEffect(() => {
    if (logoPreview) {
      setLogoDisplayUrl(logoPreview)
      return
    }
    if (!logoUrl) {
      setLogoDisplayUrl('')
      return
    }
    let objectUrl = ''
    let cancelled = false
    fetchSecuredFileBlobUrl(logoUrl)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        objectUrl = url
        setLogoDisplayUrl(url)
      })
      .catch(() => {
        if (!cancelled) setLogoDisplayUrl('')
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [logoUrl, logoPreview])

  const handleSubmit: NonNullable<React.ComponentProps<'form'>['onSubmit']> = async (
    e,
  ) => {
    e.preventDefault()
    if (accountId == null) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = await updateAccount(accountId, {
        name: accountName.trim(),
        contact_person: contactPerson.trim(),
        contact_email: contactEmail.trim(),
        contact_mobile_number: contactMobile.trim(),
        timezone,
        ...(logoFile ? { logo: logoFile } : {}),
      })
      applyAccount(updated)
      setSuccess('Account saved.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save account')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-muted small">Loading account…</div>
  }

  return (
    <form className="account-info-form" onSubmit={handleSubmit}>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {success && <div className="alert alert-success py-2">{success}</div>}

      <label className="account-info-field">
        <span className="account-info-label">Logo</span>
        <span className="account-info-control account-info-control--logo">
          {logoDisplayUrl ? (
            <img
              src={logoDisplayUrl}
              alt=""
              className="account-info-logo-preview"
            />
          ) : (
            <span className="text-muted small">No logo uploaded</span>
          )}
          <input
            type="file"
            accept="image/*"
            className="form-control form-control-sm mt-2"
            onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
          />
        </span>
      </label>

      <label className="account-info-field">
        <span className="account-info-label">Account Name</span>
        <span className="account-info-control">
          <i className="bi bi-building account-info-icon" aria-hidden="true" />
          <input
            type="text"
            placeholder="Account Name"
            autoComplete="organization"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            required
          />
        </span>
      </label>

      <label className="account-info-field">
        <span className="account-info-label">Contact Person</span>
        <span className="account-info-control">
          <i className="bi bi-person account-info-icon" aria-hidden="true" />
          <input
            type="text"
            placeholder="Contact Person"
            autoComplete="name"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
          />
        </span>
      </label>

      <label className="account-info-field">
        <span className="account-info-label">Contact Email</span>
        <span className="account-info-control">
          <i className="bi bi-envelope account-info-icon" aria-hidden="true" />
          <input
            type="email"
            placeholder="Contact Email Address"
            autoComplete="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
        </span>
      </label>

      <label className="account-info-field">
        <span className="account-info-label">Contact Mobile #</span>
        <span className="account-info-control">
          <i className="bi bi-telephone account-info-icon" aria-hidden="true" />
          <input
            type="tel"
            placeholder="Contact Mobile Number"
            autoComplete="tel"
            value={contactMobile}
            onChange={(e) => setContactMobile(e.target.value)}
          />
        </span>
      </label>

      <label className="account-info-field">
        <span className="account-info-label">Timezone</span>
        <span className="account-info-control account-info-control--select">
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            aria-label="Timezone"
          >
            <option value="">Choose…</option>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          <i
            className="bi bi-chevron-down account-info-chevron"
            aria-hidden="true"
          />
        </span>
      </label>

      <div className="account-info-actions">
        <button type="submit" className="account-info-save" disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

export default AccountInfoForm
