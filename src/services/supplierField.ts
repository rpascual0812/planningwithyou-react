import { apiFetch, authHeaders, buildApiUrl } from './api'
import { parseApiList } from './parseApiList'

export type SupplierOptionRecord = {
  id: number
  name: string
  discount?: string | null
  discount_type?: string
  price_adjustment?: string | null
  price_adjustment_type?: string
  price?: string | null
}

export type SupplierTierOptionRecord = {
  id: number
  name: string
  is_active: boolean
  discount: string | null
  discount_type: string
  price_adjustment: string | null
  price_adjustment_type: string
  price: string | null
}

/** All suppliers linked to the current account (no tier filter). */
export async function fetchSupplierOptions(): Promise<SupplierOptionRecord[]> {
  const res = await apiFetch(buildApiUrl('/api/supplier-options/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load suppliers')
  const data: unknown = await res.json()
  return parseApiList<SupplierOptionRecord>(data)
}

/** Tiers available for the selected supplier. */
export async function fetchTiersForSupplier(
  supplierId: number,
): Promise<SupplierTierOptionRecord[]> {
  const url = `${buildApiUrl('/api/supplier-tiers/')}?supplier_id=${encodeURIComponent(String(supplierId))}`
  const res = await apiFetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to load tiers')
  const data: unknown = await res.json()
  return parseApiList<SupplierTierOptionRecord>(data)
}
