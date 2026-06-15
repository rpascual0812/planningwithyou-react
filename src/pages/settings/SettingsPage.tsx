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
import EmailSettingsPage from './EmailSettingsPage'
import CompaniesSettingsPage from './CompaniesSettingsPage'
import UserSettingsPage from './UserSettingsPage'
import IntegrationsSettingsPage from './IntegrationsSettingsPage'
import RolesPermissionsSettingsPage from './RolesPermissionsSettingsPage'
import SupplierSettingsPage from './SupplierSettingsPage'
import type { SettingsNavItem, SettingsSection } from './types'

const TAB_PARAM = 'tab'
const VALID_TABS = new Set<SettingsSection>([
  'account', 'companies', 'user-settings', 'suppliers', 'calendar', 'email-settings', 'quotations',
  'permissions', 'connection',
])

const NAV_ITEMS: SettingsNavItem[] = [
  { id: 'account', label: 'Account Settings', icon: 'bi-person-vcard', description: 'Account Settings lets you manage your account information, subscription, and receipts.' },
  { id: 'companies', label: 'Company Settings', icon: 'bi-building', description: 'Company Settings lets you manage your companies and their settings.' },
  { id: 'user-settings', label: 'User Settings', icon: 'bi-people', description: 'User Settings lets you manage user-related email templates.' },
  { id: 'suppliers', label: 'Supplier Settings', icon: 'bi-truck', description: 'Supplier Settings lets you manage your suppliers and their settings.' },
  { id: 'calendar', label: 'Calendar Settings', icon: 'bi-calendar3', description: 'Calendar Settings lets you manage appointment statuses, email templates, and calendar integrations.' },
  { id: 'email-settings', label: 'Email Settings', icon: 'bi-envelope-at', description: 'Email Settings lets you connect email providers to send and receive messages from your account.' },
  { id: 'quotations', label: 'Quotation Settings', icon: 'bi-bookmark-check', description: 'Quotation Settings lets you manage your quotation view, group name, statuses, form templates, and email templates.' },
  { id: 'permissions', label: 'Roles and Permissions', icon: 'bi-shield-lock', description: 'Roles and Permissions lets you manage your roles and permissions.' },
  // { id: 'connection', label: 'Integrations', icon: 'bi-diagram-3' },
]

const SettingsPage = () => {
  const { currentUser } = useAuthSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get(TAB_PARAM)
  const requestedNav: SettingsSection =
    rawTab === 'subscription'
      ? 'account'
      : rawTab === 'email-templates'
        ? 'quotations'
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
                      data-tour={`settings-${item.id}`}
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
    case 'user-settings':
      return <UserSettingsPage />
    case 'suppliers':
      return <SupplierSettingsPage />
    case 'calendar':
      return <CalendarSettingsPage />
    case 'email-settings':
      return <EmailSettingsPage />
    case 'quotations':
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
