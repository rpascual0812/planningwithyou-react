import { useState } from 'react'

type BillingCycle = 'monthly' | 'yearly'
type PaymentMethod = 'credit-card' | 'paypal'

type SubscriptionPlan = {
  id: string
  name: string
  subtitle: string
  basePrice: number,
  pricePerUser: number
  defaultUsers: number
  features?: string[]
  hasTeamStepper?: boolean
  teamStepperHint?: string
}

const PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    subtitle: 'Advanced features are limited',
    basePrice: 0,
    pricePerUser: 0,
    defaultUsers: 1,
  },
  {
    id: 'pro',
    name: 'Pro',
    subtitle: 'All features are available',
    basePrice: 995.00,
    pricePerUser: 100.00,
    defaultUsers: 1,
    features: [
      'Access to Email and Calendar Integrations',
      'Access to Supplier Selection',
      'Allow Multiple Companies',
      'Allow Multiple Users'
    ],
    hasTeamStepper: true,
    teamStepperHint: '',
  },
  {
    id: 'ai',
    name: 'AI Plus',
    subtitle: 'For teams that need AI features',
    basePrice: 1495.00,
    pricePerUser: 150.00,
    defaultUsers: 1,
    features: [
      'Everything Pro.',
      'AI Automation'
    ],
    hasTeamStepper: true,
    teamStepperHint: '',
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
  <svg viewBox="0 0 56 36" width="40" height="26" aria-hidden="true">
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
  <svg viewBox="0 0 48 32" width="44" height="28" aria-hidden="true">
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

const SubscriptionSettingsPage = () => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('credit-card')
  const [selectedPlanId, setSelectedPlanId] = useState<string>('business-pro')
  const [teamSeats, setTeamSeats] = useState<number>(1)
  const [selectedCardId, setSelectedCardId] = useState<string>('master-6790')
  const [discountCode, setDiscountCode] = useState<string>('')
  const [discountApplied, setDiscountApplied] = useState<boolean>(true)

  const cycleSuffix = billingCycle === 'monthly' ? 'monthly' : 'yearly'
  const totals = {
    teamPlanLabel: `${teamSeats} Users ${
      billingCycle === 'monthly' ? 'Monthly' : 'Yearly'
    }`,
    teamPlanAmount: 789.0,
    paymentPlanAmount: -57.9,
    total: 789.0,
  }

  return (
    <div className="sub-layout">
      <section className="sub-col">
        <header className="sub-col-head">
          <h6 className="sub-col-title">Choose plan</h6>
          <div className="sub-pill-toggle" role="tablist" aria-label="Billing cycle">
            {(['monthly', 'yearly'] as const).map((cycle) => (
              <button
                key={cycle}
                type="button"
                role="tab"
                aria-selected={billingCycle === cycle}
                className={`sub-pill${billingCycle === cycle ? ' is-active' : ''}`}
                onClick={() => setBillingCycle(cycle)}
              >
                {cycle === 'monthly' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
          </div>
        </header>

        <ul className="sub-plan-list">
          {PLANS.map((plan) => {
            const isSelected = selectedPlanId === plan.id
            const users = plan.hasTeamStepper ? teamSeats : plan.defaultUsers

            const pricePerUser = plan.pricePerUser * (users > 1 ? users - 1 : 0);
            const price = plan.basePrice + (users > 1 ? pricePerUser : 0);
            
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
                    onChange={() => setSelectedPlanId(plan.id)}
                  />
                  <div className="sub-plan-name-wrap">
                    <span className="sub-plan-name">{plan.name}</span>
                    <span className="sub-plan-subtitle">{plan.subtitle}</span>
                  </div>
                  <div className="sub-plan-price-wrap">
                    <span className="sub-plan-price">{formatPrice(price)}</span>
                    <span className="sub-plan-usage">
                      {plan.pricePerUser > 0 ? `$${plan.pricePerUser} per additional user` : ''}
                    </span>
                    <span className="sub-plan-usage">
                      {users} {users > 1 ? 'users' : 'user'}/{cycleSuffix}
                    </span>
                  </div>
                </label>

                {plan.features && (
                  <ul className="sub-plan-features">
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <i className="bi bi-check-circle-fill" aria-hidden="true" />
                        <span>{feature}</span>
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
                        onClick={() => setTeamSeats(Math.max(1, teamSeats - 1))}
                        aria-label="Decrease team seats"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        className="sub-stepper-value"
                        value={teamSeats}
                        min={1}
                        onChange={(e) => {
                          const next = Number(e.target.value)
                          if (Number.isFinite(next)) setTeamSeats(Math.max(1, next))
                        }}
                        aria-label="Team seats"
                      />
                      <button
                        type="button"
                        className="sub-stepper-btn"
                        onClick={() => setTeamSeats(teamSeats + 1)}
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

      <section className="sub-col">
        <header className="sub-col-head">
          <h6 className="sub-col-title">Payment plan</h6>
          <div className="sub-pill-toggle" role="tablist" aria-label="Payment method">
            {(['credit-card', 'paypal'] as const).map((method) => (
              <button
                key={method}
                type="button"
                role="tab"
                aria-selected={paymentMethod === method}
                className={`sub-pill${paymentMethod === method ? ' is-active' : ''}`}
                onClick={() => setPaymentMethod(method)}
              >
                {method === 'credit-card' ? 'Credit card' : 'PayPal'}
              </button>
            ))}
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
                        onChange={() => setSelectedCardId(card.id)}
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
            <p>You'll be redirected to PayPal to authorise this subscription.</p>
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
                onChange={(e) => setDiscountCode(e.target.value)}
                placeholder="Enter code"
              />
              <button
                type="button"
                className="sub-discount-apply"
                onClick={() => setDiscountApplied(discountCode.trim().length > 0)}
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
            <span className="sub-total-amount">${totals.total.toFixed(1)}</span>
          </div>

          <button type="button" className="sub-pay-btn">
            PAY NOW
          </button>
        </div>
      </section>
    </div>
  )
}

export default SubscriptionSettingsPage
