import { useEffect, useMemo, useState } from 'react'
import { useFeatureAccess } from '../../hooks/useFeatureAccess'

type IntegrationId =
  | 'gmail'
  | 'google-calendar'
  | 'microsoft-outlook'
  | 'microsoft-calendar'
  | 'apple-email'
  | 'apple-calendar'
  | 'yahoo-email'
  | 'yahoo-calendar'
  | 'facebook-messenger'

type IntegrationPurpose = 'email' | 'calendar' | 'messaging'

type Integration = {
  id: IntegrationId
  name: string
  description: string
  iconClass: string
  color: string
  purpose: IntegrationPurpose
}

type IntegrationGroup = {
  id: IntegrationPurpose
  title: string
  description: string
  iconClass: string
}

const INTEGRATION_GROUPS: IntegrationGroup[] = [
  {
    id: 'email',
    title: 'Email',
    description: 'Connect inboxes to send and receive messages from your account.',
    iconClass: 'bi-envelope',
  },
  {
    id: 'calendar',
    title: 'Calendar',
    description: 'Sync events, availability, and reminders with your calendars.',
    iconClass: 'bi-calendar3',
  },
  {
    id: 'messaging',
    title: 'Messaging',
    description: 'Receive and reply to conversations from messaging apps.',
    iconClass: 'bi-chat-dots',
  },
]

const INTEGRATIONS: Integration[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Connect Gmail to send and receive messages from your inbox.',
    iconClass: 'bi-envelope-fill',
    color: '#ea4335',
    purpose: 'email',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sync events and availability with Google Calendar.',
    iconClass: 'bi-calendar-event-fill',
    color: '#4285f4',
    purpose: 'calendar',
  },
  {
    id: 'microsoft-outlook',
    name: 'Microsoft Outlook',
    description: 'Connect Outlook to manage email in one place.',
    iconClass: 'bi-microsoft',
    color: '#0078d4',
    purpose: 'email',
  },
  {
    id: 'microsoft-calendar',
    name: 'Microsoft Calendar',
    description: 'Sync schedules and meetings with Microsoft Calendar.',
    iconClass: 'bi-calendar3-fill',
    color: '#0078d4',
    purpose: 'calendar',
  },
  {
    id: 'apple-email',
    name: 'Apple Email',
    description: 'Connect Apple Mail to manage messages from your account.',
    iconClass: 'bi-apple',
    color: '#555555',
    purpose: 'email',
  },
  {
    id: 'apple-calendar',
    name: 'Apple Calendar',
    description: 'Sync events and reminders with Apple Calendar.',
    iconClass: 'bi-calendar2-week-fill',
    color: '#555555',
    purpose: 'calendar',
  },
  {
    id: 'yahoo-email',
    name: 'Yahoo Email',
    description: 'Connect Yahoo Mail to send and receive messages.',
    iconClass: 'bi-envelope-at-fill',
    color: '#6001d2',
    purpose: 'email',
  },
  {
    id: 'yahoo-calendar',
    name: 'Yahoo Calendar',
    description: 'Sync events and availability with Yahoo Calendar.',
    iconClass: 'bi-calendar-check-fill',
    color: '#6001d2',
    purpose: 'calendar',
  },
  {
    id: 'facebook-messenger',
    name: 'Facebook Messenger',
    description: 'Connect Messenger to receive and reply to conversations.',
    iconClass: 'bi-messenger',
    color: '#0084ff',
    purpose: 'messaging',
  },
]

const renderIntegrationIcon = (integration: Integration) => (
  <i
    className={`bi ${integration.iconClass}`}
    style={{ color: integration.color }}
    aria-hidden="true"
  />
)

type IntegrationCardProps = {
  integration: Integration
  enabled: boolean
  toggleDisabled?: boolean
  onToggle: () => void
  onView: () => void
}

const IntegrationCard = ({
  integration,
  enabled,
  toggleDisabled = false,
  onToggle,
  onView,
}: IntegrationCardProps) => (
  <li className="connection-card">
    <header className="connection-card-head">
      <span className="connection-icon" aria-hidden="true">
        {renderIntegrationIcon(integration)}
      </span>
      <span className="connection-name">{integration.name}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`Toggle ${integration.name} integration`}
        className={`settings-switch${enabled ? ' is-on' : ''}`}
        onClick={onToggle}
        disabled={toggleDisabled}
      >
        <span className="settings-switch-thumb" aria-hidden="true" />
      </button>
    </header>
    <p className="connection-desc">{integration.description}</p>
    <footer className="connection-card-foot">
      <button type="button" className="connection-link" onClick={onView}>
        View integration
      </button>
    </footer>
  </li>
)

const IntegrationsSettingsPage = () => {
  const { canWrite: settingsWrite } = useFeatureAccess('settings')
  const [integrations, setIntegrations] = useState<Record<IntegrationId, boolean>>(
    () =>
      INTEGRATIONS.reduce<Record<IntegrationId, boolean>>(
        (acc, integration) => {
          acc[integration.id] = true
          return acc
        },
        {} as Record<IntegrationId, boolean>,
      ),
  )
  const [selectedIntegration, setSelectedIntegration] =
    useState<Integration | null>(null)
  const [openGroups, setOpenGroups] = useState<Record<IntegrationPurpose, boolean>>({
    email: true,
    calendar: false,
    messaging: false,
  })

  const integrationsByPurpose = useMemo(() => {
    const map: Record<IntegrationPurpose, Integration[]> = {
      email: [],
      calendar: [],
      messaging: [],
    }
    for (const integration of INTEGRATIONS) {
      map[integration.purpose].push(integration)
    }
    return map
  }, [])

  const toggleIntegration = (id: IntegrationId) => {
    if (!settingsWrite) return
    setIntegrations((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleGroup = (id: IntegrationPurpose) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  useEffect(() => {
    if (!selectedIntegration) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedIntegration(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedIntegration])

  return (
    <div className="account-settings integrations-settings">
    <ul className="faq-list">
      {INTEGRATION_GROUPS.map((group) => {
        const isOpen = openGroups[group.id]
        const groupIntegrations = integrationsByPurpose[group.id]
        return (
          <li key={group.id} className={`faq-item${isOpen ? ' is-open' : ''}`}>
            <button
              type="button"
              className="faq-toggle"
              data-tour={`settings-integrations-${group.id}`}
              aria-expanded={isOpen}
              onClick={() => toggleGroup(group.id)}
            >
              <span className="faq-icon" aria-hidden="true">
                <i className={`bi ${group.iconClass}`} />
              </span>
              <span className="faq-question">{group.title}</span>
              <span className="faq-chevron" aria-hidden="true">
                <i className="bi bi-chevron-down" />
              </span>
            </button>
            {isOpen && (
              <div className="faq-answer faq-answer--view">
                <p className="integrations-group-desc">{group.description}</p>
                <ul className="connection-grid">
                  {groupIntegrations.map((integration) => (
                    <IntegrationCard
                      key={integration.id}
                      integration={integration}
                      enabled={integrations[integration.id]}
                      toggleDisabled={!settingsWrite}
                      onToggle={() => toggleIntegration(integration.id)}
                      onView={() => setSelectedIntegration(integration)}
                    />
                  ))}
                </ul>
              </div>
            )}
          </li>
        )
      })}
    </ul>

    {selectedIntegration && (
      <IntegrationDetailsModal
        integration={selectedIntegration}
        enabled={integrations[selectedIntegration.id]}
        onToggle={() => toggleIntegration(selectedIntegration.id)}
        onClose={() => setSelectedIntegration(null)}
      />
    )}
    </div>
  )
}

type IntegrationDetailsModalProps = {
  integration: Integration
  enabled: boolean
  onToggle: () => void
  onClose: () => void
}

const IntegrationDetailsModal = ({
  integration,
  enabled,
  onToggle,
  onClose,
}: IntegrationDetailsModalProps) => (
  <>
    <div
      className="integration-modal-backdrop modal-backdrop fade show"
      onClick={onClose}
    />
    <div
      className="integration-modal modal fade show d-block"
      role="dialog"
      aria-modal="true"
      aria-labelledby="integrationModalTitle"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <div className="integration-modal-title-wrap">
              <span className="integration-modal-icon" aria-hidden="true">
                {renderIntegrationIcon(integration)}
              </span>
              <div>
                <h1 id="integrationModalTitle" className="modal-title fs-5">
                  {integration.name}
                </h1>
                <span
                  className={`integration-modal-status${enabled ? ' is-on' : ''}`}
                >
                  {enabled ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onClose}
            />
          </div>

          <div className="modal-body">
            <p className="integration-modal-desc">{integration.description}</p>
            <dl className="integration-modal-details">
              <div>
                <dt>Status</dt>
                <dd>{enabled ? 'Enabled' : 'Disabled'}</dd>
              </div>
              <div>
                <dt>Sync Mode</dt>
                <dd>Automatic</dd>
              </div>
              <div>
                <dt>Permissions</dt>
                <dd>Email, calendar, and messaging access</dd>
              </div>
              <div>
                <dt>Last Checked</dt>
                <dd>Today, 09:45 AM</dd>
              </div>
            </dl>
            <div className="integration-modal-note">
              <i className="bi bi-info-circle" aria-hidden="true" />
              <span>
                Manage this integration from here. Turning it off keeps the
                card visible but stops future sync and notifications.
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className={enabled ? 'btn btn-outline-danger' : 'btn btn-primary'}
              onClick={onToggle}
            >
              {enabled ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        </div>
      </div>
    </div>
  </>
)

export default IntegrationsSettingsPage
