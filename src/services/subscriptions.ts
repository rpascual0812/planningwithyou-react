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
