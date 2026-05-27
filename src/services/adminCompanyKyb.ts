import { apiFetch, authHeaders, buildApiUrl } from './api'
import type { CompanyKybRecord, KybStatus } from './companyKyb'

export type CompanyKybListRecord = {
  id: number
  company: number
  company_name: string
  business_type: string
  status: KybStatus
  paymongo_merchant_id?: string
  merchant_business_name?: string
  merchant_email?: string
  submitted_at: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

function extractError(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const obj = body as Record<string, unknown>
  if (typeof obj.detail === 'string') return obj.detail
  for (const val of Object.values(obj)) {
    if (typeof val === 'string') return val
    if (Array.isArray(val) && typeof val[0] === 'string') return val[0]
  }
  return ''
}

async function adminKybApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json()
    return new Error(extractError(body) || fallback)
  } catch {
    return new Error(fallback)
  }
}

export type AdminKybStatusFilter =
  | 'pending_paymongo'
  | 'approved'
  | 'rejected'
  | 'draft'

export async function fetchAdminKybVerifications(
  status: AdminKybStatusFilter,
  search = '',
): Promise<CompanyKybListRecord[]> {
  const params = new URLSearchParams({ status })
  if (search.trim()) {
    params.set('search', search.trim())
  }
  const res = await apiFetch(
    buildApiUrl(`/api/admin/kyb-verifications/?${params}`),
    { headers: authHeaders() },
  )
  if (!res.ok) {
    throw await adminKybApiError(res, 'Failed to load KYB verifications')
  }
  return res.json()
}

export async function fetchAdminKybVerification(
  id: number,
): Promise<CompanyKybRecord> {
  const res = await apiFetch(
    buildApiUrl(`/api/admin/kyb-verifications/${id}/`),
    { headers: authHeaders() },
  )
  if (!res.ok) {
    throw await adminKybApiError(res, 'Failed to load KYB verification')
  }
  return res.json()
}

export async function approveAdminKybVerification(
  id: number,
): Promise<CompanyKybRecord> {
  const res = await apiFetch(
    buildApiUrl(`/api/admin/kyb-verifications/${id}/`),
    {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status: 'approved' }),
    },
  )
  if (!res.ok) {
    throw await adminKybApiError(res, 'Failed to approve KYB verification')
  }
  return res.json()
}
