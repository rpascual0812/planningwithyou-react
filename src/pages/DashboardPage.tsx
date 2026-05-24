import { useCallback, useEffect, useMemo, useState } from 'react'
import CompanyDashboardGrid from '../components/dashboard/CompanyDashboardGrid'
import {
  fetchDashboardSummary,
  type DashboardCompanySummary,
} from '../services/dashboard'

const DashboardPage = () => {
  const [companies, setCompanies] = useState<DashboardCompanySummary[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchDashboardSummary()
      setCompanies(data.companies)
      setSelectedCompanyId((prev) => {
        if (prev != null && data.companies.some((c) => c.id === prev)) return prev
        const userCo = data.companies.find((c) => c.is_user_company)
        if (userCo) return userCo.id
        const mainCo = data.companies.find((c) => c.is_main)
        if (mainCo) return mainCo.id
        return data.companies[0]?.id ?? null
      })
    } catch {
      setError('Could not load dashboard reports.')
      setCompanies([])
      setSelectedCompanyId(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  )

  return (
    <div className="app-content dashboard-page">
      <div className="container-fluid">
        <header className="dash-toolbar">
          
          {companies.length > 1 && (
            <label className="dash-toolbar__select-wrap">
              <span className="visually-hidden">Company</span>
              <select
                className="form-select dash-toolbar__select"
                value={selectedCompanyId ?? ''}
                onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
                disabled={loading}
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                    {company.is_main ? ' (Main)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          {companies.length === 1 && selectedCompany && (
            <span className="dash-toolbar__company-name">{selectedCompany.name}</span>
          )}
        </header>

        {loading && (
          <p className="dash-report-empty" role="status">
            Loading reports…
          </p>
        )}
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
            <button
              type="button"
              className="btn btn-sm btn-outline-danger ms-2"
              onClick={() => void load()}
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && companies.length === 0 && (
          <p className="dash-report-empty">No active companies in this account.</p>
        )}
        {!loading && !error && selectedCompany && (
          <CompanyDashboardGrid company={selectedCompany} />
        )}

        {!loading && !error && companies.length > 1 && (
          <section className="dash-company-index" aria-label="All companies summary">
            <h2 className="dash-company-index__title">All companies</h2>
            <ul className="dash-company-index__list">
              {companies.map((company) => (
                <li key={company.id}>
                  <button
                    type="button"
                    className={
                      company.id === selectedCompanyId
                        ? 'dash-company-index__btn is-active'
                        : 'dash-company-index__btn'
                    }
                    onClick={() => setSelectedCompanyId(company.id)}
                  >
                    <strong>{company.name}</strong>
                    <span>
                      {company.bookings_owned.count} bookings ·{' '}
                      {company.bookings_owned.paid_amount} collected ·{' '}
                      {company.payouts.pending_count} pending payout
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

export default DashboardPage
