import { apiFetch, authHeaders, buildApiUrl, apiPathWithQuery } from './api'
import { getAccessToken } from './auth'
import { parseApiList } from './parseApiList'

export type TierAdjustmentType = 'percent' | 'fixed'

export type CompanySupplierTierSummary = {
  tier_id: number
  tier_name: string
  discount: string | null
  discount_type?: TierAdjustmentType
  mark_up: string | null
  mark_up_type?: TierAdjustmentType
  price: string | null
  original_price: string | null
}

export type CompanyRecord = {
  id: number
  name: string
  supplier_type: number
  supplier_type_name: string
  supplier_tiers?: CompanySupplierTierSummary[]
  currency_symbol?: string
  currency_code?: string
  timezone: string
  contact_person: string
  contact_email: string
  phone_number: string
  mobile_number: string
  address: string
  website: string
  is_active: boolean
  is_main: boolean
  kyb_verified: boolean
  max_bookings_per_day: number
  logo: string
  logo_url: string
  sort_order: number
  created_at: string
}

export type CompanyPayload = {
  name: string
  supplier_type?: number
  timezone?: string
  contact_person?: string
  contact_email?: string
  phone_number?: string
  mobile_number?: string
  address?: string
  website?: string
  is_active?: boolean
  is_main?: boolean
  max_bookings_per_day?: number
  sort_order?: number
  logo?: File | null
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

async function companyApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json()
    return new Error(extractError(body) || fallback)
  } catch {
    return new Error(fallback)
  }
}

function patchHeaders(multipart: boolean): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (!multipart) headers['Content-Type'] = 'application/json'
  return headers
}

function toFormData(data: CompanyPayload): FormData {
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

export async function fetchCompanies(): Promise<CompanyRecord[]> {
  const res = await apiFetch(buildApiUrl('/companies/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load companies')
  const data: unknown = await res.json()
  return parseApiList<CompanyRecord>(data)
}

/** All active companies (any account) for admin / supplier directory. */
export async function fetchCompaniesDirectory(): Promise<CompanyRecord[]> {
  const res = await apiFetch(
    buildApiUrl(
      apiPathWithQuery('/companies', {
        supplier_directory: '1',
        active_only: 'true',
      }),
    ),
    { headers: authHeaders() },
  )
  if (!res.ok) throw new Error('Failed to load companies')
  const data: unknown = await res.json()
  return parseApiList<CompanyRecord>(data)
}

/** Active, non-deleted companies for the current account. */
export async function fetchActiveCompanies(): Promise<CompanyRecord[]> {
  const res = await apiFetch(buildApiUrl('/companies/?active_only=true'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load companies')
  const data: unknown = await res.json()
  return parseApiList<CompanyRecord>(data)
}

function supplierDirectoryQuery(): string {
  return 'supplier_directory=1'
}

export async function fetchCompaniesBySupplierType(
  supplierTypeId: number,
  search = '',
): Promise<CompanyRecord[]> {
  const params = new URLSearchParams()
  params.set('supplier_type', String(supplierTypeId))
  params.set('supplier_directory', '1')
  if (search) params.set('search', search)
  const res = await apiFetch(buildApiUrl(`/companies/?${params.toString()}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load companies')
  const data: unknown = await res.json()
  return parseApiList<CompanyRecord>(data)
}

export async function createCompany(data: CompanyPayload): Promise<CompanyRecord> {
  const hasFile = data.logo instanceof File
  const res = await apiFetch(buildApiUrl('/companies/'), {
    method: 'POST',
    headers: patchHeaders(hasFile),
    body: hasFile ? toFormData(data) : JSON.stringify(data),
  })
  if (!res.ok) throw await companyApiError(res, 'Failed to create company')
  return res.json()
}

export async function updateCompany(
  id: number,
  data: Partial<CompanyPayload>,
  options?: { supplierDirectory?: boolean },
): Promise<CompanyRecord> {
  const hasFile = data.logo instanceof File
  const suffix = options?.supplierDirectory ? `?${supplierDirectoryQuery()}` : ''
  const res = await apiFetch(buildApiUrl(`/companies/${id}/${suffix}`), {
    method: 'PATCH',
    headers: patchHeaders(hasFile),
    body: hasFile ? toFormData(data as CompanyPayload) : JSON.stringify(data),
  })
  if (!res.ok) throw await companyApiError(res, 'Failed to update company')
  return res.json()
}

export async function deleteCompany(
  id: number,
  options?: { supplierDirectory?: boolean },
): Promise<void> {
  const suffix = options?.supplierDirectory ? `?${supplierDirectoryQuery()}` : ''
  const res = await apiFetch(buildApiUrl(`/companies/${id}/${suffix}`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw await companyApiError(res, 'Failed to delete company')
}
