import { useState } from 'react'

import CalendarStatusesPanel from './calendar/CalendarStatusesPanel'

const CalendarSettingsPage = () => {
  const [statusesOpen, setStatusesOpen] = useState(true)

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
      </ul>
    </div>
  )
}

export default CalendarSettingsPage
