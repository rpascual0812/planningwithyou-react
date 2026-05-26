import { useCallback, useEffect, useState } from 'react'
import ResourceHistoryPanel from '../../../components/ResourceHistoryPanel'
import {
  fetchCurrentAccount,
  updateAccount,
  type AccountRecord,
} from '../../../services/accounts'
import { historyPaths } from '../../../services/history'
import { useFeatureAccess } from '../../../hooks/useFeatureAccess'

const TIMEZONES = [...Intl.supportedValuesOf('timeZone')].sort()

const AccountInfoForm = () => {
  const { canWrite: accountWrite } = useFeatureAccess('account_settings')
  const [accountId, setAccountId] = useState<number | null>(null)
  const [accountName, setAccountName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactMobile, setContactMobile] = useState('')
  const [timezone, setTimezone] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [historyRefresh, setHistoryRefresh] = useState(0)

  const applyAccount = useCallback((account: AccountRecord) => {
    setAccountId(account.id)
    setAccountName(account.name ?? '')
    setContactPerson(account.contact_person ?? '')
    setContactEmail(account.contact_email ?? '')
    setContactMobile(account.contact_mobile_number ?? '')
    setTimezone(account.timezone ?? '')
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

  const handleSubmit: NonNullable<React.ComponentProps<'form'>['onSubmit']> = async (
    e,
  ) => {
    e.preventDefault()
    if (!accountWrite || accountId == null) return
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
      })
      applyAccount(updated)
      setSuccess('Account saved.')
      setHistoryRefresh((k) => k + 1)
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
    <>
    <form className="account-info-form" onSubmit={handleSubmit}>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {success && <div className="alert alert-success py-2">{success}</div>}

      <fieldset
        disabled={!accountWrite}
        className="account-info-fieldset border-0 m-0 p-0 min-w-0"
      >
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
      </fieldset>

      {accountWrite && (
        <div className="account-info-actions">
          <button type="submit" className="account-info-save" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}
    </form>

    {accountId != null && (
      <div className="mt-4 pt-3 border-top">
        <h3 className="h6 mb-3">Change history</h3>
        <ResourceHistoryPanel
          historyPath={historyPaths.account(accountId)}
          refreshKey={historyRefresh}
        />
      </div>
    )}
    </>
  )
}

export default AccountInfoForm
