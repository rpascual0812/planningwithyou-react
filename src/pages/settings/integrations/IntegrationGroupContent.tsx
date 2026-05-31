import { useCallback, useEffect, useState } from 'react'
import { useFeatureAccess } from '../../../hooks/useFeatureAccess'
import {
  fetchGoogleCalendarIntegration,
  type GoogleCalendarIntegrationStatus,
} from '../../../services/googleCalendarIntegration'
import GoogleCalendarIntegrationCard from './GoogleCalendarIntegrationCard'
import IntegrationDetailsModal from './IntegrationDetailsModal'
import {
  type Integration,
  type IntegrationId,
  type IntegrationPurpose,
  groupMetaFor,
  initialIntegrationEnabledState,
  integrationsForPurpose,
  isIntegrationAvailable,
} from './integrationData'

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
  available: boolean
  toggleDisabled?: boolean
  onToggle: () => void
  onView: () => void
}

const IntegrationCard = ({
  integration,
  enabled,
  available,
  toggleDisabled = false,
  onToggle,
  onView,
}: IntegrationCardProps) => (
  <li
    className={`connection-card${available ? '' : ' connection-card--unavailable'}`}
  >
    <header className="connection-card-head">
      <span className="connection-icon" aria-hidden="true">
        {renderIntegrationIcon(integration)}
      </span>
      <span className="connection-name">{integration.name}</span>
      <button
        type="button"
        role="switch"
        aria-checked={available && enabled}
        aria-label={`Toggle ${integration.name} integration`}
        className={`settings-switch${enabled && available ? ' is-on' : ''}`}
        onClick={onToggle}
        disabled={toggleDisabled || !available}
      >
        <span className="settings-switch-thumb" aria-hidden="true" />
      </button>
    </header>
    <p className="connection-desc">{integration.description}</p>
    <footer className="connection-card-foot">
      {available ? (
        <button type="button" className="connection-link" onClick={onView}>
          View integration
        </button>
      ) : (
        <span className="connection-coming-soon text-muted small">Coming soon</span>
      )}
    </footer>
  </li>
)

type IntegrationGroupContentProps = {
  purpose: IntegrationPurpose
}

const IntegrationGroupContent = ({ purpose }: IntegrationGroupContentProps) => {
  const writeFeature = purpose === 'calendar' ? 'calendar_settings' : 'settings'
  const { canWrite: settingsWrite } = useFeatureAccess(writeFeature)
  const group = groupMetaFor(purpose)
  const items = integrationsForPurpose(purpose)
  const [integrations, setIntegrations] = useState(initialIntegrationEnabledState)
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(
    null,
  )
  const [googleStatus, setGoogleStatus] = useState<GoogleCalendarIntegrationStatus | null>(
    null,
  )
  const [googleLoading, setGoogleLoading] = useState(purpose === 'calendar')

  const loadGoogleStatus = useCallback(async () => {
    if (purpose !== 'calendar') return
    setGoogleLoading(true)
    try {
      const data = await fetchGoogleCalendarIntegration()
      setGoogleStatus(data)
    } catch {
      setGoogleStatus({
        connected: false,
        configured: false,
        google_email: '',
        sync_mode: 'one_way',
        two_way_sync: false,
        last_synced_at: null,
      })
    } finally {
      setGoogleLoading(false)
    }
  }, [purpose])

  useEffect(() => {
    void loadGoogleStatus()
  }, [loadGoogleStatus])

  const toggleIntegration = (id: IntegrationId) => {
    if (!settingsWrite) return
    const item = items.find((i) => i.id === id)
    if (item && !isIntegrationAvailable(item)) return
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
      <p className="integrations-group-desc">{group.description}</p>
      <ul className="connection-grid">
        {items.map((integration) => {
          const available = isIntegrationAvailable(integration)
          if (integration.id === 'google-calendar' && purpose === 'calendar') {
            if (googleLoading || !googleStatus) {
              return (
                <li key={integration.id} className="connection-card">
                  <p className="connection-desc text-muted small mb-0">
                    Loading Google Calendar…
                  </p>
                </li>
              )
            }
            return (
              <GoogleCalendarIntegrationCard
                key={integration.id}
                integration={integration}
                status={googleStatus}
                writeDisabled={!settingsWrite}
                onStatusChange={setGoogleStatus}
              />
            )
          }
          return (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              available={available}
              enabled={available && integrations[integration.id]}
              toggleDisabled={!settingsWrite}
              onToggle={() => toggleIntegration(integration.id)}
              onView={() => setSelectedIntegration(integration)}
            />
          )
        })}
      </ul>
      {selectedIntegration && isIntegrationAvailable(selectedIntegration) && (
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

export default IntegrationGroupContent
