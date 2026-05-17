import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCurrentAccount } from '../../services/accounts'
import {
  fetchSubscriptionPlans,
  type SubscriptionPlanRecord,
} from '../../services/subscriptions'
import {
  formatCurrency,
  localeFromIso2,
  type CurrencyFormatOptions,
} from '../../utils/currency'

type BillingCycle = 'monthly' | 'yearly'

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
  isSelectable: boolean
}

function mapSubscriptionPlan(record: SubscriptionPlanRecord): SubscriptionPlan {
  return {
    id: record.plan,
    name: record.name,
    subtitle: record.subtitle,
    basePrice: Number(record.base_price),
    pricePerUser: Number(record.price_per_user),
    defaultUsers: record.default_users,
    features: record.features ?? [],
    hasTeamStepper: record.has_team_stepper,
    teamStepperHint: '',
    isSelectable: record.is_selectable !== false,
  }
}

function firstSelectablePlanId(planList: SubscriptionPlan[]): string {
  return planList.find((p) => p.isSelectable)?.id ?? ''
}

type PaymentCard = {
  id: string
  last4: string
  label: string
  brand: 'visa' | 'mastercard'
}

const PAYMENT_CARD: PaymentCard = {
  id: 'master-6790',
  last4: '6790',
  label: 'Master card',
  brand: 'mastercard',
}

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

const MONTHS_PER_YEAR = 12
const YEARLY_FREE_MONTHS = 2
const MONTHS_BILLED_YEARLY = MONTHS_PER_YEAR - YEARLY_FREE_MONTHS
function planUsers(plan: SubscriptionPlan, teamSeats: number): number {
  return plan.hasTeamStepper ? teamSeats : plan.defaultUsers
}

/** Monthly total: base + (users - 1) × pricePerUser when users > 1. */
function computeMonthlyPlanPrice(plan: SubscriptionPlan, users: number): number {
  if (users <= 1) return plan.basePrice
  return plan.basePrice + plan.pricePerUser * (users - 1)
}

function computeYearlySavings(monthly: number): number {
  return monthly * YEARLY_FREE_MONTHS
}

function computePlanPrice(
  plan: SubscriptionPlan,
  users: number,
  cycle: BillingCycle,
): number {
  const monthly = computeMonthlyPlanPrice(plan, users)
  return cycle === 'yearly' ? monthly * MONTHS_BILLED_YEARLY : monthly
}

function perAdditionalUserRate(plan: SubscriptionPlan, cycle: BillingCycle): number {
  return cycle === 'yearly'
    ? plan.pricePerUser * MONTHS_BILLED_YEARLY
    : plan.pricePerUser
}

function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th'
  switch (day % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}

function addMonths(from: Date, months: number): Date {
  const next = new Date(from)
  const day = next.getDate()
  next.setMonth(next.getMonth() + months)
  if (next.getDate() !== day) {
    next.setDate(0)
  }
  return next
}

function addYears(from: Date, years: number): Date {
  const next = new Date(from)
  const month = next.getMonth()
  const day = next.getDate()
  next.setFullYear(next.getFullYear() + years)
  if (next.getMonth() !== month || next.getDate() !== day) {
    next.setMonth(month + 1, 0)
  }
  return next
}

function getNextPaymentDate(cycle: BillingCycle, from = new Date()): Date {
  return cycle === 'yearly' ? addYears(from, 1) : addMonths(from, 1)
}

function formatNextPaymentCharge(cycle: BillingCycle, from = new Date()): string {
  const next = getNextPaymentDate(cycle, from)
  const day = next.getDate()
  const month = next.toLocaleString('en-US', { month: 'long' })
  const year = next.getFullYear()
  return `${day}${getOrdinalSuffix(day)} of ${month} ${year}`
}

const SubscriptionSettingsPage = () => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [plansError, setPlansError] = useState<string | null>(null)
  const [currencyFormat, setCurrencyFormat] = useState<CurrencyFormatOptions>({
    currencyCode: 'USD',
    locale: 'en-US',
  })
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [teamSeats, setTeamSeats] = useState<number>(1)
  const [discountCode, setDiscountCode] = useState<string>('')
  const [discountMessage, setDiscountMessage] = useState<string | null>(null)

  const formatPrice = useCallback(
    (amount: number) => formatCurrency(amount, currencyFormat),
    [currencyFormat],
  )

  const cycleSuffix = billingCycle === 'monthly' ? 'monthly' : 'yearly'
  const billingCycleLabel = billingCycle === 'monthly' ? 'Monthly' : 'Yearly'
  const isFreePlan = selectedPlanId === 'free'

  const selectPlan = (plan: SubscriptionPlan) => {
    if (!plan.isSelectable) return
    setSelectedPlanId(plan.id)
    setTeamSeats(1)
  }

  const handleApplyDiscount = () => {
    setDiscountMessage('Discount code invalid')
  }

  const loadPlans = useCallback(async () => {
    setPlansLoading(true)
    setPlansError(null)
    try {
      const [account, data] = await Promise.all([
        fetchCurrentAccount(),
        fetchSubscriptionPlans(billingCycle),
      ])
      setCurrencyFormat({
        currencyCode: account.country_currency_code || 'USD',
        locale: localeFromIso2(account.country_iso2_code),
      })
      const mapped = data.map(mapSubscriptionPlan)
      setPlans(mapped)
      setSelectedPlanId((prev) => {
        if (prev && mapped.some((p) => p.id === prev && p.isSelectable)) return prev
        return firstSelectablePlanId(mapped)
      })
    } catch (e) {
      setPlansError(
        e instanceof Error ? e.message : 'Failed to load subscription plans',
      )
      setPlans([])
      setSelectedPlanId('')
    } finally {
      setPlansLoading(false)
    }
  }, [billingCycle])

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

  const totals = useMemo(() => {
    const selectedPlan =
      plans.find((plan) => plan.id === selectedPlanId && plan.isSelectable)
      ?? plans.find((plan) => plan.isSelectable)
    if (!selectedPlan) {
      return {
        planName: '',
        teamPlanLabel: '',
        basePlanAmount: 0,
        perUserAmount: 0,
        perUserLineSub: '',
        teamPlanAmount: 0,
        yearlySavings: 0,
        total: 0,
      }
    }
    const users = planUsers(selectedPlan, teamSeats)
    const monthlyAmount = computeMonthlyPlanPrice(selectedPlan, users)
    const teamPlanAmount = computePlanPrice(selectedPlan, users, billingCycle)
    const yearlySavings =
      billingCycle === 'yearly' ? computeYearlySavings(monthlyAmount) : 0
    // Promo code only. Monthly has no built-in discount; yearly 2-month savings are
    // already in teamPlanAmount (10 months billed, not 12).
    const cycleMultiplier = billingCycle === 'yearly' ? MONTHS_BILLED_YEARLY : 1
    const additionalUsers = Math.max(0, users - 1)
    const basePlanAmount = selectedPlan.basePrice * cycleMultiplier
    const perUserRate = perAdditionalUserRate(selectedPlan, billingCycle)
    const perUserAmount = selectedPlan.pricePerUser * additionalUsers * cycleMultiplier
    return {
      planName: selectedPlan.name,
      teamPlanLabel: `${users} ${users === 1 ? 'User' : 'Users'} ${
        billingCycle === 'monthly' ? 'Monthly' : 'Yearly'
      }`,
      basePlanAmount,
      perUserAmount,
      perUserLineSub:
        additionalUsers > 0
          ? `${additionalUsers} × ${formatPrice(perUserRate)}`
          : 'No additional users',
      teamPlanAmount,
      yearlySavings,
      total: teamPlanAmount,
    }
  }, [billingCycle, formatPrice, plans, selectedPlanId, teamSeats])

  const nextPaymentNote = useMemo(() => {
    if (isFreePlan) {
      return 'No upcoming charges on the Free plan'
    }
    return `Next payment will charge on the ${formatNextPaymentCharge(billingCycle)}`
  }, [billingCycle, isFreePlan])

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

        {plansLoading ? (
          <p className="text-muted small mb-0">Loading plans…</p>
        ) : plansError ? (
          <p className="text-danger small mb-0">{plansError}</p>
        ) : plans.length === 0 ? (
          <p className="text-muted small mb-0">No subscription plans available.</p>
        ) : (
        <ul className="sub-plan-list">
          {plans.map((plan) => {
            const isSelected = selectedPlanId === plan.id
            const users = isSelected ? planUsers(plan, teamSeats) : plan.defaultUsers
            const monthlyPrice = computeMonthlyPlanPrice(plan, users)
            const price = computePlanPrice(plan, users, billingCycle)
            const additionalRate = perAdditionalUserRate(plan, billingCycle)
            const yearlySavings =
              billingCycle === 'yearly' ? computeYearlySavings(monthlyPrice) : 0

            const isDisabled = !plan.isSelectable

            return (
              <li
                key={plan.id}
                className={`sub-plan-card${isSelected ? ' is-selected' : ''}${
                  isDisabled ? ' is-disabled' : ''
                }`}
              >
                <label
                  className={`sub-plan-head${isDisabled ? ' is-disabled' : ''}`}
                >
                  <input
                    type="radio"
                    name="sub-plan"
                    checked={isSelected}
                    disabled={isDisabled}
                    onChange={() => selectPlan(plan)}
                  />
                  <div className="sub-plan-name-wrap">
                    <span className="sub-plan-name">{plan.name}</span>
                    <span className="sub-plan-subtitle">{plan.subtitle}</span>
                    {isDisabled && (
                      <span className="sub-plan-unavailable">Coming soon</span>
                    )}
                  </div>
                  <div className="sub-plan-price-wrap">
                    <span className="sub-plan-price">{formatPrice(price)}</span>
                    <span className="sub-plan-usage">
                      {plan.pricePerUser > 0
                        ? `+ ${formatPrice(additionalRate)} per additional user`
                        : ''}
                    </span>
                    <span className="sub-plan-usage">
                      {users} {users > 1 ? 'users' : 'user'}/{cycleSuffix}
                    </span>
                    {yearlySavings > 0 && (
                      <p className="sub-plan-savings">
                        You save 2 months ({formatPrice(yearlySavings)})
                      </p>
                    )}
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

                {plan.hasTeamStepper && isSelected && (
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
        )}
      </section>

            <section className="sub-col">
        <header className="sub-col-head">
          <h6 className="sub-col-title">Payment plan</h6>
        </header>

        <ul className="sub-card-list">
          <li className="sub-card is-selected">
            <div className="sub-card-row sub-card-row--static">
              <div className="sub-card-meta">
                <span className="sub-card-number">
                  **** {PAYMENT_CARD.last4}
                </span>
                <span className="sub-card-label">{PAYMENT_CARD.label}</span>
              </div>
              <span className="sub-card-brand">
                {renderCardBrand(PAYMENT_CARD.brand)}
              </span>
            </div>
          </li>
        </ul>
        <button type="button" className="sub-add-card-btn">
          Update Card
        </button>

        <div className="sub-summary">
          <div className="sub-discount">
            <h6>Discount code</h6>
            <div className="sub-discount-row">
              <input
                type="text"
                className="sub-discount-input"
                value={discountCode}
                onChange={(e) => {
                  setDiscountCode(e.target.value)
                  setDiscountMessage(null)
                }}
                placeholder="Enter code"
              />
              <button
                type="button"
                className="sub-discount-apply"
                onClick={handleApplyDiscount}
              >
                Apply
              </button>
            </div>
            {discountMessage && (
              <p className="sub-discount-msg sub-discount-msg--error">{discountMessage}</p>
            )}
          </div>

          {!isFreePlan && totals.planName && (
            <>
              <div className="sub-line">
                <div className="sub-line-text">
                  <span className="sub-line-title">Base plan</span>
                  <span className="sub-line-sub">
                    {totals.planName} · {billingCycleLabel}
                  </span>
                </div>
                <span className="sub-line-amount">
                  {formatPrice(totals.basePlanAmount)}
                </span>
              </div>

              <div className="sub-line">
                <div className="sub-line-text">
                  <span className="sub-line-title">Per user</span>
                  <span className="sub-line-sub">{totals.perUserLineSub}</span>
                </div>
                <span className="sub-line-amount">
                  {formatPrice(totals.perUserAmount)}
                </span>
              </div>

              <div className="sub-line sub-line--total">
                <div className="sub-line-text">
                  <span className="sub-line-title">Team Plan</span>
                  <span className="sub-line-sub">{totals.teamPlanLabel}</span>
                </div>
                <span className="sub-line-amount">
                  {formatPrice(totals.teamPlanAmount)}
                </span>
              </div>

              {billingCycle === 'yearly' && totals.yearlySavings > 0 && (
                <p className="sub-yearly-savings-note">
                  You save 2 months worth ({formatPrice(totals.yearlySavings)}) with
                  yearly billing.
                </p>
              )}
            </>
          )}

          <div className="sub-total">
            <div className="sub-line-text">
              <span className="sub-total-title">Total</span>
              <span className="sub-total-note">{nextPaymentNote}</span>
            </div>
            <span className="sub-total-amount">{formatPrice(totals.total)}</span>
          </div>

          {!isFreePlan && (
            <button type="button" className="sub-pay-btn">
              PAY NOW
            </button>
          )}
        </div>
      </section>

    </div>
  )
}

export default SubscriptionSettingsPage
