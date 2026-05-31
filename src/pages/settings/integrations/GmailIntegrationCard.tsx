import { useCallback, useState } from 'react'
import Swal from 'sweetalert2'

import {
  disconnectGmail,
  startGmailConnect,
  type GmailIntegrationStatus,
} from '../../../services/gmailIntegration'
import type { Integration } from './integrationData'
import GmailIntegrationModal from './GmailIntegrationModal'

const renderIntegrationIcon = (integration: Integration) => (
  <i
    className={`bi ${integration.iconClass}`}
    style={{ color: integration.color }}
    aria-hidden="true"
  />
)

type GmailIntegrationCardProps = {
  integration: Integration
  status: GmailIntegrationStatus
  onStatusChange: (status: GmailIntegrationStatus) => void
  writeDisabled?: boolean
}

const GmailIntegrationCard = ({
  integration,
  status,
  onStatusChange,
  writeDisabled = false,
}: GmailIntegrationCardProps) => {
  const [modalOpen, setModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const connected = status.connected

  const handleToggle = useCallback(async () => {
    if (writeDisabled || busy) return
    if (connected) {
      const confirm = await Swal.fire({
        icon: 'warning',
        title: 'Disconnect Gmail?',
        text: 'Outgoing email will use the system sender until you connect again.',
        showCancelButton: true,
        confirmButtonText: 'Disconnect',
        confirmButtonColor: '#dc3545',
      })
      if (!confirm.isConfirmed) return
      setBusy(true)
      try {
        const next = await disconnectGmail()
        onStatusChange(next)
      } catch (err) {
        await Swal.fire({
          icon: 'error',
          title: 'Disconnect failed',
          text: err instanceof Error ? err.message : 'Could not disconnect.',
        })
      } finally {
        setBusy(false)
      }
      return
    }

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
  }, [busy, connected, onStatusChange, status.configured, writeDisabled])

  return (
    <>
      <li className="connection-card">
        <header className="connection-card-head">
          <span className="connection-icon" aria-hidden="true">
            {renderIntegrationIcon(integration)}
          </span>
          <span className="connection-name">{integration.name}</span>
          <button
            type="button"
            role="switch"
            aria-checked={connected}
            aria-label={`Toggle ${integration.name} integration`}
            className={`settings-switch${connected ? ' is-on' : ''}`}
            onClick={() => void handleToggle()}
            disabled={writeDisabled || busy}
          >
            <span className="settings-switch-thumb" aria-hidden="true" />
          </button>
        </header>
        <p className="connection-desc">{integration.description}</p>
        {connected && status.google_email && (
          <p className="small text-muted mb-2">Send as {status.google_email}</p>
        )}
        <footer className="connection-card-foot">
          <button
            type="button"
            className="connection-link"
            onClick={() => setModalOpen(true)}
          >
            View integration
          </button>
        </footer>
      </li>
      {modalOpen && (
        <GmailIntegrationModal
          integration={integration}
          status={status}
          writeDisabled={writeDisabled}
          onClose={() => setModalOpen(false)}
          onStatusChange={onStatusChange}
        />
      )}
    </>
  )
}

export default GmailIntegrationCard
