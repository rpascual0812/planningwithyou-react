import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import ReportsPayoutPage from './reports/ReportsPayoutPage'
import type { ReportsNavItem, ReportsSection } from './reports/types'

const TAB_PARAM = 'tab'
const VALID_TABS = new Set<ReportsSection>(['payouts'])

const NAV_ITEMS: ReportsNavItem[] = [
  { id: 'payouts', label: 'Payment Received', icon: 'bi-cash-stack' },
]

const ReportsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get(TAB_PARAM)
  const activeNav: ReportsSection =
    rawTab && VALID_TABS.has(rawTab as ReportsSection)
      ? (rawTab as ReportsSection)
      : 'payouts'

  const setActiveNav = useCallback(
    (id: ReportsSection) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (id === 'payouts') next.delete(TAB_PARAM)
        else next.set(TAB_PARAM, id)
        return next
      }, { replace: true })
    },
    [setSearchParams],
  )

  const activeLabel =
    NAV_ITEMS.find((item) => item.id === activeNav)?.label ?? 'Reports'

  return (
    <div className="app-content">
      <div className="container-fluid">
        <div className="settings-layout">
          <aside className="settings-nav-card">
            <h5 className="settings-card-title">Reports</h5>
            <ul className="settings-nav">
              {NAV_ITEMS.map((item) => {
                const isActive = activeNav === item.id
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`settings-nav-link${isActive ? ' is-active' : ''}`}
                      data-tour="reports-payouts"
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
            {activeNav === 'payouts' && <ReportsPayoutPage />}
          </section>
        </div>
      </div>
    </div>
  )
}

export default ReportsPage
