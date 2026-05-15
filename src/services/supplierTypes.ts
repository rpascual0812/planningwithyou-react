import { apiFetch, authHeaders, buildApiUrl } from './api'

export type SupplierTypeRecord = {
  id: number
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function fetchActiveSupplierTypes(
  search = '',
): Promise<SupplierTypeRecord[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  const qs = params.toString() ? `?${params.toString()}` : ''
  const res = await apiFetch(buildApiUrl(`/api/supplier-types/${qs}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load supplier types')
  return res.json()
}
