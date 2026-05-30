import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useFeatureAccess } from '../../hooks/useFeatureAccess'
import AccountInfoForm from './account/AccountInfoForm'
import SubscriptionReceiptsSection from './account/SubscriptionReceiptsSection'
import SubscriptionSettingsPage from './SubscriptionSettingsPage'

type AccountSettingsAccordion = 'info' | 'subscription' | 'receipts'

type AccountSettingsPageProps = {
  /** Open a section on load (e.g. `?tab=subscription` or `?section=receipts`). */
  initialAccordion?: 'subscription' | 'receipts'
}

function resolveAccountSection(
  search: URLSearchParams,
  initialAccordion?: 'subscription' | 'receipts',
): AccountSettingsAccordion | null {
  const section = search.get('section')
  if (section === 'info' || section === 'subscription' || section === 'receipts') {
    return section
  }
  if (initialAccordion === 'subscription' || initialAccordion === 'receipts') {
    return initialAccordion
  }
  if (search.get('tab') === 'subscription') return 'subscription'
  return null
}

const AccountSettingsPage = ({ initialAccordion }: AccountSettingsPageProps) => {
  const [searchParams] = useSearchParams()
  const { canRead: accountRead } = useFeatureAccess('account_settings')
  const [infoOpen, setInfoOpen] = useState(false)
  const [subscriptionOpen, setSubscriptionOpen] = useState(false)
  const [receiptsOpen, setReceiptsOpen] = useState(false)

  useEffect(() => {
    const section = resolveAccountSection(searchParams, initialAccordion)
    setInfoOpen(section === 'info')
    setSubscriptionOpen(section === 'subscription')
    setReceiptsOpen(section === 'receipts')
  }, [searchParams, initialAccordion])

  return (
    <div className="account-settings">
      <ul className="faq-list">
        {accountRead && (
        <li className={`faq-item${infoOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
            data-tour="account-info"
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

        {accountRead && (
        <li className={`faq-item${subscriptionOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
            data-tour="account-subscription"
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

        {accountRead && (
        <li className={`faq-item${receiptsOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
            data-tour="account-receipts"
            aria-expanded={receiptsOpen}
            onClick={() => setReceiptsOpen((prev) => !prev)}
          >
            <span className="faq-icon" aria-hidden="true">
              <i className="bi bi-receipt" />
            </span>
            <span className="faq-question">Receipts</span>
            <span className="faq-chevron" aria-hidden="true">
              <i className="bi bi-chevron-down" />
            </span>
          </button>
          {receiptsOpen && (
            <div className="faq-answer faq-answer--form">
              <SubscriptionReceiptsSection />
            </div>
          )}
        </li>
        )}
      </ul>
    </div>
  )
}

export default AccountSettingsPage
