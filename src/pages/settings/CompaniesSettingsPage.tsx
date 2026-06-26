import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import CompaniesPanel from './companies/CompaniesPanel'
import CompanyPackagesPanel from './companies/CompanyPackagesPanel'
import PackagesPanel from './companies/PackagesPanel'

const CompaniesSettingsPage = () => {
  const [searchParams] = useSearchParams()
  const [companiesOpen, setCompaniesOpen] = useState(false)
  const [companyPackagesOpen, setCompanyPackagesOpen] = useState(false)
  const [packagesOpen, setPackagesOpen] = useState(false)

  useEffect(() => {
    if (searchParams.get('section') === 'companies') {
      setCompaniesOpen(true)
    }
  }, [searchParams])

  return (
    <div className="account-settings">
      <ul className="faq-list">
        <li className={`faq-item${companiesOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
            data-tour="settings-companies-companies"
            aria-expanded={companiesOpen}
            onClick={() => setCompaniesOpen((prev) => !prev)}
          >
            <span className="faq-icon" aria-hidden="true">
              <i className="bi bi-buildings" />
            </span>
            <span className="faq-question">Companies</span>
            <span className="faq-chevron" aria-hidden="true">
              <i className="bi bi-chevron-down" />
            </span>
          </button>
          {companiesOpen && (
            <div className="faq-answer faq-answer--form">
              <CompaniesPanel />
            </div>
          )}
        </li>

        <li className={`faq-item${companyPackagesOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
            data-tour="settings-companies-package-definitions"
            aria-expanded={companyPackagesOpen}
            onClick={() => setCompanyPackagesOpen((prev) => !prev)}
          >
            <span className="faq-icon" aria-hidden="true">
              <i className="bi bi-layers" />
            </span>
            <span className="faq-question">Packages</span>
            <span className="faq-chevron" aria-hidden="true">
              <i className="bi bi-chevron-down" />
            </span>
          </button>
          {companyPackagesOpen && (
            <div className="faq-answer faq-answer--view">
              <CompanyPackagesPanel />
            </div>
          )}
        </li>

        <li className={`faq-item${packagesOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
            data-tour="settings-companies-packages"
            aria-expanded={packagesOpen}
            onClick={() => setPackagesOpen((prev) => !prev)}
          >
            <span className="faq-icon" aria-hidden="true">
              <i className="bi bi-tag" />
            </span>
            <span className="faq-question">Packages &amp; Pricing</span>
            <span className="faq-chevron" aria-hidden="true">
              <i className="bi bi-chevron-down" />
            </span>
          </button>
          {packagesOpen && (
            <div className="faq-answer faq-answer--view">
              <PackagesPanel />
            </div>
          )}
        </li>
      </ul>
    </div>
  )
}

export default CompaniesSettingsPage
