import { apiFetch, authHeaders, buildApiUrl } from './api'
import { parseApiList } from './parseApiList'
import type { PackageItemRecord } from './packages'

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
  /** Active package ``total_price`` for this tier (before tenant adjustments). */
  package_total_price?: string | null
  required_downpayment_amount: string | null
  package_price_id: number | null
  package_version_id: number | null
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
  const res = await apiFetch(buildApiUrl(`/supplier-options/${qs}`), {
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
  quotation_count: number
  at_capacity: boolean
  available: boolean
}

export async function fetchSupplierBookingCapacity(params: {
  supplierId: number
  dateOfEvent: string
  excludeQuotationId?: number | null
}): Promise<SupplierBookingCapacityResult> {
  const search = new URLSearchParams()
  search.set('supplier_id', String(params.supplierId))
  search.set('date_of_event', params.dateOfEvent)
  if (params.excludeQuotationId != null) {
    search.set('exclude_quotation_id', String(params.excludeQuotationId))  }
  const res = await apiFetch(
    buildApiUrl(`/supplier-quotation-capacity/?${search.toString()}`),
    { headers: authHeaders() },
  )
  if (!res.ok) throw new Error('Failed to check supplier booking capacity')
  return res.json()
}

export async function fetchTiersForSupplier(
  supplierId: number,
): Promise<SupplierTierOptionRecord[]> {
  const url = `${buildApiUrl('/supplier-tiers/')}?supplier_id=${encodeURIComponent(String(supplierId))}`
  const res = await apiFetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to load tiers')
  const data: unknown = await res.json()
  return parseApiList<SupplierTierOptionRecord>(data)
}

export type BookingSupplierPackageRecord = {
  id: number
  tier: number
  tier_name: string
  description: string
  total_price: string
  required_downpayment_amount: string
  items: PackageItemRecord[]
}

/** Quotation line price for a selected supplier package. */
export function resolveSupplierPackageLinePrice(
  tier: SupplierTierOptionRecord | null | undefined,
  packageDetail: BookingSupplierPackageRecord | null,
): string | null {
  const tierPrice = tier?.price?.trim()
  if (tierPrice) return tierPrice
  const packagePrice = packageDetail?.total_price?.trim()
  if (packagePrice) return packagePrice
  const tierPackagePrice = tier?.package_total_price?.trim()
  return tierPackagePrice || null
}

export function resolveSupplierPackageDownpayment(
  tier: SupplierTierOptionRecord | null | undefined,
  packageDetail: BookingSupplierPackageRecord | null,
): string | null {
  const tierDown = tier?.required_downpayment_amount?.trim()
  if (tierDown) return tierDown
  const packageDown = packageDetail?.required_downpayment_amount?.trim()
  return packageDown || null
}

export async function fetchBookingSupplierPackage(params: {
  companyId: number
  tierId: number
  packageVersionId?: number | null
}): Promise<BookingSupplierPackageRecord | null> {
  const search = new URLSearchParams({
    company_id: String(params.companyId),
    tier_id: String(params.tierId),
  })
  if (params.packageVersionId != null) {
    search.set('package_version_id', String(params.packageVersionId))
  }
  const res = await apiFetch(
    buildApiUrl(`/booking-supplier-package/?${search.toString()}`),
    { headers: authHeaders() },
  )
  if (!res.ok) throw new Error('Failed to load package items')
  const data: unknown = await res.json()
  if (data == null) return null
  return data as BookingSupplierPackageRecord
}
