import { useEffect, useState } from 'react'

type IntegrationId =
  | 'paymongo'
  | 'gmail'
  | 'google-calendar'
  | 'microsoft-outlook'
  | 'microsoft-calendar'
  | 'apple-email'
  | 'apple-calendar'
  | 'yahoo-email'
  | 'yahoo-calendar'
  | 'facebook-messenger'

type Integration = {
  id: IntegrationId
  name: string
  description: string
  iconClass: string
  color: string
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'paymongo',
    name: 'PayMongo',
    description: 'Connect PayMongo to accept payments from your customers.',
    iconClass: 'bi-credit-card-fill',
    color: '#dcf38c',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Connect Gmail to send and receive messages from your inbox.',
    iconClass: 'bi-envelope-fill',
    color: '#ea4335',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sync events and availability with Google Calendar.',
    iconClass: 'bi-calendar-event-fill',
    color: '#4285f4',
  },
  {
    id: 'microsoft-outlook',
    name: 'Microsoft Outlook',
    description: 'Connect Outlook to manage email in one place.',
    iconClass: 'bi-microsoft',
    color: '#0078d4',
  },
  {
    id: 'microsoft-calendar',
    name: 'Microsoft Calendar',
    description: 'Sync schedules and meetings with Microsoft Calendar.',
    iconClass: 'bi-calendar3-fill',
    color: '#0078d4',
  },
  {
    id: 'apple-email',
    name: 'Apple Email',
    description: 'Connect Apple Mail to manage messages from your account.',
    iconClass: 'bi-apple',
    color: '#555555',
  },
  {
    id: 'apple-calendar',
    name: 'Apple Calendar',
    description: 'Sync events and reminders with Apple Calendar.',
    iconClass: 'bi-calendar2-week-fill',
    color: '#555555',
  },
  {
    id: 'yahoo-email',
    name: 'Yahoo Email',
    description: 'Connect Yahoo Mail to send and receive messages.',
    iconClass: 'bi-envelope-at-fill',
    color: '#6001d2',
  },
  {
    id: 'yahoo-calendar',
    name: 'Yahoo Calendar',
    description: 'Sync events and availability with Yahoo Calendar.',
    iconClass: 'bi-calendar-check-fill',
    color: '#6001d2',
  },
  {
    id: 'facebook-messenger',
    name: 'Facebook Messenger',
    description: 'Connect Messenger to receive and reply to conversations.',
    iconClass: 'bi-messenger',
    color: '#0084ff',
  },
]

const renderIntegrationIcon = (integration: Integration) => (
  <i
    className={`bi ${integration.iconClass}`}
    style={{ color: integration.color }}
    aria-hidden="true"
  />
)

const IntegrationsSettingsPage = () => {
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

  const toggleIntegration = (id: IntegrationId) => {
    setIntegrations((prev) => ({ ...prev, [id]: !prev[id] }))
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
    <>
      <ul className="connection-grid">
        {INTEGRATIONS.map((integration) => {
          const enabled = integrations[integration.id]
          return (
            <li key={integration.id} className="connection-card">
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
                  onClick={() => toggleIntegration(integration.id)}
                >
                  <span className="settings-switch-thumb" aria-hidden="true" />
                </button>
              </header>
              <p className="connection-desc">{integration.description}</p>
              <footer className="connection-card-foot">
                <button
                  type="button"
                  className="connection-link"
                  onClick={() => setSelectedIntegration(integration)}
                >
                  View integration
                </button>
              </footer>
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
    </>
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
