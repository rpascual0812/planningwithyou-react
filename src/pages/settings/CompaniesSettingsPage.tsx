import { useState } from 'react'
import CompaniesPanel from './companies/CompaniesPanel'
import TiersPanel from './companies/TiersPanel'
import PackagesPanel from './companies/PackagesPanel'

const CompaniesSettingsPage = () => {
  const [companiesOpen, setCompaniesOpen] = useState(false)
  const [tiersOpen, setTiersOpen] = useState(false)
  const [packagesOpen, setPackagesOpen] = useState(false)

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

        <li className={`faq-item${tiersOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
            data-tour="settings-companies-tiers"
            aria-expanded={tiersOpen}
            onClick={() => setTiersOpen((prev) => !prev)}
          >
            <span className="faq-icon" aria-hidden="true">
              <i className="bi bi-layers" />
            </span>
            <span className="faq-question">Tiers</span>
            <span className="faq-chevron" aria-hidden="true">
              <i className="bi bi-chevron-down" />
            </span>
          </button>
          {tiersOpen && (
            <div className="faq-answer faq-answer--view">
              <TiersPanel />
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
