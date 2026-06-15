import { useState } from 'react'

import UserEmailTemplatesPanel from './users/UserEmailTemplatesPanel'

const UserSettingsPage = () => {
  const [emailTemplatesOpen, setEmailTemplatesOpen] = useState(false)

  return (
    <div className="account-settings">
      <ul className="faq-list">
        <li className={`faq-item${emailTemplatesOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
            data-tour="settings-user-settings-email-templates"
            aria-expanded={emailTemplatesOpen}
            onClick={() => setEmailTemplatesOpen((prev) => !prev)}
          >
            <span className="faq-icon" aria-hidden="true">
              <i className="bi bi-envelope" />
            </span>
            <span className="faq-question">Email Templates</span>
            <span className="faq-chevron" aria-hidden="true">
              <i className="bi bi-chevron-down" />
            </span>
          </button>
          {emailTemplatesOpen && (
            <div className="faq-answer faq-answer--form">
              <p className="text-muted small mb-3">
                Customize user-related emails such as welcome, verify email, and password
                reset. Default templates include <code>welcome</code>,{' '}
                <code>verify_email</code>, and <code>password_reset</code>.
              </p>
              <UserEmailTemplatesPanel />
            </div>
          )}
        </li>
      </ul>
    </div>
  )
}

export default UserSettingsPage
