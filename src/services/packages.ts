import { apiFetch, authHeaders, buildApiUrl } from './api'
import { parseApiList } from './parseApiList'

export type PackageItemRecord = {
  id: number
  title: string
  price: string
  is_active: boolean
  children?: PackageItemRecord[]
}

export type PackageItemPayload = {
  title: string
  price?: string | number
  is_active?: boolean
  children?: PackageItemPayload[]
}

export type PackageRecord = {
  id: number
  package_version: number
  tier: number
  tier_name: string
  description: string
  total_price: string
  required_downpayment_amount: string
  company: number
  is_active: boolean
  items?: PackageItemRecord[]
  created_at: string
}

export type PackagePayload = {
  tier: number
  description?: string
  total_price?: string | number
  required_downpayment_amount?: string | number
  company?: number
  package_version?: number
  is_active?: boolean
  items?: PackageItemPayload[]
}

function extractError(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const obj = body as Record<string, unknown>
  for (const val of Object.values(obj)) {
    if (typeof val === 'string') return val
    if (Array.isArray(val) && typeof val[0] === 'string') return val[0]
  }
  return ''
}

async function packageApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json()
    return new Error(extractError(body) || fallback)
  } catch {
    return new Error(fallback)
  }
}

export async function fetchPackage(id: number): Promise<PackageRecord> {
  const res = await apiFetch(buildApiUrl(`/package-prices/${id}/`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load package')
  return res.json()
}

export async function fetchPackages(
  companyId: number,
  tierId: number,
  packageVersionId: number,
): Promise<PackageRecord[]> {
  const params = new URLSearchParams({
    company_id: String(companyId),
    tier_id: String(tierId),
    package_version_id: String(packageVersionId),
  })
  const res = await apiFetch(buildApiUrl(`/package-prices/?${params.toString()}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load packages')
  const data: unknown = await res.json()
  return parseApiList<PackageRecord>(data)
}

export async function createPackage(data: PackagePayload): Promise<PackageRecord> {
  const res = await apiFetch(buildApiUrl('/package-prices/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await packageApiError(res, 'Failed to create package')
  return res.json()
}

export async function updatePackage(
  id: number,
  data: Partial<PackagePayload>,
): Promise<PackageRecord> {
  const res = await apiFetch(buildApiUrl(`/package-prices/${id}/`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await packageApiError(res, 'Failed to update package')
  return res.json()
}

export async function deletePackage(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`/package-prices/${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw await packageApiError(res, 'Failed to delete package')
}

export function formatPackagePrice(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value))
  if (Number.isNaN(n)) return String(value)
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
