import { useCallback, useEffect, useState } from 'react'
import ActiveProjectsTagPopover from '../components/dashboard/ActiveProjectsTagPopover'
import CompanyFilterSelect from '../components/CompanyFilterSelect'
import ProfitProgressTagPopover from '../components/dashboard/ProfitProgressTagPopover'
import { useCompanyFilter } from '../hooks/useCompanyFilter'
import {
  fetchActiveProjectsTagConfig,
  fetchProfitProgressTagConfig,
} from '../services/config'
import {
  fetchDashboardActiveProjects,
  fetchDashboardProfitProgress,
  type DashboardActiveProjects,
  type DashboardProfitProgress,
} from '../services/dashboard'

const emptyProfit = (companyId: number): DashboardProfitProgress => ({
  company_id: companyId,
  tag_id: null,
  tag_name: '',
  total_amount: '0.00',
  display_value: '0.00+',
})

const emptyActiveProjects = (companyId: number): DashboardActiveProjects => ({
  company_id: companyId,
  tag_id: null,
  tag_name: '',
  count: 0,
  display_value: '0',
})

const parseConfiguredTagId = (raw: string): number | null => {
  const trimmed = raw.trim()
  const parsed = trimmed ? Number.parseInt(trimmed, 10) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

const DashboardPage = () => {
  const {
    companies,
    companiesLoading,
    selectedCompanyId,
    setSelectedCompanyId,
    activeCompanyId,
  } = useCompanyFilter()

  const [profit, setProfit] = useState<DashboardProfitProgress | null>(null)
  const [activeProjects, setActiveProjects] = useState<DashboardActiveProjects | null>(
    null,
  )
  const [configuredProfitTagId, setConfiguredProfitTagId] = useState<number | null>(null)
  const [configuredProjectsTagId, setConfiguredProjectsTagId] = useState<number | null>(
    null,
  )
  const [profitLoading, setProfitLoading] = useState(true)
  const [activeProjectsLoading, setActiveProjectsLoading] = useState(true)

  const loadProfit = useCallback(async (companyId: number) => {
    setProfitLoading(true)
    try {
      const [profitConfig, profitData] = await Promise.all([
        fetchProfitProgressTagConfig(companyId),
        fetchDashboardProfitProgress(companyId),
      ])
      setConfiguredProfitTagId(parseConfiguredTagId(profitConfig.value))
      setProfit(profitData)
    } catch {
      setConfiguredProfitTagId(null)
      setProfit(emptyProfit(companyId))
    } finally {
      setProfitLoading(false)
    }
  }, [])

  const loadActiveProjects = useCallback(async (companyId: number) => {
    setActiveProjectsLoading(true)
    try {
      const [projectsConfig, projectsData] = await Promise.all([
        fetchActiveProjectsTagConfig(companyId),
        fetchDashboardActiveProjects(companyId),
      ])
      setConfiguredProjectsTagId(parseConfiguredTagId(projectsConfig.value))
      setActiveProjects(projectsData)
    } catch {
      setConfiguredProjectsTagId(null)
      setActiveProjects(emptyActiveProjects(companyId))
    } finally {
      setActiveProjectsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeCompanyId == null) {
      setProfit(null)
      setActiveProjects(null)
      setConfiguredProfitTagId(null)
      setConfiguredProjectsTagId(null)
      setProfitLoading(companiesLoading)
      setActiveProjectsLoading(companiesLoading)
      return
    }
    void loadProfit(activeCompanyId)
    void loadActiveProjects(activeCompanyId)
  }, [activeCompanyId, companiesLoading, loadProfit, loadActiveProjects])

  const profitDisplay = profitLoading ? '…' : (profit?.display_value ?? '0.00+')
  const projectsDisplay = activeProjectsLoading
    ? '…'
    : (activeProjects?.display_value ?? '0')

  return (
    <div className="app-content dashboard-page">
      <div className="container-fluid">
        <div className="dashboard-page-toolbar">
          <CompanyFilterSelect
            id="dashboard-company"
            label="Company"
            companies={companies}
            loading={companiesLoading}
            value={selectedCompanyId}
            onChange={setSelectedCompanyId}
            className="dashboard-page-toolbar__company"
          />
        </div>

        <section className="dashboard-preview-cards" aria-label="Dashboard cards">
          <article className="dashboard-preview-card dashboard-preview-card--light">
            <div className="dashboard-preview-icon-circle">
              <i className="bi bi-graph-up-arrow" aria-hidden="true" />
            </div>
            {activeCompanyId != null && (
              <ProfitProgressTagPopover
                companyId={activeCompanyId}
                selectedTagId={configuredProfitTagId}
                onTagSaved={() => void loadProfit(activeCompanyId)}
              />
            )}
            <h2 className="dashboard-preview-value">{profitDisplay}</h2>
            <p className="dashboard-preview-label">
              Total profit Progress
              {profit?.tag_name ? (
                <span className="dashboard-preview-tag-name"> <br /> {profit.tag_name}</span>
              ) : null}
            </p>
          </article>

          <article className="dashboard-preview-card dashboard-preview-card--teal">
            <div className="dashboard-preview-icon-circle dashboard-preview-icon-circle--light">
              <i className="bi bi-calendar2-check" aria-hidden="true" />
            </div>
            {activeCompanyId != null && (
              <ActiveProjectsTagPopover
                companyId={activeCompanyId}
                selectedTagId={configuredProjectsTagId}
                onTagSaved={() => void loadActiveProjects(activeCompanyId)}
              />
            )}
            <i className="bi bi-calendar2-check dashboard-preview-watermark" aria-hidden="true" />
            <h2 className="dashboard-preview-value">{projectsDisplay}</h2>
            <p className="dashboard-preview-label">
              Active Projects
              {activeProjects?.tag_name ? (
                <span className="dashboard-preview-tag-name dashboard-preview-tag-name--light">
                  {' '}
                  <br />  {activeProjects.tag_name}
                </span>
              ) : null}
            </p>
          </article>
        </section>
      </div>
    </div>
  )
}

export default DashboardPage
