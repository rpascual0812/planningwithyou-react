import { apiFetch, authHeaders, buildApiUrl } from './api'

export type AccountRecord = {
  id: number
  name: string
  status: string
  is_active: boolean
  discount: string | null
  price_adjustment: string | null
  price: string | null
  supplier_type: number
  supplier_type_name: string
  created_at: string
  updated_at: string
}

export type AccountPayload = {
  name?: string
  status?: string
  is_active?: boolean
  discount?: string | null
  price_adjustment?: string | null
  price?: string | null
  supplier_type?: number
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
