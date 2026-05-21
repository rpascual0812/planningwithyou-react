import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminEmailPage from './AdminEmailPage'
import AdminKYBPage from './AdminKYBPage'
import AdminSupportPage from './AdminSupportPage'
import type { AdminNavItem, AdminSection } from './types'

const TAB_PARAM = 'tab'
const VALID_TABS = new Set<AdminSection>([
  'kyb', 'emails', 'support'
])

const NAV_ITEMS: AdminNavItem[] = [
  { id: 'kyb', label: 'Company Verification', icon: 'bi-buildings' },
  { id: 'emails', label: 'Emails', icon: 'bi-envelope' },
  { id: 'support', label: 'Support', icon: 'bi-chat-dots' },
]

const AdminPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get(TAB_PARAM)
  const activeNav: AdminSection =
    rawTab && VALID_TABS.has(rawTab as AdminSection)
      ? (rawTab as AdminSection)
      : 'kyb'

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
            <ActiveAdminPage
              activeNav={activeNav}
            />
          </section>
        </div>
      </div>
    </div>
  )
}

type ActiveAdminPageProps = {
  activeNav: AdminSection
}

const ActiveAdminPage = ({
  activeNav,
}: ActiveAdminPageProps) => {
  switch (activeNav) {
    case 'kyb':
    //   return <AdminKYBPage/>
    return null
    case 'emails':
      return <AdminEmailPage />
    case 'support':
    return null
    //   return <AdminSupportPage />
    default:
      return null
  }
}

export default AdminPage
