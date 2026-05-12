import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type SettingsSection =
  | 'account'
  | 'companies'
  | 'form-designs'
  | 'calendar'
  | 'bookings'
  | 'permissions'
  | 'subscription'
  | 'connection'
  | 'delete'

type NavItem = {
  id: SettingsSection
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'account', label: 'Account', icon: 'bi-person-gear' },
  { id: 'companies', label: 'Companies', icon: 'bi-building' },
  { id: 'form-designs', label: 'Form Designs', icon: 'bi-pencil' },
  { id: 'calendar', label: 'Calendar', icon: 'bi-calendar3' },
  { id: 'bookings', label: 'Bookings', icon: 'bi-kanban' },
  { id: 'permissions', label: 'User Permissions', icon: 'bi-people' },
  { id: 'subscription', label: 'Subscription', icon: 'bi-credit-card' },
  { id: 'connection', label: 'Connections', icon: 'bi-diagram-3' },
  { id: 'delete', label: 'Delete', icon: 'bi-trash' },
]

type PushChoice = 'everything' | 'same-as-email' | 'no-push'

type DevicePush = {
  id: 'mobile' | 'desktop' | 'smartwatch'
  label: string
  description: string
  icon: string
  tone: 'green' | 'navy' | 'red'
}

// ---------------------------------------------------------------------------
// Connection integrations
// ---------------------------------------------------------------------------

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
  /** Either a bootstrap-icons class or null when we render a custom SVG. */
  iconClass: string | null
  /** Brand color used for the icon glyph. */
  color: string
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'github',
    name: 'GitHub',
    description:
      'GitHub can be connected to various continuous integration',
    iconClass: 'bi-github',
    color: '#111827',
  },
  {
    id: 'slack',
    name: 'Slack',
    description:
      'Send notifications to channels and create various projects',
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

/**
 * Multi-color approximation of the Figma logo. Bootstrap-icons doesn't ship
 * one, so we render an inline SVG made of stacked circles/half-circles.
 */
const FigmaIcon = () => (
  <svg
    viewBox="0 0 38 56"
    width="22"
    height="22"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M19 28a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19Z" fill="#1abcfe" />
    <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0Z" fill="#0acf83" />
    <path d="M19 0v19H9.5a9.5 9.5 0 1 1 0-19Z" fill="#ff7262" />
    <path d="M19 19h9.5a9.5 9.5 0 1 1 0 19H19V19Z" fill="#a259ff" />
    <path d="M19 0h9.5a9.5 9.5 0 1 1 0 19H19V0Z" fill="#f24e1e" />
  </svg>
)

/** Stylised Google Drive triangle. */
const DriveIcon = () => (
  <svg
    viewBox="0 0 64 56"
    width="24"
    height="22"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M20.5 0h23l20.5 35.5H41L20.5 0Z" fill="#ffce47" />
    <path d="M20.5 0 0 35.5 11.5 56 32 21l-11.5-21Z" fill="#34a853" />
    <path d="m11.5 56 9.5-16.5h43L52 56H11.5Z" fill="#4285f4" />
  </svg>
)

const renderIntegrationIcon = (i: Integration) => {
  if (i.iconClass) {
    return (
      <i
        className={`bi ${i.iconClass}`}
        style={{ color: i.color }}
        aria-hidden="true"
      />
    )
  }
  if (i.id === 'figma') return <FigmaIcon />
  if (i.id === 'drive') return <DriveIcon />
  return null
}

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

type BillingCycle = 'quarterly' | 'yearly'
type PaymentMethod = 'credit-card' | 'paypal'

type SubscriptionPlan = {
  id: string
  name: string
  subtitle: string
  pricePerUser: number
  defaultUsers: number
  features?: string[]
  hasTeamStepper?: boolean
  teamStepperHint?: string
}

const PLANS: SubscriptionPlan[] = [
  {
    id: 'mark-moen-solo',
    name: 'Mark Moen',
    subtitle: 'UI/UX Designer',
    pricePerUser: 69.44,
    defaultUsers: 1,
  },
  {
    id: 'mark-moen-team',
    name: 'Mark Moen',
    subtitle: 'UI/UX Designer',
    pricePerUser: 69.44,
    defaultUsers: 25,
    features: [
      '40 downloads per day.',
      'Access to all products or bundles.',
      'Early access to new/beta release features.',
    ],
    hasTeamStepper: true,
    teamStepperHint: 'Starting at 5 users in the team plan, yo…',
  },
  {
    id: 'business-pro',
    name: 'Business Pro',
    subtitle: 'for big teams',
    pricePerUser: 250.44 / 31, // headline price stays at $250.44/31 users
    defaultUsers: 31,
  },
]

type PaymentCard = {
  id: string
  last4: string
  label: string
  brand: 'visa' | 'mastercard'
}

const CARDS: PaymentCard[] = [
  { id: 'visa-4426', last4: '4426', label: 'Visa card', brand: 'visa' },
  { id: 'master-6790', last4: '6790', label: 'Master card', brand: 'mastercard' },
]

const VisaLogo = () => (
  <svg
    viewBox="0 0 56 36"
    width="40"
    height="26"
    aria-hidden="true"
    focusable="false"
  >
    <rect width="56" height="36" rx="4" fill="#1a1f71" />
    <text
      x="50%"
      y="64%"
      textAnchor="middle"
      fill="#ffffff"
      fontSize="14"
      fontWeight="900"
      letterSpacing="1"
      fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      fontStyle="italic"
    >
      VISA
    </text>
  </svg>
)

const MastercardLogo = () => (
  <svg
    viewBox="0 0 48 32"
    width="44"
    height="28"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="18" cy="16" r="11" fill="#eb001b" />
    <circle cx="30" cy="16" r="11" fill="#f79e1b" opacity="0.92" />
  </svg>
)

const renderCardBrand = (brand: PaymentCard['brand']) =>
  brand === 'visa' ? <VisaLogo /> : <MastercardLogo />

const formatPrice = (n: number) =>
  `$${n.toLocaleString('en-US', {
    minimumFractionDigits: n % 1 === 0 ? 1 : 2,
    maximumFractionDigits: 2,
  })}`

const DEVICE_PUSH: DevicePush[] = [
  {
    id: 'mobile',
    label: 'Mobile push notification',
    description: 'Receive all notifications via your mobile app',
    icon: 'bi-phone',
    tone: 'navy',
  },
  {
    id: 'desktop',
    label: 'Desktop push notification',
    description: 'Receive all notifications via your desktop app',
    icon: 'bi-display',
    tone: 'green',
  },
  {
    id: 'smartwatch',
    label: 'Smartwatch push notification',
    description: 'Receive all notifications via your smartwatch app',
    icon: 'bi-smartwatch',
    tone: 'red',
  },
]

const SettingsPage = () => {
  const [activeNav, setActiveNav] = useState<SettingsSection>('notification')
  const [emailComments, setEmailComments] = useState(false)
  const [emailCandidates, setEmailCandidates] = useState(false)
  const [emailOffers, setEmailOffers] = useState(false)
  const [pushChoice, setPushChoice] = useState<PushChoice>('everything')
  const [devices, setDevices] = useState<Record<DevicePush['id'], boolean>>({
    mobile: true,
    desktop: false,
    smartwatch: false,
  })
  const [integrations, setIntegrations] = useState<Record<IntegrationId, boolean>>(
    () =>
      INTEGRATIONS.reduce<Record<IntegrationId, boolean>>(
        (acc, i) => {
          acc[i.id] = true
          return acc
        },
        {} as Record<IntegrationId, boolean>,
      ),
  )
  const [selectedIntegration, setSelectedIntegration] =
    useState<Integration | null>(null)

  // Subscription tab state
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('quarterly')
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('credit-card')
  const [selectedPlanId, setSelectedPlanId] = useState<string>('business-pro')
  const [teamSeats, setTeamSeats] = useState<number>(25)
  const [selectedCardId, setSelectedCardId] = useState<string>('master-6790')
  const [discountCode, setDiscountCode] = useState<string>('20FGJKYSD')
  const [discountApplied, setDiscountApplied] = useState<boolean>(true)

  const toggleDevice = (id: DevicePush['id']) => {
    setDevices((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleIntegration = (id: IntegrationId) => {
    setIntegrations((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const closeIntegrationModal = () => {
    setSelectedIntegration(null)
  }

  // Body scroll lock + Escape-to-close while the integration modal is open.
  useEffect(() => {
    if (!selectedIntegration) {
      return
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeIntegrationModal()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedIntegration])

  return (
    <div className="app-content">
      <div className="container-fluid">
        <nav className="settings-breadcrumb" aria-label="Breadcrumb">
          <ol>
            <li>
              <i className="bi bi-grid" aria-hidden="true" />
              <Link to="/">Apps</Link>
            </li>
            <li className="settings-breadcrumb-sep" aria-hidden="true">
              /
            </li>
            <li className="is-current" aria-current="page">
              Setting
            </li>
          </ol>
        </nav>

        <div className="settings-layout">
          <aside className="settings-nav-card">
            <h5 className="settings-card-title">Settings</h5>
            <ul className="settings-nav">
              {NAV_ITEMS.map((item) => {
                const isActive = activeNav === item.id
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`settings-nav-link${isActive ? ' is-active' : ''}`}
                      onClick={() => setActiveNav(item.id)}
                    >
                      <i className={`bi ${item.icon}`} aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>

          <section className="settings-main-card">
            <h5 className="settings-card-title">
              {NAV_ITEMS.find((n) => n.id === activeNav)?.label ?? 'Settings'}
            </h5>

            {activeNav === 'permissions' ? (
              <div className="settings-notification">
                <div className="settings-row">
                  {/* By Email column */}
                  <div className="settings-col">
                    <h6 className="settings-section-title">By Email</h6>
                    <p className="settings-section-text">
                      These are delivered via mail to your Email.
                    </p>
                    <ul className="settings-check-list">
                      <li>
                        <label className="settings-check">
                          <input
                            type="checkbox"
                            checked={emailComments}
                            onChange={(e) => setEmailComments(e.target.checked)}
                          />
                          <span>
                            <strong>Comments</strong>
                            <span className="settings-check-detail">
                              - notified posts on comment
                            </span>
                          </span>
                        </label>
                      </li>
                      <li>
                        <label className="settings-check">
                          <input
                            type="checkbox"
                            checked={emailCandidates}
                            onChange={(e) => setEmailCandidates(e.target.checked)}
                          />
                          <span>
                            <strong>Candidates</strong>
                            <span className="settings-check-detail">
                              - notified candidate applies
                            </span>
                          </span>
                        </label>
                      </li>
                      <li>
                        <label className="settings-check">
                          <input
                            type="checkbox"
                            checked={emailOffers}
                            onChange={(e) => setEmailOffers(e.target.checked)}
                          />
                          <span>
                            <strong>Offers</strong>
                            <span className="settings-check-detail">
                              - notified accepts or rejects
                            </span>
                          </span>
                        </label>
                      </li>
                    </ul>
                  </div>

                  {/* Push Notification column */}
                  <div className="settings-col">
                    <h6 className="settings-section-title">Push Notification</h6>
                    <p className="settings-section-text">
                      These are delivered via SMS to your mobile phone.
                    </p>
                    <ul className="settings-radio-list">
                      <li>
                        <label className="settings-radio">
                          <input
                            type="radio"
                            name="push-choice"
                            checked={pushChoice === 'everything'}
                            onChange={() => setPushChoice('everything')}
                          />
                          <span>Everything</span>
                        </label>
                      </li>
                      <li>
                        <label className="settings-radio">
                          <input
                            type="radio"
                            name="push-choice"
                            checked={pushChoice === 'same-as-email'}
                            onChange={() => setPushChoice('same-as-email')}
                          />
                          <span>Same as email</span>
                        </label>
                      </li>
                      <li>
                        <label className="settings-radio">
                          <input
                            type="radio"
                            name="push-choice"
                            checked={pushChoice === 'no-push'}
                            onChange={() => setPushChoice('no-push')}
                          />
                          <span>No push notification</span>
                        </label>
                      </li>
                    </ul>
                  </div>
                </div>

                <ul className="settings-device-list">
                  {DEVICE_PUSH.map((d) => {
                    const on = devices[d.id]
                    return (
                      <li key={d.id} className="settings-device-card">
                        <span
                          className={`settings-device-icon settings-device-icon--${d.tone}`}
                          aria-hidden="true"
                        >
                          <i className={`bi ${d.icon}`} />
                        </span>
                        <div className="settings-device-meta">
                          <span className="settings-device-label">{d.label}</span>
                          <span className="settings-device-desc">{d.description}</span>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={`Toggle ${d.label}`}
                          className={`settings-switch${on ? ' is-on' : ''}`}
                          onClick={() => toggleDevice(d.id)}
                        >
                          <span className="settings-switch-thumb" aria-hidden="true" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : activeNav === 'subscription' ? (
              <SubscriptionView
                billingCycle={billingCycle}
                onBillingCycleChange={setBillingCycle}
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                selectedPlanId={selectedPlanId}
                onSelectPlan={setSelectedPlanId}
                teamSeats={teamSeats}
                onTeamSeatsChange={setTeamSeats}
                selectedCardId={selectedCardId}
                onSelectCard={setSelectedCardId}
                discountCode={discountCode}
                onDiscountCodeChange={setDiscountCode}
                discountApplied={discountApplied}
                onApplyDiscount={() =>
                  setDiscountApplied(discountCode.trim().length > 0)
                }
              />
            ) : activeNav === 'connection' ? (
              <ul className="connection-grid">
                {INTEGRATIONS.map((integration) => {
                  const on = integrations[integration.id]
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
                          aria-checked={on}
                          aria-label={`Toggle ${integration.name} integration`}
                          className={`settings-switch${on ? ' is-on' : ''}`}
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
            ) : (
              <div className="settings-placeholder">
                <i className="bi bi-tools" aria-hidden="true" />
                <p>
                  <strong>
                    {NAV_ITEMS.find((n) => n.id === activeNav)?.label}
                  </strong>{' '}
                  settings will live here.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {selectedIntegration && (
        <IntegrationDetailsModal
          integration={selectedIntegration}
          enabled={integrations[selectedIntegration.id]}
          onToggle={() => toggleIntegration(selectedIntegration.id)}
          onClose={closeIntegrationModal}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subscription view
// ---------------------------------------------------------------------------

type SubscriptionViewProps = {
  billingCycle: BillingCycle
  onBillingCycleChange: (next: BillingCycle) => void
  paymentMethod: PaymentMethod
  onPaymentMethodChange: (next: PaymentMethod) => void
  selectedPlanId: string
  onSelectPlan: (id: string) => void
  teamSeats: number
  onTeamSeatsChange: (next: number) => void
  selectedCardId: string
  onSelectCard: (id: string) => void
  discountCode: string
  onDiscountCodeChange: (next: string) => void
  discountApplied: boolean
  onApplyDiscount: () => void
}

const SubscriptionView = ({
  billingCycle,
  onBillingCycleChange,
  paymentMethod,
  onPaymentMethodChange,
  selectedPlanId,
  onSelectPlan,
  teamSeats,
  onTeamSeatsChange,
  selectedCardId,
  onSelectCard,
  discountCode,
  onDiscountCodeChange,
  discountApplied,
  onApplyDiscount,
}: SubscriptionViewProps) => {
  const cycleSuffix = billingCycle === 'quarterly' ? 'quarterly' : 'yearly'
  const totals = {
    teamPlanLabel: `${teamSeats} Users ${
      billingCycle === 'quarterly' ? 'Quarterly' : 'Yearly'
    }`,
    teamPlanAmount: 789.0,
    paymentPlanAmount: -57.9,
    total: 789.0,
  }

  return (
    <div className="sub-layout">
      {/* ============================================================
          Left column – Choose plan
          ============================================================ */}
      <section className="sub-col">
        <header className="sub-col-head">
          <h6 className="sub-col-title">Choose plan</h6>
          <div
            className="sub-pill-toggle"
            role="tablist"
            aria-label="Billing cycle"
          >
            <button
              type="button"
              role="tab"
              aria-selected={billingCycle === 'quarterly'}
              className={`sub-pill${
                billingCycle === 'quarterly' ? ' is-active' : ''
              }`}
              onClick={() => onBillingCycleChange('quarterly')}
            >
              Quarterly
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={billingCycle === 'yearly'}
              className={`sub-pill${
                billingCycle === 'yearly' ? ' is-active' : ''
              }`}
              onClick={() => onBillingCycleChange('yearly')}
            >
              Yearly
            </button>
          </div>
        </header>

        <ul className="sub-plan-list">
          {PLANS.map((plan) => {
            const isSelected = selectedPlanId === plan.id
            const users = plan.hasTeamStepper ? teamSeats : plan.defaultUsers
            const price =
              plan.id === 'business-pro' ? 250.44 : plan.pricePerUser * 1
            return (
              <li
                key={plan.id}
                className={`sub-plan-card${isSelected ? ' is-selected' : ''}`}
              >
                <label className="sub-plan-head">
                  <input
                    type="radio"
                    name="sub-plan"
                    checked={isSelected}
                    onChange={() => onSelectPlan(plan.id)}
                  />
                  <div className="sub-plan-name-wrap">
                    <span className="sub-plan-name">{plan.name}</span>
                    <span className="sub-plan-subtitle">{plan.subtitle}</span>
                  </div>
                  <div className="sub-plan-price-wrap">
                    <span className="sub-plan-price">{formatPrice(price)}</span>
                    <span className="sub-plan-usage">
                      {users} users/{cycleSuffix}
                    </span>
                  </div>
                </label>

                {plan.features && (
                  <ul className="sub-plan-features">
                    {plan.features.map((f) => (
                      <li key={f}>
                        <i className="bi bi-check-circle-fill" aria-hidden="true" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {plan.hasTeamStepper && (
                  <div className="sub-plan-team">
                    <div className="sub-plan-team-text">
                      <strong>Team Accounts</strong>
                      <span>{plan.teamStepperHint}</span>
                    </div>
                    <div className="sub-stepper" role="group" aria-label="Team seats">
                      <button
                        type="button"
                        className="sub-stepper-btn"
                        onClick={() =>
                          onTeamSeatsChange(Math.max(5, teamSeats - 1))
                        }
                        aria-label="Decrease team seats"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        className="sub-stepper-value"
                        value={teamSeats}
                        min={5}
                        onChange={(e) => {
                          const next = Number(e.target.value)
                          if (Number.isFinite(next)) {
                            onTeamSeatsChange(Math.max(5, next))
                          }
                        }}
                        aria-label="Team seats"
                      />
                      <button
                        type="button"
                        className="sub-stepper-btn"
                        onClick={() => onTeamSeatsChange(teamSeats + 1)}
                        aria-label="Increase team seats"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {/* ============================================================
          Right column – Payment plan
          ============================================================ */}
      <section className="sub-col">
        <header className="sub-col-head">
          <h6 className="sub-col-title">Payment plan</h6>
          <div
            className="sub-pill-toggle"
            role="tablist"
            aria-label="Payment method"
          >
            <button
              type="button"
              role="tab"
              aria-selected={paymentMethod === 'credit-card'}
              className={`sub-pill${
                paymentMethod === 'credit-card' ? ' is-active' : ''
              }`}
              onClick={() => onPaymentMethodChange('credit-card')}
            >
              Credit card
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={paymentMethod === 'paypal'}
              className={`sub-pill${
                paymentMethod === 'paypal' ? ' is-active' : ''
              }`}
              onClick={() => onPaymentMethodChange('paypal')}
            >
              PayPal
            </button>
          </div>
        </header>

        {paymentMethod === 'credit-card' ? (
          <>
            <ul className="sub-card-list">
              {CARDS.map((card) => {
                const isSelected = selectedCardId === card.id
                return (
                  <li
                    key={card.id}
                    className={`sub-card${isSelected ? ' is-selected' : ''}`}
                  >
                    <label className="sub-card-row">
                      <input
                        type="radio"
                        name="sub-card"
                        checked={isSelected}
                        onChange={() => onSelectCard(card.id)}
                      />
                      <div className="sub-card-meta">
                        <span className="sub-card-number">**** {card.last4}</span>
                        <span className="sub-card-label">{card.label}</span>
                      </div>
                      <span className="sub-card-brand">
                        {renderCardBrand(card.brand)}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>

            <button type="button" className="sub-add-card-btn">
              + Add New Card
            </button>
          </>
        ) : (
          <div className="sub-paypal">
            <i className="bi bi-paypal" aria-hidden="true" />
            <p>
              You'll be redirected to PayPal to authorise this subscription.
            </p>
          </div>
        )}

        <div className="sub-summary">
          <div className="sub-discount">
            <h6>Discount code</h6>
            <div className="sub-discount-row">
              <input
                type="text"
                className="sub-discount-input"
                value={discountCode}
                onChange={(e) => onDiscountCodeChange(e.target.value)}
                placeholder="Enter code"
              />
              <button
                type="button"
                className="sub-discount-apply"
                onClick={onApplyDiscount}
              >
                Apply
              </button>
            </div>
            {discountApplied && (
              <p className="sub-discount-msg">30% discount code applied</p>
            )}
          </div>

          <div className="sub-line">
            <div className="sub-line-text">
              <span className="sub-line-title">Team Plan</span>
              <span className="sub-line-sub">{totals.teamPlanLabel}</span>
            </div>
            <span className="sub-line-amount">
              ${totals.teamPlanAmount.toFixed(1)}
            </span>
          </div>

          <div className="sub-line">
            <div className="sub-line-text">
              <span className="sub-line-title sub-line-title--strong">
                Payment plan
              </span>
            </div>
            <span className="sub-line-amount sub-line-amount--green">
              -${Math.abs(totals.paymentPlanAmount).toFixed(2)}
            </span>
          </div>

          <div className="sub-total">
            <div className="sub-line-text">
              <span className="sub-total-title">Total</span>
              <span className="sub-total-note">
                Next payment will charge 10th of January 2030
              </span>
            </div>
            <span className="sub-total-amount">
              ${totals.total.toFixed(1)}
            </span>
          </div>

          <button type="button" className="sub-pay-btn">
            PAY NOW
          </button>
        </div>
      </section>
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
}: IntegrationDetailsModalProps) => {
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
                    className={`integration-modal-status${
                      enabled ? ' is-on' : ''
                    }`}
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
              <p className="integration-modal-desc">
                {integration.description}
              </p>

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
}

export default SettingsPage
