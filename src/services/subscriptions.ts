import { apiFetch, authHeaders, buildApiUrl } from './api'

export type SubscriptionPlanRecord = {
  id: number
  plan: string
  name: string
  subtitle: string
  features: string[]
  billing_cycle: 'monthly' | 'yearly'
  base_price: string
  price_per_user: string
  default_users: number
  has_team_stepper: boolean
  is_active: boolean
  is_selectable: boolean
  sort_order: number
}

export type AccountSubscriptionRecord = {
  uuid: string
  plan: string
  plan_name: string
  billing_cycle: 'monthly' | 'yearly'
  status: 'pending' | 'active' | 'past_due' | 'unpaid' | 'cancelled'
  team_seats: number
  start_date: string
  end_date: string | null
  base_price: string
  total_per_users: string
  total_price: string
  discount_code: string
}

export type SubscriptionCheckoutKind =
  | 'full_subscription'
  | 'seat_upgrade_proration'
  | 'seat_upgrade_applied'
  | 'seat_reduction_only'
  | 'plan_change_only'

export type SubscriptionCheckoutResponse = {
  checkout_kind: SubscriptionCheckoutKind
  checkout_url: string
  account_subscription_uuid: string
  paymongo_subscription_id: string
  success_url: string
  cancel_url: string
  amount: string
  billing_cycle: 'monthly' | 'yearly'
  plan: string
  team_seats: number
}

export async function fetchSubscriptionPlans(
  billingCycle: 'monthly' | 'yearly',
): Promise<SubscriptionPlanRecord[]> {
  const params = new URLSearchParams({ billing_cycle: billingCycle })
  const res = await apiFetch(
    buildApiUrl(`/api/subscriptions/?${params.toString()}`),
    { headers: authHeaders() },
  )
  if (!res.ok) throw new Error('Failed to load subscription plans')
  return res.json()
}

export async function fetchCurrentAccountSubscription(): Promise<AccountSubscriptionRecord | null> {
  const res = await apiFetch(buildApiUrl('/api/account-subscription/current/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load account subscription')
  const data: unknown = await res.json()
  if (data == null) return null
  return data as AccountSubscriptionRecord
}

export type SubscriptionCheckoutPayload = {
  plan: string
  billing_cycle: 'monthly' | 'yearly'
  team_seats?: number
  discount_code?: string
}

export type SubscriptionCheckoutPreview = {
  checkout_kind: SubscriptionCheckoutKind
  amount_due_now: string
  is_one_time_payment: boolean
  next_billing_amount: string
  next_billing_date: string | null
  plan: string
  billing_cycle: 'monthly' | 'yearly'
  team_seats: number
  additional_seats: number
}

export async function previewSubscriptionCheckout(
  payload: SubscriptionCheckoutPayload,
): Promise<SubscriptionCheckoutPreview> {
  const res = await apiFetch(buildApiUrl('/api/subscriptions/checkout/preview/'), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    let detail = 'Failed to load checkout preview'
    try {
      const body = (await res.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return res.json()
}

export async function createSubscriptionCheckout(
  payload: SubscriptionCheckoutPayload,
): Promise<SubscriptionCheckoutResponse> {
  const res = await apiFetch(buildApiUrl('/api/subscriptions/checkout/'), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    let detail = 'Failed to start subscription checkout'
    try {
      const body = (await res.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return res.json()
}
