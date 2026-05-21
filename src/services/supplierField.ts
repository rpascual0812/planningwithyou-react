import { apiFetch, authHeaders, buildApiUrl } from './api'
import { parseApiList } from './parseApiList'

export type SupplierOptionRecord = {
  id: number
  name: string
  supplier_type_id: number
  kyb_verified: boolean
}

export type SupplierTierOptionRecord = {
  id: number
  name: string
  is_active: boolean
  discount: string | null
  discount_type: string
  mark_up: string | null
  mark_up_type: string
  price_override: string | null
  tax: string | null
  price: string | null
}

export type FetchSupplierOptionsParams = {
  supplierTypeId?: number
  /** Include this supplier when resolving edit state (even if type filter differs). */
  supplierId?: number
}

/** Companies with active supplier settings for the booking supplier field. */
export async function fetchSupplierOptions(
  params: FetchSupplierOptionsParams = {},
): Promise<SupplierOptionRecord[]> {
  const search = new URLSearchParams()
  if (params.supplierTypeId != null) {
    search.set('supplier_type', String(params.supplierTypeId))
  }
  if (params.supplierId != null) {
    search.set('supplier_id', String(params.supplierId))
  }
  const qs = search.toString() ? `?${search.toString()}` : ''
  const res = await apiFetch(buildApiUrl(`/api/supplier-options/${qs}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load suppliers')
  const data: unknown = await res.json()
  return parseApiList<SupplierOptionRecord>(data)
}

/** Tiers available for the selected supplier. */
export type SupplierBookingCapacityResult = {
  supplier_id: number
  max_bookings_per_day: number
  booking_count: number
  at_capacity: boolean
  available: boolean
}

export async function fetchSupplierBookingCapacity(params: {
  supplierId: number
  dateOfEvent: string
  excludeBookingId?: number | null
}): Promise<SupplierBookingCapacityResult> {
  const search = new URLSearchParams()
  search.set('supplier_id', String(params.supplierId))
  search.set('date_of_event', params.dateOfEvent)
  if (params.excludeBookingId != null) {
    search.set('exclude_booking_id', String(params.excludeBookingId))
  }
  const res = await apiFetch(
    buildApiUrl(`/api/supplier-booking-capacity/?${search.toString()}`),
    { headers: authHeaders() },
  )
  if (!res.ok) throw new Error('Failed to check supplier booking capacity')
  return res.json()
}

export async function fetchTiersForSupplier(
  supplierId: number,
): Promise<SupplierTierOptionRecord[]> {
  const url = `${buildApiUrl('/api/supplier-tiers/')}?supplier_id=${encodeURIComponent(String(supplierId))}`
  const res = await apiFetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to load tiers')
  const data: unknown = await res.json()
  return parseApiList<SupplierTierOptionRecord>(data)
}
