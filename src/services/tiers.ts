import { apiFetch, authHeaders, buildApiUrl } from './api'
import { parseApiList } from './parseApiList'

export type TierRecord = {
  id: number
  name: string
  is_active: boolean
  created_at: string
}

export type TierPayload = {
  name: string
  is_active?: boolean
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

async function tierApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json()
    return new Error(extractError(body) || fallback)
  } catch {
    return new Error(fallback)
  }
}

/** Active tiers only (supplier fields, dropdowns). */
export async function fetchTiers(): Promise<TierRecord[]> {
  const res = await apiFetch(buildApiUrl('/api/tiers/?active_only=true'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load tiers')
  const data: unknown = await res.json()
  return parseApiList<TierRecord>(data)
}

/** All non-deleted tiers for settings management. */
export async function fetchAllTiers(): Promise<TierRecord[]> {
  const res = await apiFetch(buildApiUrl('/api/tiers/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load tiers')
  const data: unknown = await res.json()
  return parseApiList<TierRecord>(data)
}

export async function createTier(data: TierPayload): Promise<TierRecord> {
  const res = await apiFetch(buildApiUrl('/api/tiers/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await tierApiError(res, 'Failed to create tier')
  return res.json()
}

export async function updateTier(
  id: number,
  data: Partial<TierPayload>,
): Promise<TierRecord> {
  const res = await apiFetch(buildApiUrl(`/api/tiers/${id}/`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await tierApiError(res, 'Failed to update tier')
  return res.json()
}

export async function deleteTier(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`/api/tiers/${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw await tierApiError(res, 'Failed to delete tier')
}
