import { useCallback, useState } from 'react'
import Swal from 'sweetalert2'

import {
  disconnectGoogleCalendar,
  formatLastSynced,
  startGoogleCalendarConnect,
  syncGoogleCalendar,
  updateGoogleCalendarSyncMode,
  type GoogleCalendarIntegrationStatus,
} from '../../../services/googleCalendarIntegration'
import type { Integration } from './integrationData'

const renderIntegrationIcon = (integration: Integration) => (
  <i
    className={`bi ${integration.iconClass}`}
    style={{ color: integration.color }}
    aria-hidden="true"
  />
)

type GoogleCalendarIntegrationModalProps = {
  integration: Integration
  status: GoogleCalendarIntegrationStatus
  onClose: () => void
  onStatusChange: (status: GoogleCalendarIntegrationStatus) => void
  writeDisabled?: boolean
}

const GoogleCalendarIntegrationModal = ({
  integration,
  status,
  onClose,
  onStatusChange,
  writeDisabled = false,
}: GoogleCalendarIntegrationModalProps) => {
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [twoWaySync, setTwoWaySync] = useState(status.two_way_sync)

  const connected = status.connected

  const handleConnect = useCallback(async () => {
    if (writeDisabled || busy) return
    if (!status.configured) {
      await Swal.fire({
        icon: 'warning',
        title: 'Not configured',
        text: 'Google Calendar OAuth is not configured on the server yet.',
      })
      return
    }
    setBusy(true)
    try {
      const next = await startGoogleCalendarConnect({ twoWaySync })
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
  }, [busy, onStatusChange, status.configured, twoWaySync, writeDisabled])

  const handleDisconnect = useCallback(async () => {
    if (writeDisabled || busy) return
    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Disconnect Google Calendar?',
      text: 'Sync will stop and you will need to sign in again to reconnect.',
      showCancelButton: true,
      confirmButtonText: 'Disconnect',
      confirmButtonColor: '#dc3545',
    })
    if (!confirm.isConfirmed) return
    setBusy(true)
    try {
      const next = await disconnectGoogleCalendar()
      onStatusChange(next)
      setTwoWaySync(false)
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

  const handleSync = useCallback(async () => {
    if (writeDisabled || busy || syncing) return
    setSyncing(true)
    try {
      const next = await syncGoogleCalendar()
      onStatusChange(next)
      await Swal.fire({
        icon: 'success',
        title: 'Sync complete',
        text: 'Appointments were synced with Google Calendar.',
      })
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Sync failed',
        text:
          err instanceof Error
            ? err.message
            : 'Could not sync with Google Calendar.',
      })
    } finally {
      setSyncing(false)
    }
  }, [busy, onStatusChange, syncing, writeDisabled])

  const handleTwoWayChange = useCallback(
    async (enabled: boolean) => {
      if (writeDisabled || busy || !connected) return
      setTwoWaySync(enabled)
      setBusy(true)
      try {
        const next = await updateGoogleCalendarSyncMode(enabled)
        onStatusChange(next)
        setTwoWaySync(next.two_way_sync)
      } catch (err) {
        setTwoWaySync(status.two_way_sync)
        await Swal.fire({
          icon: 'error',
          title: 'Update failed',
          text: err instanceof Error ? err.message : 'Could not update sync mode.',
        })
      } finally {
        setBusy(false)
      }
    },
    [busy, connected, onStatusChange, status.two_way_sync, writeDisabled],
  )

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
                  Synced account: <strong>{status.google_email}</strong>
                </p>
              )}
              <dl className="integration-modal-details">
                <div>
                  <dt>Status</dt>
                  <dd>{connected ? 'Enabled' : 'Disabled'}</dd>
                </div>
                <div>
                  <dt>Sync direction</dt>
                  <dd>
                    {connected
                      ? twoWaySync
                        ? 'Two-way (app ↔ Google)'
                        : 'One-way (app → Google)'
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Permissions</dt>
                  <dd>{integration.permissions}</dd>
                </div>
                <div>
                  <dt>Last synced</dt>
                  <dd>{formatLastSynced(status.last_synced_at)}</dd>
                </div>
              </dl>

              <div className="integration-modal-two-way form-check form-switch mb-3 mt-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="google-calendar-two-way"
                  checked={twoWaySync}
                  disabled={!connected || writeDisabled || busy}
                  onChange={(e) => void handleTwoWayChange(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="google-calendar-two-way">
                  Two-way sync
                </label>
                <p className="form-text small text-muted mb-0">
                  When enabled, events you create in Google Calendar also appear in
                  this app&apos;s calendar. One-way sync only sends app appointments
                  to Google.
                </p>
              </div>

              {!connected && (
                <div className="form-check form-switch mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="google-calendar-two-way-connect"
                    checked={twoWaySync}
                    disabled={writeDisabled || busy}
                    onChange={(e) => setTwoWaySync(e.target.checked)}
                  />
                  <label
                    className="form-check-label"
                    htmlFor="google-calendar-two-way-connect"
                  >
                    Enable two-way sync when connecting
                  </label>
                </div>
              )}

              <div className="integration-modal-note">
                <i className="bi bi-info-circle" aria-hidden="true" />
                <span>
                  Disconnecting removes this integration completely. You must sign in
                  with Google again to reconnect.
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
              {connected && (
                <button
                  type="button"
                  className="btn btn-outline-secondary d-inline-flex align-items-center"
                  disabled={writeDisabled || busy || syncing}
                  aria-busy={syncing}
                  onClick={() => void handleSync()}
                >
                  {syncing ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      />
                      Syncing…
                    </>
                  ) : (
                    'Sync now'
                  )}
                </button>
              )}
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

export default GoogleCalendarIntegrationModal
