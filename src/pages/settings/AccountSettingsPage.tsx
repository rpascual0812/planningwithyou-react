import { useState } from 'react'
import AccountInfoForm from './account/AccountInfoForm'

const AccountSettingsPage = () => {
  const [infoOpen, setInfoOpen] = useState(true)

  return (
    <div className="account-settings">
      <ul className="faq-list">
        <li className={`faq-item${infoOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
            aria-expanded={infoOpen}
            onClick={() => setInfoOpen((prev) => !prev)}
          >
            <span className="faq-icon" aria-hidden="true">
              <i className="bi bi-person-vcard" />
            </span>
            <span className="faq-question">Account Information</span>
            <span className="faq-chevron" aria-hidden="true">
              <i className="bi bi-chevron-down" />
            </span>
          </button>
          {infoOpen && (
            <div className="faq-answer faq-answer--form">
              <AccountInfoForm />
            </div>
          )}
        </li>
      </ul>
    </div>
  )
}

export default AccountSettingsPage
