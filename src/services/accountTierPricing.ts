import { apiFetch, authHeaders, buildApiUrl } from './api'

export type AccountTierPricingRow = {
  tier_id: number
  tier_name: string
  discount: string | null
  mark_up: string | null
  price: string | null
}

export type AccountTierPricingRecord = {
  name: string
  tiers: AccountTierPricingRow[]
}

export type AccountTierPricingPayload = {
  name?: string
  tiers: {
    tier_id: number
    discount?: string | null
    mark_up?: string | null
    price?: string | null
  }[]
}

export async function fetchAccountTierPricing(
  accountId: number,
): Promise<AccountTierPricingRecord> {
  const res = await apiFetch(
    buildApiUrl(`/api/accounts/${accountId}/tier-pricing/`),
    { headers: authHeaders() },
  )
  if (!res.ok) throw new Error('Failed to load tier pricing')
  return res.json()
}

export async function updateAccountTierPricing(
  accountId: number,
  data: AccountTierPricingPayload,
): Promise<AccountTierPricingRecord> {
  const res = await apiFetch(
    buildApiUrl(`/api/accounts/${accountId}/tier-pricing/`),
    {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(data),
    },
  )
  if (!res.ok) throw new Error('Failed to save tier pricing')
  return res.json()
}
