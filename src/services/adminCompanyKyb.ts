import {
  apiErrorFromResponse,
  apiFetch,
  apiPathWithQuery,
  authHeaders,
  buildApiUrl,
  readJsonResponse,
} from './api'
import type { CompanyKybRecord, PaymongoKybStatus, XenditKybStatus } from './companyKyb'

export type CompanyKybListRecord = {
  id: number
  company: number
  company_name: string
  business_type: string
  paymongo_status: PaymongoKybStatus
  xendit_status: XenditKybStatus
  paymongo_merchant_id?: string
  xendit_account_id?: string
  merchant_business_name?: string
  merchant_email?: string
  submitted_at: string | null
  xendit_submitted_at: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export type AdminKybStatusFilter =
  | 'all'
  | 'pending_paymongo'
  | 'pending_xendit'
  | 'approved_paymongo'
  | 'approved_xendit'
  | 'approved'

export type AdminKybVerificationsPage = {
  count: number
  next: string | null
  previous: string | null
  results: CompanyKybListRecord[]
}

export async function fetchAdminKybVerifications(
  status: AdminKybStatusFilter,
  search = '',
): Promise<CompanyKybListRecord[]> {
  const page = await fetchAdminKybVerificationsPage(1, status, search)
  return page.results
}

export async function fetchAdminKybVerificationsPage(
  page = 1,
  status: AdminKybStatusFilter,
  search = '',
): Promise<AdminKybVerificationsPage> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  if (status !== 'all') {
    params.set('status', status)
  }
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
      body: JSON.stringify({ paymongo_status: 'approved' }),
    },
  )
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to approve KYB verification')
  }
  return readJsonResponse(res, 'Failed to approve KYB verification')
}
