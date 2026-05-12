import { useState } from 'react'

const STATES = [
  'California',
  'Colorado',
  'Florida',
  'Illinois',
  'Massachusetts',
  'New York',
  'Texas',
  'Washington',
]

const AccountInfoForm = () => {
  const [accountName, setAccountName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactMobile, setContactMobile] = useState('')
  const [timezone, setTimezone] = useState('')

  const handleSubmit: NonNullable<React.ComponentProps<'form'>['onSubmit']> = (
    e
  ) => {
    e.preventDefault()
    // Demo only – no backend.
  }

  return (
    <form className="account-info-form" onSubmit={handleSubmit}>
      <label className="account-info-field">
        <span className="account-info-label">Account Name</span>
        <span className="account-info-control">
          <i className="bi bi-person account-info-icon" aria-hidden="true" />
          <input
            type="text"
            placeholder="Account Name"
            autoComplete="name"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
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
            type="number"
            placeholder="Contact Mobile Number"
            autoComplete="email"
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
            <option value="">Choose...</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
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
        <button type="submit" className="account-info-save">
          Save Changes
        </button>
      </div>
    </form>
  )
}

export default AccountInfoForm
