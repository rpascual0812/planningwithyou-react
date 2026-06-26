import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'

import CalendarAppointmentRemindersPanel from './calendar/CalendarAppointmentRemindersPanel'
import CalendarEmailTemplatesPanel from './calendar/CalendarEmailTemplatesPanel'
import CalendarStatusesPanel from './calendar/CalendarStatusesPanel'
import IntegrationGroupContent from './integrations/IntegrationGroupContent'
import { groupMetaFor } from './integrations/integrationData'

const CalendarSettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [statusesOpen, setStatusesOpen] = useState(false)
  const [remindersOpen, setRemindersOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [integrationsOpen, setIntegrationsOpen] = useState(false)
  const calendarIntegrations = groupMetaFor('calendar')

  useEffect(() => {
    const result = searchParams.get('google_calendar')
    if (!result) return
    setIntegrationsOpen(true)
    const message = searchParams.get('google_calendar_message')
    if (result === 'connected') {
      void Swal.fire({
        icon: 'success',
        title: 'Google Calendar connected',
        text: 'Your appointments will sync to the connected Google account.',
      })
    } else {
      void Swal.fire({
        icon: 'error',
        title: 'Google Calendar connection failed',
        text: message || 'Please try connecting again.',
      })
    }
    const next = new URLSearchParams(searchParams)
    next.delete('google_calendar')
    next.delete('google_calendar_message')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (searchParams.get('section') === 'appointment-reminders') {
      setRemindersOpen(true)
    }
  }, [searchParams])

  return (
    <div className="account-settings integrations-settings">
      <ul className="faq-list">
        <li className={`faq-item${statusesOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
            data-tour="settings-calendar-statuses"
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
        <li className={`faq-item${remindersOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
            data-tour="settings-calendar-appointment-reminders"
            aria-expanded={remindersOpen}
            onClick={() => setRemindersOpen((prev) => !prev)}
          >
            <span className="faq-icon" aria-hidden="true">
              <i className="bi bi-bell" />
            </span>
            <span className="faq-question">Appointment reminders</span>
            <span className="faq-chevron" aria-hidden="true">
              <i className="bi bi-chevron-down" />
            </span>
          </button>
          {remindersOpen && (
            <div
              className="faq-answer faq-answer--form"
              data-tour="settings-calendar-appointment-reminders-panel"
            >
              <p className="text-muted small mb-3">
                Schedule email or SMS reminders before appointments. Filter by company,
                appointment status, and how long before the event start or end they should
                send.
              </p>
              <CalendarAppointmentRemindersPanel />
            </div>
          )}
        </li>
        <li className={`faq-item${templatesOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
            data-tour="settings-calendar-email-templates"
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
                Customize emails sent when appointments are created, updated, or reminded.
                Default templates include{' '}
                <code>calendar_event_creation</code>,{' '}
                <code>calendar_event_updated</code>, and{' '}
                <code>calendar_event_reminder</code>.
              </p>
              <CalendarEmailTemplatesPanel />
            </div>
          )}
        </li>
        <li className={`faq-item${integrationsOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
            data-tour="settings-calendar-integrations"
            aria-expanded={integrationsOpen}
            onClick={() => setIntegrationsOpen((prev) => !prev)}
          >
            <span className="faq-icon" aria-hidden="true">
              <i className={`bi ${calendarIntegrations.iconClass}`} />
            </span>
            <span className="faq-question">{calendarIntegrations.title}</span>
            <span className="faq-chevron" aria-hidden="true">
              <i className="bi bi-chevron-down" />
            </span>
          </button>
          {integrationsOpen && (
            <div className="faq-answer faq-answer--view">
              <IntegrationGroupContent purpose="calendar" />
            </div>
          )}
        </li>
      </ul>
    </div>
  )
}

export default CalendarSettingsPage
