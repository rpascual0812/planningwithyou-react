import { useEffect, useState } from 'react'

type IntegrationId =
  | 'github'
  | 'slack'
  | 'google'
  | 'figma'
  | 'drive'
  | 'dropbox'
  | 'facebook'
  | 'instagram'
  | 'twitter'

type Integration = {
  id: IntegrationId
  name: string
  description: string
  iconClass: string | null
  color: string
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'GitHub can be connected to various continuous integration',
    iconClass: 'bi-github',
    color: '#111827',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send notifications to channels and create various projects',
    iconClass: 'bi-slack',
    color: '#4a154b',
  },
  {
    id: 'google',
    name: 'Google',
    description:
      "The core mission of Google is to organize the world's information.",
    iconClass: 'bi-google',
    color: '#ea4335',
  },
  {
    id: 'figma',
    name: 'Figma',
    description:
      'Figma is a web-based design tool focused on collaborative design.',
    iconClass: null,
    color: '#f24e1e',
  },
  {
    id: 'drive',
    name: 'Drive',
    description: 'Google Drive is a comprehensive file storage and service.',
    iconClass: null,
    color: '#1fa463',
  },
  {
    id: 'dropbox',
    name: 'Drop Box',
    description: 'The service is designed to safeguard files from malfunctions.',
    iconClass: 'bi-dropbox',
    color: '#0061ff',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    description:
      "Facebook's journey from a university network to a global social media.",
    iconClass: 'bi-facebook',
    color: '#1877f2',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description:
      "Instagram's mission is to bring people closer to the things and people.",
    iconClass: 'bi-instagram',
    color: '#e4405f',
  },
  {
    id: 'twitter',
    name: 'Twitter',
    description: 'Twitter, now known as X, is a social media platform.',
    iconClass: 'bi-twitter',
    color: '#1da1f2',
  },
]

const FigmaIcon = () => (
  <svg viewBox="0 0 38 56" width="22" height="22" aria-hidden="true">
    <path d="M19 28a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19Z" fill="#1abcfe" />
    <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0Z" fill="#0acf83" />
    <path d="M19 0v19H9.5a9.5 9.5 0 1 1 0-19Z" fill="#ff7262" />
    <path d="M19 19h9.5a9.5 9.5 0 1 1 0 19H19V19Z" fill="#a259ff" />
    <path d="M19 0h9.5a9.5 9.5 0 1 1 0 19H19V0Z" fill="#f24e1e" />
  </svg>
)

const DriveIcon = () => (
  <svg viewBox="0 0 64 56" width="24" height="22" aria-hidden="true">
    <path d="M20.5 0h23l20.5 35.5H41L20.5 0Z" fill="#ffce47" />
    <path d="M20.5 0 0 35.5 11.5 56 32 21l-11.5-21Z" fill="#34a853" />
    <path d="m11.5 56 9.5-16.5h43L52 56H11.5Z" fill="#4285f4" />
  </svg>
)

const renderIntegrationIcon = (integration: Integration) => {
  if (integration.iconClass) {
    return (
      <i
        className={`bi ${integration.iconClass}`}
        style={{ color: integration.color }}
        aria-hidden="true"
      />
    )
  }
  if (integration.id === 'figma') return <FigmaIcon />
  if (integration.id === 'drive') return <DriveIcon />
  return null
}

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
                <dd>Projects, files, notifications</dd>
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
