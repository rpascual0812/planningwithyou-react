import { apiFetch, authHeaders, buildApiUrl } from './api'

export type UserRecord = {
  id: number
  account: number | null
  company: number | null
  company_name?: string
  company_timezone?: string
  company_logo_url?: string
  photo_url?: string
  username: string
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  role?: number | null
  role_name?: string
  /** feature -> access level ('none'|'read'|'write'). */
  permissions?: Record<string, 'none' | 'read' | 'write'>
  /** ``subscriptions.plan`` via user.account → account_subscriptions → subscriptions. */
  subscription_plan?: string
  last_login: string | null
  tour_completed_at: string | null
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
  role?: number | null
  company?: number
}

export async function fetchMe(): Promise<UserRecord> {
  const res = await apiFetch(buildApiUrl('/users/me/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load current user')
  return res.json()
}

/** Mark the per-user product tour as completed (finish or skip). */
export async function completeProductTour(): Promise<UserRecord> {
  const res = await apiFetch(buildApiUrl('/users/me/'), {
    method: 'PATCH',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ complete_product_tour: true }),
  })
  if (!res.ok) throw new Error('Failed to save tour progress')
  return res.json()
}

export async function restartProductTour(): Promise<UserRecord> {
  const res = await apiFetch(buildApiUrl('/users/me/'), {
    method: 'PATCH',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ restart_product_tour: true }),
  })
  if (!res.ok) throw new Error('Failed to restart tour')
  return res.json()
}

export type UserSeatUsage = {
  active_users_count: number
  team_seats: number
  at_seat_limit: boolean
}

export type UsersPage = {
  count: number
  next: string | null
  previous: string | null
  results: UserRecord[]
}

export async function fetchUserSeatUsage(): Promise<UserSeatUsage> {
  const res = await apiFetch(buildApiUrl('/users/seat-usage/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load user seat usage')
  return res.json()
}

export async function fetchUsers(
  search = '',
  companyId?: number | null,
): Promise<UserRecord[]> {
  const page = await fetchUsersPage(1, search, companyId)
  return page.results
}

export async function fetchUsersPage(
  page = 1,
  search = '',
  companyId?: number | null,
): Promise<UsersPage> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  if (search) params.set('search', search)
  if (companyId != null) params.set('company_id', String(companyId))
  const qs = params.toString() ? `?${params.toString()}` : ''
  const res = await apiFetch(buildApiUrl(`/users/${qs}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load users')
  return res.json()
}

export async function createUser(data: UserPayload): Promise<UserRecord> {
  const res = await apiFetch(buildApiUrl('/users/'), {
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

function userPatchHeaders(multipart: boolean): Record<string, string> {
  const headers = authHeaders()
  if (multipart) delete headers['Content-Type']
  return headers
}

export type ProfilePayload = Pick<
  UserPayload,
  'first_name' | 'last_name' | 'username' | 'email'
>

export async function updateMe(data: Partial<ProfilePayload>): Promise<UserRecord> {
  const res = await apiFetch(buildApiUrl('/users/me/'), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to update profile')
  }
  return res.json()
}

export async function uploadMyPhoto(photo: File): Promise<UserRecord> {
  const fd = new FormData()
  fd.append('photo', photo)
  const res = await apiFetch(buildApiUrl('/users/me/'), {
    method: 'PATCH',
    headers: userPatchHeaders(true),
    body: fd,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to upload profile photo')
  }
  return res.json()
}

export async function changeMyPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const res = await apiFetch(buildApiUrl('/users/me/change-password/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to update password')
  }
}

export async function updateUser(
  id: number,
  data: Partial<UserPayload>,
): Promise<UserRecord> {
  const res = await apiFetch(buildApiUrl(`/users/${id}/`), {
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

export async function uploadUserPhoto(id: number, photo: File): Promise<UserRecord> {
  const fd = new FormData()
  fd.append('photo', photo)
  const res = await apiFetch(buildApiUrl(`/users/${id}/`), {
    method: 'PATCH',
    headers: userPatchHeaders(true),
    body: fd,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to upload profile photo')
  }
  return res.json()
}

export async function deleteUser(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`/users/${id}/`), {
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
