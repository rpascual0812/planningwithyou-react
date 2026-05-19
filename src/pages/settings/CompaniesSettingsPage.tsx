import { useState } from 'react'
import CompaniesPanel from './companies/CompaniesPanel'

const CompaniesSettingsPage = () => {
  const [companiesOpen, setCompaniesOpen] = useState(false)

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
      </ul>
    </div>
  )
}

export default CompaniesSettingsPage
