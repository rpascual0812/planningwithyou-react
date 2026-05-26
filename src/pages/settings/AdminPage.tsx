import { useCallback, useEffect, useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuthSession } from '../../context/AuthSessionContext'
import {
  canAccessAdminTab,
  firstAccessibleAdminTab,
} from '../../lib/adminNavAccess'
import { firstAccessiblePath } from '../../lib/appNavigation'
import AdminEmailPage from './AdminEmailPage'
import AdminKYBPage from './AdminKYBPage'
import AdminPayoutPage from './AdminPayoutPage'
import AdminSystemNotificationsPage from './AdminSystemNotificationsPage'
import AdminLegalPage from './AdminLegalPage'
import AdminSupportPage from './AdminSupportPage'
import type { AdminNavItem, AdminSection } from './types'

const TAB_PARAM = 'tab'

const NAV_ITEMS: AdminNavItem[] = [
  { id: 'kyb', label: 'Company Verification', icon: 'bi-buildings' },
  { id: 'emails', label: 'Emails', icon: 'bi-envelope' },
  { id: 'payouts', label: 'Payouts', icon: 'bi-cash-stack' },
  { id: 'notifications', label: 'System Notifications', icon: 'bi-megaphone' },
  { id: 'legal', label: 'Legal Documents', icon: 'bi-file-text' },
  { id: 'support', label: 'Support', icon: 'bi-chat-dots' },
]

const AdminPage = () => {
  const { currentUser } = useAuthSession()
  const [searchParams, setSearchParams] = useSearchParams()

  const visibleNav = useMemo(
    () => NAV_ITEMS.filter((item) => canAccessAdminTab(currentUser, item.id)),
    [currentUser],
  )

  const defaultTab = firstAccessibleAdminTab(currentUser)
  const rawTab = searchParams.get(TAB_PARAM)
  const activeNav: AdminSection =
    rawTab && visibleNav.some((item) => item.id === rawTab)
      ? (rawTab as AdminSection)
      : defaultTab

  useEffect(() => {
    if (!currentUser) return
    if (visibleNav.length === 0) return
    const tabInUrl = searchParams.get(TAB_PARAM)
    const urlTabValid =
      tabInUrl && visibleNav.some((item) => item.id === tabInUrl)
    if (urlTabValid) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (activeNav === 'kyb') next.delete(TAB_PARAM)
        else next.set(TAB_PARAM, activeNav)
        return next
      },
      { replace: true },
    )
  }, [activeNav, currentUser, searchParams, setSearchParams, visibleNav])

  const setActiveNav = useCallback(
    (id: AdminSection) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (id === 'kyb') next.delete(TAB_PARAM)
        else next.set(TAB_PARAM, id)
        return next
      }, { replace: true })
    },
    [setSearchParams],
  )

  if (visibleNav.length === 0) {
    return <Navigate to={firstAccessiblePath(currentUser)} replace />
  }

  const activeLabel =
    visibleNav.find((item) => item.id === activeNav)?.label ?? 'Admin'

  return (
    <div className="app-content">
      <div className="container-fluid">
        <div className="settings-layout">
          <aside className="settings-nav-card">
            <h5 className="settings-card-title">Admin</h5>
            <ul className="settings-nav">
              {visibleNav.map((item) => {
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
            <ActiveAdminPage activeNav={activeNav} />
          </section>
        </div>
      </div>
    </div>
  )
}

type ActiveAdminPageProps = {
  activeNav: AdminSection
}

const ActiveAdminPage = ({ activeNav }: ActiveAdminPageProps) => {
  const { currentUser } = useAuthSession()
  if (!canAccessAdminTab(currentUser, activeNav)) {
    return (
      <p className="text-muted small mb-0">
        You do not have permission to view this section.
      </p>
    )
  }

  switch (activeNav) {
    case 'kyb':
      return <AdminKYBPage />
    case 'emails':
      return <AdminEmailPage />
    case 'payouts':
      return <AdminPayoutPage />
    case 'notifications':
      return <AdminSystemNotificationsPage />
    case 'legal':
      return <AdminLegalPage />
    case 'support':
      return <AdminSupportPage />
    default:
      return null
  }
}

export default AdminPage
