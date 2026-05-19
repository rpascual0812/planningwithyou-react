import { useState } from 'react'
import CompaniesPanel from './companies/CompaniesPanel'
import TiersPanel from './companies/TiersPanel'

const CompaniesSettingsPage = () => {
  const [companiesOpen, setCompaniesOpen] = useState(false)
  const [tiersOpen, setTiersOpen] = useState(false)

  return (
    <div className="account-settings">
      <ul className="faq-list">
        <li className={`faq-item${companiesOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
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
      </ul>
    </div>
  )
}

export default CompaniesSettingsPage
