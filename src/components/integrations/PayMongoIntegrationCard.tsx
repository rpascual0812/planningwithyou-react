export const PAYMONGO_INTEGRATION = {
  id: 'paymongo' as const,
  name: 'PayMongo',
  description: 'Connect PayMongo to accept payments from your customers.',
  iconClass: 'bi-credit-card-fill',
  color: '#dcf38c',
}

type PayMongoIntegrationCardProps = {
  connected: boolean
  statusLabel: string
  onViewIntegration: () => void
}

export const PayMongoIntegrationIcon = () => (
  <i
    className={`bi ${PAYMONGO_INTEGRATION.iconClass}`}
    style={{ color: PAYMONGO_INTEGRATION.color }}
    aria-hidden="true"
  />
)

const PayMongoIntegrationCard = ({
  connected,
  statusLabel,
  onViewIntegration,
}: PayMongoIntegrationCardProps) => (
  <li className="connection-card">
    <header className="connection-card-head">
      <span className="connection-icon" aria-hidden="true">
        <PayMongoIntegrationIcon />
      </span>
      <span className="connection-name">{PAYMONGO_INTEGRATION.name}</span>
      <span
        className={`badge ms-auto${connected ? ' text-bg-success' : ' text-bg-secondary'}`}
      >
        {statusLabel}
      </span>
    </header>
    <p className="connection-desc">{PAYMONGO_INTEGRATION.description}</p>
    <footer className="connection-card-foot">
      <button
        type="button"
        className="connection-link"
        onClick={onViewIntegration}
      >
        {connected ? 'Manage integration' : 'Set up integration'}
      </button>
    </footer>
  </li>
)

export default PayMongoIntegrationCard
