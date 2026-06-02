import { useCallback, useEffect, useState } from 'react'
import ProfitProgressTagPopover from '../components/dashboard/ProfitProgressTagPopover'
import { fetchProfitProgressTagConfig } from '../services/config'
import {
  fetchDashboardProfitProgress,
  type DashboardProfitProgress,
} from '../services/dashboard'

const DashboardPage = () => {
  const [profit, setProfit] = useState<DashboardProfitProgress | null>(null)
  const [configuredTagId, setConfiguredTagId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfit = useCallback(async () => {
    try {
      const [config, progress] = await Promise.all([
        fetchProfitProgressTagConfig(),
        fetchDashboardProfitProgress(),
      ])
      const raw = config.value.trim()
      const parsed = raw ? Number.parseInt(raw, 10) : NaN
      setConfiguredTagId(Number.isFinite(parsed) ? parsed : null)
      setProfit(progress)
    } catch {
      setProfit({
        tag_id: null,
        tag_name: '',
        total_amount: '0.00',
        display_value: '0.00+',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProfit()
  }, [loadProfit])

  const displayValue = loading ? '…' : (profit?.display_value ?? '0.00+')
  const activeTagId = configuredTagId ?? profit?.tag_id ?? null

  return (
    <div className="app-content dashboard-page">
      <div className="container-fluid">
        <section className="dashboard-preview-cards" aria-label="Dashboard cards">
          <article className="dashboard-preview-card dashboard-preview-card--light">
            <div className="dashboard-preview-icon-circle">
              <i className="bi bi-graph-up-arrow" aria-hidden="true" />
            </div>
            <ProfitProgressTagPopover
              selectedTagId={activeTagId}
              onTagSaved={() => void loadProfit()}
            />
            <h2 className="dashboard-preview-value">{displayValue}</h2>
            <p className="dashboard-preview-label">
              Total profit Progress
              {profit?.tag_name ? (
                <span className="dashboard-preview-tag-name"> · {profit.tag_name}</span>
              ) : null}
            </p>
          </article>

          <article className="dashboard-preview-card dashboard-preview-card--teal">
            <div className="dashboard-preview-icon-circle dashboard-preview-icon-circle--light">
              <i className="bi bi-calendar2-check" aria-hidden="true" />
            </div>
            <i className="bi bi-calendar2-check dashboard-preview-watermark" aria-hidden="true" />
            <h2 className="dashboard-preview-value">15+</h2>
            <p className="dashboard-preview-label">Active Projects</p>
          </article>
        </section>
      </div>
    </div>
  )
}

export default DashboardPage
