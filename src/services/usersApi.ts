import { buildApiUrl, getAccessToken, refreshAccessToken } from './auth'

export class ApiRequestError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

export type ApiUser = {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  date_joined: string
}

export type UserCreatePayload = {
  username: string
  email: string
  password: string
  first_name?: string
  last_name?: string
  is_active?: boolean
  is_staff?: boolean
  is_superuser?: boolean
}

export type UserUpdatePayload = {
  username?: string
  email?: string
  password?: string
  first_name?: string
  last_name?: string
  is_active?: boolean
  is_staff?: boolean
  is_superuser?: boolean
}

export type AuthMe = {
  id: number
  username: string
  email: string
  is_superuser: boolean
  is_staff: boolean
}

const USERS_PATH =
  import.meta.env.VITE_API_USERS_PATH?.replace(/\/+$/, '') ?? '/api/users'

function authHeaders(jsonBody: boolean): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (jsonBody) {
    headers['Content-Type'] = 'application/json'
  }
  const token = getAccessToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

/**
 * Re-sends the request once after a successful access-token refresh when the
 * server responds 401 (expired access token is the usual case).
 */
async function fetchWithAuthRetry(
  relativePath: string,
  init: RequestInit,
): Promise<Response> {
  const url = buildApiUrl(relativePath)
  const jsonBody = Boolean(init.body)
  const run = () =>
    fetch(url, {
      ...init,
      headers: authHeaders(jsonBody),
    })
  let response = await run()
  if (response.status === 401 && (await refreshAccessToken())) {
    response = await run()
  }
  return response
}

async function throwIfNotOk(response: Response): Promise<void> {
  if (response.ok) {
    return
  }
  throw new ApiRequestError(response.status, await parseError(response))
}

async function parseError(response: Response): Promise<string> {
  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    return response.statusText || 'Request failed'
  }
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>
    const detail = body.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && typeof detail[0] === 'string') {
      return detail[0]
    }
    const keys = Object.keys(body)
    for (const key of keys) {
      const val = body[key]
      if (typeof val === 'string') return `${key}: ${val}`
      if (Array.isArray(val) && typeof val[0] === 'string') {
        return `${key}: ${val[0]}`
      }
    }
  }
  return 'Request failed'
}

export async function fetchAuthMe(): Promise<AuthMe> {
  const response = await fetchWithAuthRetry('/api/auth/me/', {
    method: 'GET',
  })
  await throwIfNotOk(response)
  return response.json() as Promise<AuthMe>
}

export async function fetchUsers(search: string): Promise<ApiUser[]> {
  const q = search.trim()
  const suffix = q ? `?search=${encodeURIComponent(q)}` : ''
  const response = await fetchWithAuthRetry(`${USERS_PATH}/${suffix}`, {
    method: 'GET',
  })
  await throwIfNotOk(response)
  const data = (await response.json()) as ApiUser[] | { results?: ApiUser[] }
  if (Array.isArray(data)) {
    return data
  }
  if (data && typeof data === 'object' && Array.isArray(data.results)) {
    return data.results
  }
  return []
}

export async function createUser(
  payload: UserCreatePayload,
): Promise<ApiUser> {
  const response = await fetchWithAuthRetry(USERS_PATH + '/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  await throwIfNotOk(response)
  return response.json() as Promise<ApiUser>
}

export async function updateUser(
  id: number,
  payload: UserUpdatePayload,
): Promise<ApiUser> {
  const response = await fetchWithAuthRetry(`${USERS_PATH}/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  await throwIfNotOk(response)
  return response.json() as Promise<ApiUser>
}

export async function deleteUser(id: number): Promise<void> {
  const response = await fetchWithAuthRetry(`${USERS_PATH}/${id}/`, {
    method: 'DELETE',
  })
  await throwIfNotOk(response)
}
