import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import AccountSettingsPage from './AccountSettingsPage'
import BookingsSettingsPage from './BookingsSettingsPage'
import CalendarSettingsPage from './CalendarSettingsPage'
import CompaniesSettingsPage from './CompaniesSettingsPage'
import EmailTemplatesSettingsPage from './EmailTemplatesSettingsPage'
import IntegrationsSettingsPage from './IntegrationsSettingsPage'
import RolesPermissionsSettingsPage from './RolesPermissionsSettingsPage'
import SubscriptionSettingsPage from './SubscriptionSettingsPage'
import type { SettingsNavItem, SettingsSection } from './types'

const TAB_PARAM = 'tab'
const VALID_TABS = new Set<SettingsSection>([
  'account', 'companies', 'calendar', 'bookings',
  'email-templates', 'permissions', 'connection', 'subscription',
])

const NAV_ITEMS: SettingsNavItem[] = [
  { id: 'account', label: 'Account', icon: 'bi-person-vcard' },
  { id: 'companies', label: 'Companies', icon: 'bi-building' },
  { id: 'calendar', label: 'Calendar', icon: 'bi-calendar3' },
  { id: 'bookings', label: 'Bookings', icon: 'bi-bookmark-check' },
  { id: 'email-templates', label: 'Email Templates', icon: 'bi-envelope-paper' },
  { id: 'permissions', label: 'Roles and Permissions', icon: 'bi-shield-lock' },
  { id: 'connection', label: 'Integrations', icon: 'bi-diagram-3' },
  { id: 'subscription', label: 'Subscription', icon: 'bi-credit-card' },
]

const SettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get(TAB_PARAM)
  const activeNav: SettingsSection =
    rawTab && VALID_TABS.has(rawTab as SettingsSection)
      ? (rawTab as SettingsSection)
      : 'account'

  const setActiveNav = useCallback(
    (id: SettingsSection) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (id === 'account') next.delete(TAB_PARAM)
        else next.set(TAB_PARAM, id)
        return next
      }, { replace: true })
    },
    [setSearchParams],
  )

  const activeLabel =
    NAV_ITEMS.find((item) => item.id === activeNav)?.label ?? 'Settings'

  return (
    <div className="app-content">
      <div className="container-fluid">
        <div className="settings-layout">
          <aside className="settings-nav-card">
            <h5 className="settings-card-title">Settings</h5>
            <ul className="settings-nav">
              {NAV_ITEMS.map((item) => {
                const isActive = activeNav === item.id
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`settings-nav-link${isActive ? ' is-active' : ''}`}
                      onClick={() => setActiveNav(item.id)}
                    >
                      <i className={`bi ${item.icon}`} aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>

          <section className="settings-main-card">
            <h5 className="settings-card-title">{activeLabel}</h5>
            <ActiveSettingsPage activeNav={activeNav} />
          </section>
        </div>
      </div>
    </div>
  )
}

type ActiveSettingsPageProps = {
  activeNav: SettingsSection
}

const ActiveSettingsPage = ({ activeNav }: ActiveSettingsPageProps) => {
  switch (activeNav) {
    case 'account':
      return <AccountSettingsPage />
    case 'companies':
      return <CompaniesSettingsPage />
    case 'email-templates':
      return <EmailTemplatesSettingsPage />
    case 'calendar':
      return <CalendarSettingsPage />
    case 'bookings':
      return <BookingsSettingsPage />
    case 'permissions':
      return <RolesPermissionsSettingsPage />
    case 'connection':
      return <IntegrationsSettingsPage />
    case 'subscription':
      return <SubscriptionSettingsPage />
    default:
      return null
  }
}

export default SettingsPage
