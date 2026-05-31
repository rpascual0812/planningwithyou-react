import type { Integration } from './integrationData'

const renderIntegrationIcon = (integration: Integration) => (
  <i
    className={`bi ${integration.iconClass}`}
    style={{ color: integration.color }}
    aria-hidden="true"
  />
)

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
                <dd>{integration.permissions}</dd>
              </div>
              <div>
                <dt>Last Synced</dt>
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

export default IntegrationDetailsModal
