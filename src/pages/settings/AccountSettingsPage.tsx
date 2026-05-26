import { useState } from 'react'
import { useFeatureAccess } from '../../hooks/useFeatureAccess'
import AccountInfoForm from './account/AccountInfoForm'
import SubscriptionSettingsPage from './SubscriptionSettingsPage'

type AccountSettingsPageProps = {
  /** Open a section on load (e.g. legacy `?tab=subscription`). */
  initialAccordion?: 'subscription'
}

const AccountSettingsPage = ({ initialAccordion }: AccountSettingsPageProps) => {
  const { canRead: accountRead } = useFeatureAccess('account_settings')
  const { canRead: subscriptionRead } = useFeatureAccess('subscription')
  const [infoOpen, setInfoOpen] = useState(false)
  const [subscriptionOpen, setSubscriptionOpen] = useState(
    initialAccordion === 'subscription',
  )

  return (
    <div className="account-settings">
      <ul className="faq-list">
        {accountRead && (
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
        )}

        {subscriptionRead && (
        <li className={`faq-item${subscriptionOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
            aria-expanded={subscriptionOpen}
            onClick={() => setSubscriptionOpen((prev) => !prev)}
          >
            <span className="faq-icon" aria-hidden="true">
              <i className="bi bi-credit-card" />
            </span>
            <span className="faq-question">Subscription</span>
            <span className="faq-chevron" aria-hidden="true">
              <i className="bi bi-chevron-down" />
            </span>
          </button>
          {subscriptionOpen && (
            <div className="faq-answer faq-answer--form">
              <SubscriptionSettingsPage />
            </div>
          )}
        </li>
        )}
      </ul>
    </div>
  )
}

export default AccountSettingsPage
