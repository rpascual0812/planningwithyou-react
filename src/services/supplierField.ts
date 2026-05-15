import { apiFetch, authHeaders, buildApiUrl } from './api'

export type TierRecord = {
  id: number
  name: string
  is_active: boolean
  created_at: string
}

export type SupplierOptionRecord = {
  id: number
  name: string
  discount: string | null
  discount_type: string
  price_adjustment: string | null
  price_adjustment_type: string
  price: string | null
}

export async function fetchTiers(): Promise<TierRecord[]> {
  const res = await apiFetch(buildApiUrl('/api/tiers/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load tiers')
  return res.json()
}

export async function fetchSupplierOptions(
  tierId: number,
): Promise<SupplierOptionRecord[]> {
  const url = `${buildApiUrl('/api/supplier-options/')}?tier_id=${encodeURIComponent(String(tierId))}`
  const res = await apiFetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to load suppliers')
  return res.json()
}
