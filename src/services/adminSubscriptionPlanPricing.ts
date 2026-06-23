import { apiFetch, authHeaders, buildApiUrl } from './api'

export type SubscriptionPlanPricing = {
  base_price: string
  price_per_user: string
}

export type SubscriptionPlanPricingSettings = {
  pro: SubscriptionPlanPricing
  ai: SubscriptionPlanPricing
  admin: SubscriptionPlanPricing
}

export async function fetchAdminSubscriptionPlanPricing(): Promise<SubscriptionPlanPricingSettings> {
  const res = await apiFetch(buildApiUrl('/admin/subscription-plan-pricing/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load subscription plan pricing')
  return res.json()
}

export async function updateAdminSubscriptionPlanPricing(
  payload: SubscriptionPlanPricingSettings,
): Promise<SubscriptionPlanPricingSettings> {
  const res = await apiFetch(buildApiUrl('/admin/subscription-plan-pricing/'), {
    method: 'PATCH',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    let detail = 'Failed to update subscription plan pricing'
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
