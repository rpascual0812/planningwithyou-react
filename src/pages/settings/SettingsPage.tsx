import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuthSession } from '../../context/AuthSessionContext'
import {
  canAccessSettingsTab,
  firstAccessibleSettingsTab,
} from '../../lib/settingsNavAccess'
import AccountSettingsPage from './AccountSettingsPage'
import BookingsSettingsPage from './BookingsSettingsPage'
import CalendarSettingsPage from './CalendarSettingsPage'
import CompaniesSettingsPage from './CompaniesSettingsPage'
import EmailTemplatesSettingsPage from './EmailTemplatesSettingsPage'
import IntegrationsSettingsPage from './IntegrationsSettingsPage'
import RolesPermissionsSettingsPage from './RolesPermissionsSettingsPage'
import SupplierSettingsPage from './SupplierSettingsPage'
import type { SettingsNavItem, SettingsSection } from './types'

const TAB_PARAM = 'tab'
const VALID_TABS = new Set<SettingsSection>([
  'account', 'companies', 'suppliers', 'calendar', 'bookings',
  'email-templates', 'permissions', 'connection',
])

const NAV_ITEMS: SettingsNavItem[] = [
  { id: 'account', label: 'Account Settings', icon: 'bi-person-vcard' },
  { id: 'companies', label: 'Company Settings', icon: 'bi-building' },
  { id: 'suppliers', label: 'Supplier Settings', icon: 'bi-truck' },
  { id: 'calendar', label: 'Calendar Settings', icon: 'bi-calendar3' },
  { id: 'bookings', label: 'Booking Settings', icon: 'bi-bookmark-check' },
  { id: 'email-templates', label: 'Email Templates', icon: 'bi-envelope-paper' },
  { id: 'permissions', label: 'Roles and Permissions', icon: 'bi-shield-lock' },
  // { id: 'connection', label: 'Integrations', icon: 'bi-diagram-3' },
]

const SettingsPage = () => {
  const { currentUser } = useAuthSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get(TAB_PARAM)
  const requestedNav: SettingsSection =
    rawTab === 'subscription'
      ? 'account'
      : rawTab && VALID_TABS.has(rawTab as SettingsSection)
        ? (rawTab as SettingsSection)
        : 'account'

  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => canAccessSettingsTab(currentUser, item.id)),
    [currentUser],
  )

  const activeNav: SettingsSection = canAccessSettingsTab(currentUser, requestedNav)
    ? requestedNav
    : firstAccessibleSettingsTab(currentUser)

  const sectionParam = searchParams.get('section')
  const accountAccordionOpen =
    rawTab === 'subscription' || sectionParam === 'subscription'
      ? 'subscription'
      : sectionParam === 'receipts'
        ? 'receipts'
        : undefined

  useEffect(() => {
    if (requestedNav === activeNav) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (activeNav === 'account') next.delete(TAB_PARAM)
        else next.set(TAB_PARAM, activeNav)
        return next
      },
      { replace: true },
    )
  }, [activeNav, requestedNav, setSearchParams])

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
    visibleNavItems.find((item) => item.id === activeNav)?.label ?? 'Settings'

  return (
    <div className="app-content">
      <div className="container-fluid">
        <div className="settings-layout">
          <aside className="settings-nav-card">
            <h5 className="settings-card-title">Settings</h5>
            <ul className="settings-nav">
              {visibleNavItems.map((item) => {
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
            <ActiveSettingsPage
              activeNav={activeNav}
              accountAccordionOpen={accountAccordionOpen}
            />
          </section>
        </div>
      </div>
    </div>
  )
}

type ActiveSettingsPageProps = {
  activeNav: SettingsSection
  accountAccordionOpen?: 'subscription' | 'receipts'
}

const ActiveSettingsPage = ({
  activeNav,
  accountAccordionOpen,
}: ActiveSettingsPageProps) => {
  switch (activeNav) {
    case 'account':
      return <AccountSettingsPage initialAccordion={accountAccordionOpen} />
    case 'companies':
      return <CompaniesSettingsPage />
    case 'suppliers':
      return <SupplierSettingsPage />
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
    default:
      return null
  }
}

export default SettingsPage
