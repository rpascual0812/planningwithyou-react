import { useState } from 'react'

import CalendarEmailTemplatesPanel from './calendar/CalendarEmailTemplatesPanel'
import CalendarStatusesPanel from './calendar/CalendarStatusesPanel'

const CalendarSettingsPage = () => {
  const [statusesOpen, setStatusesOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)

  return (
    <div className="account-settings">
      <ul className="faq-list">
        <li className={`faq-item${statusesOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
            aria-expanded={statusesOpen}
            onClick={() => setStatusesOpen((prev) => !prev)}
          >
            <span className="faq-icon" aria-hidden="true">
              <i className="bi bi-calendar2-check" />
            </span>
            <span className="faq-question">Appointment statuses</span>
            <span className="faq-chevron" aria-hidden="true">
              <i className="bi bi-chevron-down" />
            </span>
          </button>
          {statusesOpen && (
            <div className="faq-answer faq-answer--view">
              <p className="text-muted small mb-3">
                Manage appointment status labels and colors used on the calendar.
              </p>
              <CalendarStatusesPanel />
            </div>
          )}
        </li>
        <li className={`faq-item${templatesOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
            aria-expanded={templatesOpen}
            onClick={() => setTemplatesOpen((prev) => !prev)}
          >
            <span className="faq-icon" aria-hidden="true">
              <i className="bi bi-envelope" />
            </span>
            <span className="faq-question">Email templates</span>
            <span className="faq-chevron" aria-hidden="true">
              <i className="bi bi-chevron-down" />
            </span>
          </button>
          {templatesOpen && (
            <div className="faq-answer faq-answer--form">
              <p className="text-muted small mb-3">
                Customize emails sent when appointments are created or updated.
                Default templates include{' '}
                <code>calendar_event_creation</code> and{' '}
                <code>calendar_event_updated</code>.
              </p>
              <CalendarEmailTemplatesPanel />
            </div>
          )}
        </li>
      </ul>
    </div>
  )
}

export default CalendarSettingsPage
