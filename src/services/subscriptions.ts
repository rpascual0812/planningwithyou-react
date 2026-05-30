import { getAccessToken } from './auth'
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
  scheduled_plan: string | null
  scheduled_plan_name: string | null
  scheduled_team_seats: number | null
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
  | 'downgrade_scheduled'

export type SubscriptionReceiptRecord = {
  id: number
  receipt_number: string
  receipt_url: string
  plan_name: string
  amount: string
  paid_at: string
  period_start: string
  period_end: string | null
  created_at: string
}

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
    buildApiUrl(`/subscriptions/?${params.toString()}`),
    { headers: authHeaders() },
  )
  if (!res.ok) throw new Error('Failed to load subscription plans')
  return res.json()
}

export async function fetchCurrentAccountSubscription(): Promise<AccountSubscriptionRecord | null> {
  const res = await apiFetch(buildApiUrl('/account-subscription/current/'), {
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
  const res = await apiFetch(buildApiUrl('/subscriptions/checkout/preview/'), {
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

export async function subscribeToFreePlan(
  billingCycle: 'monthly' | 'yearly' = 'monthly',
): Promise<AccountSubscriptionRecord> {
  const res = await apiFetch(buildApiUrl('/subscriptions/subscribe-free/'), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ billing_cycle: billingCycle }),
  })
  if (!res.ok) {
    let detail = 'Failed to switch to the Free plan'
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
  const res = await apiFetch(buildApiUrl('/subscriptions/checkout/'), {
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

export async function fetchSubscriptionReceipts(): Promise<SubscriptionReceiptRecord[]> {
  const res = await apiFetch(buildApiUrl('/subscriptions/receipts/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load subscription receipts')
  return res.json()
}

export async function downloadSubscriptionReceipt(receiptId: number): Promise<void> {
  const token = getAccessToken()
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await apiFetch(
    buildApiUrl(`/subscriptions/receipts/${receiptId}/download/`),
    { headers },
  )
  if (!res.ok) {
    let detail = 'Failed to download receipt'
    try {
      const body = (await res.json()) as { detail?: string; receipt_url?: string }
      if (body.receipt_url) {
        window.open(body.receipt_url, '_blank', 'noopener,noreferrer')
        return
      }
      if (body.detail) detail = body.detail
    } catch {
      /* not JSON */
    }
    throw new Error(detail)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('json')) {
    const body = (await res.json()) as { receipt_url?: string }
    if (body.receipt_url) {
      window.open(body.receipt_url, '_blank', 'noopener,noreferrer')
      return
    }
    throw new Error('Receipt file is not available')
  }

  const blob = await res.blob()
  const disposition = res.headers.get('content-disposition') ?? ''
  const match = disposition.match(/filename="?([^";]+)"?/i)
  const filename = match?.[1] ?? `subscription-receipt-${receiptId}.pdf`
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
