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
  companies: AdminAccountCompanyRecord[]
  created_at: string
  updated_at: string
}

export type AdminAccountCompanyRecord = {
  id: number
  name: string
  is_main: boolean
  contact_person: string
  contact_email: string
  kyb_verified: boolean
  user_count: number
  max_booking_per_day: number
}

export type AdminAccountsPage = {
  count: number
  next: string | null
  previous: string | null
  results: AdminAccountRecord[]
}

export async function fetchAdminAccounts(
  search = '',
): Promise<AdminAccountRecord[]> {
  const page = await fetchAdminAccountsPage(1, search)
  return page.results
}

export async function fetchAdminAccountsPage(
  page = 1,
  search = '',
): Promise<AdminAccountsPage> {
  const params = new URLSearchParams()
  params.set('page', String(page))
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
