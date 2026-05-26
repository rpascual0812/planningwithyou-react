import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import { useAuthSession } from '../../context/AuthSessionContext'
import { useFeatureAccess } from '../../hooks/useFeatureAccess'
import { fetchCurrentAccount } from '../../services/accounts'
import {
  createSubscriptionCheckout,
  fetchCurrentAccountSubscription,
  fetchSubscriptionPlans,
  previewSubscriptionCheckout,
  type AccountSubscriptionRecord,
  type SubscriptionCheckoutPreview,
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

function subscriptionStatusLabel(status: AccountSubscriptionRecord['status']): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'pending':
      return 'Pending payment'
    case 'past_due':
      return 'Past due'
    case 'unpaid':
      return 'Unpaid'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status
  }
}

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

function formatChargeDate(date: Date): string {
  const day = date.getDate()
  const month = date.toLocaleString('en-US', { month: 'long' })
  const year = date.getFullYear()
  return `${day}${getOrdinalSuffix(day)} of ${month} ${year}`
}

function formatNextPaymentCharge(cycle: BillingCycle, from = new Date()): string {
  return formatChargeDate(getNextPaymentDate(cycle, from))
}

function formatAccountSubscriptionEndDate(iso: string): string {
  const parsed = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return iso
  return formatChargeDate(parsed)
}

function formatBillingDate(iso: string | null): string {
  if (!iso) return 'your next billing date'
  const parsed = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function buildCheckoutConfirmHtml(
  preview: SubscriptionCheckoutPreview,
  formatPrice: (amount: number) => string,
): string {
  const dueNow = formatPrice(Number(preview.amount_due_now))
  const nextBill = formatPrice(Number(preview.next_billing_amount))
  const nextDate = formatBillingDate(preview.next_billing_date)
  const cycleLabel = preview.billing_cycle === 'monthly' ? 'month' : 'year'

  if (preview.checkout_kind === 'full_subscription') {
    return (
      '<div class="text-start">' +
      `<p class="mb-2">You will pay <strong>${dueNow}</strong> now to start your subscription.</p>` +
      `<p class="mb-0">Your recurring charge will be <strong>${nextBill}</strong> per ${cycleLabel} ` +
      `(next billing on <strong>${nextDate}</strong>).</p>` +
      '</div>'
    )
  }

  if (preview.checkout_kind === 'seat_upgrade_proration') {
    const seatsLabel =
      preview.additional_seats === 1 ? '1 additional user' : `${preview.additional_seats} additional users`
    return (
      '<div class="text-start">' +
      `<p class="mb-2"><strong>Due today (one-time payment only):</strong> ${dueNow}</p>` +
      `<p class="mb-2">This one-time charge covers ${seatsLabel}, prorated from today through <strong>${nextDate}</strong>.</p>` +
      `<p class="mb-0"><strong>Next billing cycle (${nextDate}):</strong> ${nextBill}</p>` +
      '</div>'
    )
  }

  if (preview.checkout_kind === 'seat_upgrade_applied') {
    return (
      '<div class="text-start">' +
      '<p class="mb-2">No payment is due today.</p>' +
      `<p class="mb-0">Allowed users will be updated. Your next bill on <strong>${nextDate}</strong> will be <strong>${nextBill}</strong>.</p>` +
      '</div>'
    )
  }

  if (preview.checkout_kind === 'seat_reduction_only') {
    return (
      '<div class="text-start">' +
      '<p class="mb-2">No payment is due today.</p>' +
      `<p class="mb-0">Allowed users will be reduced. Your next bill on <strong>${nextDate}</strong> will be <strong>${nextBill}</strong>.</p>` +
      '</div>'
    )
  }

  if (preview.checkout_kind === 'plan_change_only') {
    return (
      '<div class="text-start">' +
      '<p class="mb-2">No payment is due today.</p>' +
      `<p class="mb-0">Your plan will be updated now. Your recurring charge on <strong>${nextDate}</strong> will be <strong>${nextBill}</strong> per ${cycleLabel}.</p>` +
      '</div>'
    )
  }

  return (
    '<div class="text-start">' +
    `<p class="mb-0">Amount due now: <strong>${dueNow}</strong>. Next billing: <strong>${nextBill}</strong> on ${nextDate}.</p>` +
    '</div>'
  )
}

function checkoutConfirmButtonText(preview: SubscriptionCheckoutPreview): string {
  if (
    preview.checkout_kind === 'seat_reduction_only' ||
    preview.checkout_kind === 'seat_upgrade_applied' ||
    preview.checkout_kind === 'plan_change_only'
  ) {
    return 'Apply changes'
  }
  return 'Continue to PayMongo'
}

const SubscriptionSettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { syncAuthState } = useAuthSession()
  const { canWrite: subscriptionWrite } = useFeatureAccess('subscription')
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [plansError, setPlansError] = useState<string | null>(null)
  const [currentSubscription, setCurrentSubscription] =
    useState<AccountSubscriptionRecord | null>(null)
  const [currentSubscriptionLoading, setCurrentSubscriptionLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null)
  const [currencyFormat, setCurrencyFormat] = useState<CurrencyFormatOptions>({
    currencyCode: 'USD',
    locale: 'en-US',
  })
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [teamSeats, setTeamSeats] = useState<number>(1)
  const [discountCode, setDiscountCode] = useState('')
  const [discountMessage, setDiscountMessage] = useState<string | null>(null)
  const [selectionReady, setSelectionReady] = useState(false)
  const [initialSelection, setInitialSelection] = useState<{
    billingCycle: BillingCycle
    selectedPlanId: string
    teamSeats: number
  } | null>(null)
  const lastAppliedSubscriptionKeyRef = useRef('')

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
    setCheckoutError(null)
  }

  const handleApplyDiscount = () => {
    setDiscountMessage('Discount code invalid')
  }

  const loadCurrentSubscription = useCallback(async () => {
    setCurrentSubscriptionLoading(true)
    setSelectionReady(false)
    setInitialSelection(null)
    try {
      const row = await fetchCurrentAccountSubscription()
      setCurrentSubscription(row)
    } catch {
      setCurrentSubscription(null)
    } finally {
      setCurrentSubscriptionLoading(false)
    }
  }, [])

  const subscriptionHasChanges = useMemo(() => {
    if (isFreePlan || !selectionReady || !initialSelection) return false
    return (
      billingCycle !== initialSelection.billingCycle ||
      selectedPlanId !== initialSelection.selectedPlanId ||
      teamSeats !== initialSelection.teamSeats
    )
  }, [
    billingCycle,
    initialSelection,
    isFreePlan,
    selectionReady,
    selectedPlanId,
    teamSeats,
  ])

  const payNowClickable =
    subscriptionWrite &&
    selectionReady &&
    subscriptionHasChanges &&
    !checkoutLoading &&
    !currentSubscriptionLoading &&
    !plansLoading
  const payNowDisabled = !payNowClickable

  const executeCheckout = useCallback(async () => {
    setCheckoutError(null)
    setCheckoutLoading(true)
    try {
      const trimmedDiscount = discountCode.trim()
      const result = await createSubscriptionCheckout({
        plan: selectedPlanId,
        billing_cycle: billingCycle,
        team_seats: teamSeats,
        ...(trimmedDiscount ? { discount_code: trimmedDiscount } : {}),
      })
      if (result.checkout_url) {
        window.location.assign(result.checkout_url)
        return
      }
      if (result.checkout_kind === 'seat_reduction_only') {
        setCheckoutNotice('Allowed users updated. Your next bill will reflect the lower seat count.')
      } else if (result.checkout_kind === 'seat_upgrade_applied') {
        setCheckoutNotice('Additional users applied. No prorated charge was required.')
      } else if (result.checkout_kind === 'plan_change_only') {
        setCheckoutNotice('Plan updated. Your recurring billing amount has been updated for the next cycle.')
      }
      lastAppliedSubscriptionKeyRef.current = ''
      setSelectionReady(false)
      setInitialSelection(null)
      await loadCurrentSubscription()
      syncAuthState()
    } catch (e) {
      setCheckoutError(
        e instanceof Error ? e.message : 'Failed to start subscription checkout',
      )
    } finally {
      setCheckoutLoading(false)
    }
  }, [
    billingCycle,
    discountCode,
    loadCurrentSubscription,
    selectedPlanId,
    syncAuthState,
    teamSeats,
  ])

  const handlePayNow = async () => {
    if (isFreePlan || !payNowClickable) return
    setCheckoutError(null)
    try {
      const preview = await previewSubscriptionCheckout({
        plan: selectedPlanId,
        billing_cycle: billingCycle,
        team_seats: teamSeats,
      })
      const confirmed = await Swal.fire({
        title: 'Confirm subscription payment',
        html: buildCheckoutConfirmHtml(preview, formatPrice),
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: checkoutConfirmButtonText(preview),
        cancelButtonText: 'Cancel',
        focusCancel: true,
        reverseButtons: true,
      })
      if (!confirmed.isConfirmed) return
      await executeCheckout()
    } catch (e) {
      setCheckoutError(
        e instanceof Error ? e.message : 'Failed to prepare subscription checkout',
      )
    }
  }

  const loadPlans = useCallback(async () => {
    setPlansLoading(true)
    setSelectionReady(false)
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

  useEffect(() => {
    void loadCurrentSubscription()
  }, [loadCurrentSubscription])

  const accountSubscriptionKey = currentSubscription
    ? [
        currentSubscription.uuid,
        currentSubscription.status,
        currentSubscription.plan,
        currentSubscription.billing_cycle,
        currentSubscription.team_seats,
      ].join(':')
    : ''

  useEffect(() => {
    if (currentSubscriptionLoading || plansLoading) {
      setSelectionReady(false)
      return
    }

    if (!currentSubscription) {
      setInitialSelection({ billingCycle, selectedPlanId, teamSeats })
      setSelectionReady(true)
      return
    }

    if (lastAppliedSubscriptionKeyRef.current === accountSubscriptionKey && selectionReady) {
      return
    }

    if (billingCycle !== currentSubscription.billing_cycle) {
      setSelectionReady(false)
      setBillingCycle(currentSubscription.billing_cycle)
      return
    }

    if (
      plans.length > 0 &&
      !plans.some((p) => p.id === currentSubscription.plan)
    ) {
      setSelectionReady(false)
      return
    }

    const syncedSeats = Math.max(1, currentSubscription.team_seats)
    setTeamSeats(syncedSeats)
    if (
      plans.length === 0 ||
      plans.some((p) => p.id === currentSubscription.plan)
    ) {
      setSelectedPlanId(currentSubscription.plan)
    }
    setDiscountCode('')
    setDiscountMessage(null)
    lastAppliedSubscriptionKeyRef.current = accountSubscriptionKey
    setInitialSelection({
      billingCycle: currentSubscription.billing_cycle,
      selectedPlanId: currentSubscription.plan,
      teamSeats: syncedSeats,
    })
    setSelectionReady(true)
  }, [
    accountSubscriptionKey,
    billingCycle,
    currentSubscription,
    currentSubscriptionLoading,
    plans,
    plansLoading,
    selectedPlanId,
    selectionReady,
    teamSeats,
  ])

  useEffect(() => {
    const result = searchParams.get('subscription')
    if (result === 'success') {
      setCheckoutNotice(
        'Payment submitted. Your plan will update once PayMongo confirms the subscription.',
      )
      lastAppliedSubscriptionKeyRef.current = ''
      setSelectionReady(false)
      setInitialSelection(null)
      void loadCurrentSubscription()
      syncAuthState()
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('subscription')
          return next
        },
        { replace: true },
      )
    } else if (result === 'cancelled') {
      setCheckoutNotice('Checkout was cancelled. You can try again when ready.')
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('subscription')
          return next
        },
        { replace: true },
      )
    }
  }, [loadCurrentSubscription, searchParams, setSearchParams, syncAuthState])

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
    const chargeDateLabel = currentSubscription?.end_date
      ? formatAccountSubscriptionEndDate(currentSubscription.end_date)
      : formatNextPaymentCharge(billingCycle)
    return `Next payment will charge on the ${chargeDateLabel}`
  }, [billingCycle, currentSubscription?.end_date, isFreePlan])

  return (
    <div className="sub-layout">
      {checkoutNotice && (
        <div className="sub-notices">
          <p className="sub-notice sub-notice--info">{checkoutNotice}</p>
        </div>
      )}

      {!currentSubscriptionLoading && currentSubscription && (
        <section className="sub-current-plan">
          <h6 className="sub-col-title">Current subscription</h6>
          <p className="sub-current-plan-detail">
            <strong>{currentSubscription.plan_name}</strong>
            {' · '}
            {currentSubscription.billing_cycle === 'monthly' ? 'Monthly' : 'Yearly'}
            {' · '}
            {subscriptionStatusLabel(currentSubscription.status)}
            {' · '}
            {currentSubscription.team_seats}{' '}
            allowed {currentSubscription.team_seats === 1 ? 'user' : 'users'}
          </p>
        </section>
      )}

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
                onClick={() => {
                  setBillingCycle(cycle)
                  setCheckoutError(null)
                }}
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
                      <strong>Allowed Users</strong>
                      <span>{plan.teamStepperHint}</span>
                    </div>
                    <div className="sub-stepper" role="group" aria-label="Allowed users">
                      <button
                        type="button"
                        className="sub-stepper-btn"
                        onClick={() => setTeamSeats(Math.max(1, teamSeats - 1))}
                        aria-label="Decrease allowed users"
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
                        aria-label="Allowed users"
                      />
                      <button
                        type="button"
                        className="sub-stepper-btn"
                        onClick={() => setTeamSeats(teamSeats + 1)}
                        aria-label="Increase allowed users"
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
          <h6 className="sub-col-title">Payment</h6>
        </header>

        <div className="sub-paymongo-note">
          <p className="mb-2">
            Subscriptions are billed securely through PayMongo. You will be redirected
            to complete card authorization; your payment method is saved for recurring
            {billingCycle === 'monthly' ? ' monthly' : ' yearly'} charges.
          </p>
          <p className="text-muted small mb-0">
            Supported methods include Visa, Mastercard, and Maya.
          </p>
        </div>

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
                autoComplete="off"
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
            <>
              <button
                type="button"
                className={`sub-pay-btn${payNowDisabled ? ' is-disabled' : ''}`}
                disabled={payNowDisabled}
                aria-disabled={payNowDisabled}
                title={
                  !selectionReady
                    ? 'Loading subscription details…'
                    : !subscriptionHasChanges
                      ? 'Change billing cycle, plan, or allowed users to pay'
                      : undefined
                }
                onClick={() => {
                  if (!payNowClickable) return
                  void handlePayNow()
                }}
              >
                {checkoutLoading ? 'Redirecting…' : 'PAY NOW'}
              </button>
              {checkoutError && (
                <p className="sub-pay-error" role="alert">
                  {checkoutError}
                </p>
              )}
            </>
          )}
        </div>
      </section>

    </div>
  )
}

export default SubscriptionSettingsPage
