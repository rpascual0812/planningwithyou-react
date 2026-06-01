import {
  apiErrorFromResponse,
  apiFetch,
  apiPathWithQuery,
  authHeaders,
  buildApiUrl,
  readJsonResponse,
} from './api'

export type AdminAccountRecord = {
  id: number
  name: string
  is_active: boolean
  contact_person: string
  contact_email: string
  contact_mobile_number: string
  timezone: string
  country: number
  country_name: string
  paymongo_customer_id: string
  company_count: number
  user_count: number
  created_at: string
  updated_at: string
}

export async function fetchAdminAccounts(
  search = '',
): Promise<AdminAccountRecord[]> {
  const params = new URLSearchParams()
  if (search.trim()) {
    params.set('search', search.trim())
  }
  const res = await apiFetch(
    buildApiUrl(apiPathWithQuery('/admin/accounts/', params)),
    { headers: authHeaders() },
  )
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to load accounts')
  }
  return readJsonResponse(res, 'Failed to load accounts')
}
