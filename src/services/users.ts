import { apiFetch, authHeaders, buildApiUrl } from './api'

export type UserRecord = {
  id: number
  account: number | null
  username: string
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  is_admin: boolean
  last_login: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type UserPayload = {
  username: string
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  is_admin: boolean
  account?: number | null
}

export async function fetchMe(): Promise<UserRecord> {
  const res = await apiFetch(buildApiUrl('/api/users/me/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load current user')
  return res.json()
}

export async function fetchUsers(search = ''): Promise<UserRecord[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  const res = await apiFetch(buildApiUrl(`/api/users/${qs}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load users')
  return res.json()
}

export async function createUser(data: UserPayload): Promise<UserRecord> {
  const res = await apiFetch(buildApiUrl('/api/users/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to create user')
  }
  return res.json()
}

export async function updateUser(
  id: number,
  data: Partial<UserPayload>,
): Promise<UserRecord> {
  const res = await apiFetch(buildApiUrl(`/api/users/${id}/`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to update user')
  }
  return res.json()
}

export async function deleteUser(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`/api/users/${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete user')
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
