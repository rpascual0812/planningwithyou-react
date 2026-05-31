import { useCallback, useState } from 'react'
import Swal from 'sweetalert2'

import {
  disconnectGmail,
  startGmailConnect,
  type GmailIntegrationStatus,
} from '../../../services/gmailIntegration'
import type { Integration } from './integrationData'

const renderIntegrationIcon = (integration: Integration) => (
  <i
    className={`bi ${integration.iconClass}`}
    style={{ color: integration.color }}
    aria-hidden="true"
  />
)

type GmailIntegrationModalProps = {
  integration: Integration
  status: GmailIntegrationStatus
  onClose: () => void
  onStatusChange: (status: GmailIntegrationStatus) => void
  writeDisabled?: boolean
}

const GmailIntegrationModal = ({
  integration,
  status,
  onClose,
  onStatusChange,
  writeDisabled = false,
}: GmailIntegrationModalProps) => {
  const [busy, setBusy] = useState(false)
  const connected = status.connected

  const handleConnect = useCallback(async () => {
    if (writeDisabled || busy) return
    if (!status.configured) {
      await Swal.fire({
        icon: 'warning',
        title: 'Not configured',
        text: 'Gmail OAuth is not configured on the server yet.',
      })
      return
    }
    setBusy(true)
    try {
      const next = await startGmailConnect()
      const url = next.authorization_url
      if (url) {
        window.location.assign(url)
        return
      }
      onStatusChange(next)
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Connection failed',
        text: err instanceof Error ? err.message : 'Could not start Google sign-in.',
      })
    } finally {
      setBusy(false)
    }
  }, [busy, onStatusChange, status.configured, writeDisabled])

  const handleDisconnect = useCallback(async () => {
    if (writeDisabled || busy) return
    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Disconnect Gmail?',
      text: 'Outgoing email will use the system sender until you connect Gmail again.',
      showCancelButton: true,
      confirmButtonText: 'Disconnect',
      confirmButtonColor: '#dc3545',
    })
    if (!confirm.isConfirmed) return
    setBusy(true)
    try {
      const next = await disconnectGmail()
      onStatusChange(next)
      onClose()
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Disconnect failed',
        text: err instanceof Error ? err.message : 'Could not disconnect.',
      })
    } finally {
      setBusy(false)
    }
  }, [busy, onClose, onStatusChange, writeDisabled])

  return (
    <>
      <div
        className="integration-modal-backdrop modal-backdrop fade show"
        onClick={onClose}
      />
      <div
        className="integration-modal modal fade show d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gmailIntegrationModalTitle"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div className="integration-modal-title-wrap">
                <span className="integration-modal-icon" aria-hidden="true">
                  {renderIntegrationIcon(integration)}
                </span>
                <div>
                  <h1 id="gmailIntegrationModalTitle" className="modal-title fs-5">
                    {integration.name}
                  </h1>
                  <span
                    className={`integration-modal-status${connected ? ' is-on' : ''}`}
                  >
                    {connected ? 'Connected' : 'Disconnected'}
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
              {connected && status.google_email && (
                <p className="small text-muted mb-3">
                  Send as: <strong>{status.google_email}</strong>
                </p>
              )}
              <dl className="integration-modal-details">
                <div>
                  <dt>Status</dt>
                  <dd>{connected ? 'Enabled' : 'Disabled'}</dd>
                </div>
                <div>
                  <dt>Permissions</dt>
                  <dd>{integration.permissions}</dd>
                </div>
                <div>
                  <dt>Send via</dt>
                  <dd>{connected ? 'Your Gmail account' : 'System email (Mailjet)'}</dd>
                </div>
              </dl>
              <div className="integration-modal-note">
                <i className="bi bi-info-circle" aria-hidden="true" />
                <span>
                  When connected, emails you send from this app for the active company
                  use your Gmail address. Disconnecting removes the integration; you must
                  sign in again to reconnect.
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
              {connected ? (
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  disabled={writeDisabled || busy}
                  onClick={() => void handleDisconnect()}
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={writeDisabled || busy}
                  onClick={() => void handleConnect()}
                >
                  Connect with Google
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default GmailIntegrationModal
