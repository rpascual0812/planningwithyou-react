import { apiFetch, authHeaders, buildApiUrl } from './api'
import { getAccessToken } from './auth'

export type AccountSupplierTierSummary = {
  tier_id: number
  tier_name: string
  discount: string | null
  mark_up: string | null
  price: string | null
}

export type AccountRecord = {
  id: number
  name: string
  status: string
  is_active: boolean
  /** Secured API URL stored after upload, e.g. /api/files/a/12/logo/ */
  logo: string
  /** Absolute URL for display (same route, with auth via fetchSecuredFileBlobUrl) */
  logo_url: string
  contact_person: string
  contact_email: string
  contact_mobile_number: string
  timezone: string
  country: number
  country_name: string
  country_iso_code: string
  country_iso2_code: string
  country_currency: string
  country_currency_symbol: string
  country_currency_code: string
  price: string | null
  tier_id?: number | null
  supplier_tiers?: AccountSupplierTierSummary[]
  supplier_type: number
  supplier_type_name: string
  created_at: string
  updated_at: string
}

export type AccountPayload = {
  name?: string
  status?: string
  is_active?: boolean
  logo?: File | null
  contact_person?: string
  contact_email?: string
  contact_mobile_number?: string
  timezone?: string
  price?: string | null
  tier_id?: number | null
  supplier_type?: number
}

function patchHeaders(multipart: boolean): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (!multipart) headers['Content-Type'] = 'application/json'
  return headers
}

function toFormData(data: AccountPayload): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue
    if (key === 'logo') {
      if (value instanceof File) fd.append('logo', value)
      continue
    }
    if (value === null) {
      fd.append(key, '')
      continue
    }
    fd.append(key, String(value))
  }
  return fd
}

export async function fetchCurrentAccount(): Promise<AccountRecord> {
  const res = await apiFetch(buildApiUrl('/api/accounts/current/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load account')
  return res.json()
}

export async function fetchAccountsBySupplierType(
  supplierTypeId: number,
  search = '',
): Promise<AccountRecord[]> {
  const params = new URLSearchParams()
  params.set('supplier_type', String(supplierTypeId))
  if (search) params.set('search', search)
  const res = await apiFetch(buildApiUrl(`/api/accounts/?${params.toString()}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load accounts')
  return res.json()
}

export async function updateAccount(
  id: number,
  data: AccountPayload,
): Promise<AccountRecord> {
  const hasFile = data.logo instanceof File
  const res = await apiFetch(buildApiUrl(`/api/accounts/${id}/`), {
    method: 'PATCH',
    headers: patchHeaders(hasFile),
    body: hasFile ? toFormData(data) : JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update account')
  return res.json()
}

export async function deleteAccount(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`/api/accounts/${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete account')
}
