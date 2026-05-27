import {
  apiErrorFromResponse,
  apiFetch,
  apiPathWithQuery,
  authHeaders,
  buildApiUrl,
  readJsonResponse,
} from './api'
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
    buildApiUrl(apiPathWithQuery('/admin/kyb-verifications', params)),
    { headers: authHeaders() },
  )
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to load KYB verifications')
  }
  return readJsonResponse(res, 'Failed to load KYB verifications')
}

export async function fetchAdminKybVerification(
  id: number,
): Promise<CompanyKybRecord> {
  const res = await apiFetch(
    buildApiUrl(`/admin/kyb-verifications/${id}/`),
    { headers: authHeaders() },
  )
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to load KYB verification')
  }
  return readJsonResponse(res, 'Failed to load KYB verification')
}

export async function approveAdminKybVerification(
  id: number,
): Promise<CompanyKybRecord> {
  const res = await apiFetch(
    buildApiUrl(`/admin/kyb-verifications/${id}/`),
    {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status: 'approved' }),
    },
  )
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to approve KYB verification')
  }
  return readJsonResponse(res, 'Failed to approve KYB verification')
}
