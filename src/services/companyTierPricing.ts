import { apiFetch, authHeaders, buildApiUrl } from './api'

export type CompanyTierPricingRow = {
  tier_id: number
  tier_name: string
  discount: string | null
  mark_up: string | null
  price: string | null
}

export type CompanyTierPricingRecord = {
  name: string
  tiers: CompanyTierPricingRow[]
}

export type CompanyTierPricingPayload = {
  name?: string
  tiers: {
    tier_id: number
    discount?: string | null
    mark_up?: string | null
    price?: string | null
  }[]
}

export async function fetchCompanyTierPricing(
  companyId: number,
  options?: { supplierDirectory?: boolean },
): Promise<CompanyTierPricingRecord> {
  const suffix = options?.supplierDirectory ? '?supplier_directory=1' : ''
  const res = await apiFetch(
    buildApiUrl(`/api/companies/${companyId}/tier-pricing/${suffix}`),
    { headers: authHeaders() },
  )
  if (!res.ok) throw new Error('Failed to load tier pricing')
  return res.json()
}

export async function updateCompanyTierPricing(
  companyId: number,
  data: CompanyTierPricingPayload,
  options?: { supplierDirectory?: boolean },
): Promise<CompanyTierPricingRecord> {
  const suffix = options?.supplierDirectory ? '?supplier_directory=1' : ''
  const res = await apiFetch(
    buildApiUrl(`/api/companies/${companyId}/tier-pricing/${suffix}`),
    {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(data),
    },
  )
  if (!res.ok) throw new Error('Failed to save tier pricing')
  return res.json()
}
