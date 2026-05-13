import { getAccessToken } from './auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

function buildApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const base = (API_BASE_URL ?? '').replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${suffix}` : suffix
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  const token = getAccessToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

export type UserRecord = {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  is_staff: boolean
  date_joined: string
}

export type UserPayload = {
  username: string
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  is_staff: boolean
  password?: string
}

export async function fetchUsers(search = ''): Promise<UserRecord[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  const res = await fetch(buildApiUrl(`/api/users/${qs}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load users')
  return res.json()
}

export async function createUser(data: UserPayload): Promise<UserRecord> {
  const res = await fetch(buildApiUrl('/api/users/'), {
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
  const res = await fetch(buildApiUrl(`/api/users/${id}/`), {
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
  const res = await fetch(buildApiUrl(`/api/users/${id}/`), {
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
