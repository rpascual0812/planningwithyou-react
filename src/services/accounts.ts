import { apiFetch, authHeaders, buildApiUrl } from './api'

export type AccountRecord = {
  id: number
  name: string
  status: string
  is_active: boolean
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
  /** Active ``subscriptions.plan`` slug (e.g. ``free``, ``pro``). */
  subscription_plan?: string
  created_at: string
  updated_at: string
}

export type AccountPayload = {
  name?: string
  status?: string
  is_active?: boolean
  contact_person?: string
  contact_email?: string
  contact_mobile_number?: string
  timezone?: string
}

export async function fetchCurrentAccount(): Promise<AccountRecord> {
  const res = await apiFetch(buildApiUrl('/api/accounts/current/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load account')
  return res.json()
}

export async function updateAccount(
  id: number,
  data: AccountPayload,
): Promise<AccountRecord> {
  const res = await apiFetch(buildApiUrl(`/api/accounts/${id}/`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
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
