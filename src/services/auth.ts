type LoginPayload = {
  email: string
  password: string
  remember: boolean
}

type DjangoJwtResponse = {
  access: string
  refresh?: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const JWT_LOGIN_PATH = import.meta.env.VITE_JWT_LOGIN_PATH
const JWT_REFRESH_PATH =
  import.meta.env.VITE_JWT_REFRESH_PATH ?? '/api/token/refresh/'

/** SimpleJWT blacklist URL by default; set `VITE_JWT_LOGOUT_PATH=` to disable server round-trip. */
const JWT_LOGOUT_PATH =
  import.meta.env.VITE_JWT_LOGOUT_PATH !== undefined
    ? import.meta.env.VITE_JWT_LOGOUT_PATH
    : '/api/token/blacklist/'

const TOKEN_STORAGE_KEYS = {
  access: 'auth.accessToken',
  refresh: 'auth.refreshToken',
} as const

export function buildApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const base = (API_BASE_URL ?? '').replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${suffix}` : suffix
}

function getTokenStorage(remember: boolean): Storage {
  return remember ? localStorage : sessionStorage
}

function clearOppositeStorage(remember: boolean) {
  const other = remember ? sessionStorage : localStorage
  other.removeItem(TOKEN_STORAGE_KEYS.access)
  other.removeItem(TOKEN_STORAGE_KEYS.refresh)
}

function persistTokens(tokens: DjangoJwtResponse, remember: boolean) {
  const storage = getTokenStorage(remember)
  const access = tokens.access.trim()
  storage.setItem(TOKEN_STORAGE_KEYS.access, access)
  if (tokens.refresh) {
    storage.setItem(TOKEN_STORAGE_KEYS.refresh, tokens.refresh.trim())
  } else {
    storage.removeItem(TOKEN_STORAGE_KEYS.refresh)
  }
  clearOppositeStorage(remember)
}

function getErrorMessage(data: unknown): string {
  if (!data || typeof data !== 'object') {
    return 'Unable to log in. Please check your credentials.'
  }

  const body = data as Record<string, unknown>
  const detail = body.detail ?? body.non_field_errors ?? body.error

  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && typeof detail[0] === 'string') return detail[0]

  return 'Unable to log in. Please check your credentials.'
}

export async function loginWithJwt({
  email,
  password,
  remember,
}: LoginPayload): Promise<DjangoJwtResponse> {
  const response = await fetch(buildApiUrl(JWT_LOGIN_PATH ?? '/api/token/'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      // Django SimpleJWT commonly expects `username`; custom serializers often
      // accept `email`. Sending both keeps the UI compatible with either setup.
      username: email,
      email,
      password,
    }),
  })

  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    // Ignore empty or non-JSON error responses.
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(data))
  }

  const tokens = data as Partial<DjangoJwtResponse>
  if (!tokens.access) {
    throw new Error('Login succeeded but no access token was returned.')
  }

  const jwtTokens = tokens as DjangoJwtResponse
  persistTokens(jwtTokens, remember)
  return jwtTokens
}

function looksLikeJwt(value: string): boolean {
  const parts = value.split('.')
  return parts.length === 3 && parts.every((p) => p.length > 0)
}

/**
 * Returns the stored access token, trimmed. Invalid or empty values are
 * treated as missing so we never send `Bearer ` garbage to the API.
 */
export function getAccessToken(): string | null {
  for (const storage of [localStorage, sessionStorage] as const) {
    const raw = storage.getItem(TOKEN_STORAGE_KEYS.access)
    if (!raw) {
      continue
    }
    const token = raw.trim().replace(/^Bearer\s+/i, '')
    if (token && looksLikeJwt(token)) {
      return token
    }
  }
  return null
}

function getRefreshSource(): { token: string; remember: boolean } | null {
  const fromLocal = localStorage.getItem(TOKEN_STORAGE_KEYS.refresh)
  if (fromLocal) {
    const token = fromLocal.trim()
    if (token && looksLikeJwt(token)) {
      return { token, remember: true }
    }
  }
  const fromSession = sessionStorage.getItem(TOKEN_STORAGE_KEYS.refresh)
  if (fromSession) {
    const token = fromSession.trim()
    if (token && looksLikeJwt(token)) {
      return { token, remember: false }
    }
  }
  return null
}

/**
 * Uses the stored refresh token to obtain a new access token (SimpleJWT).
 * Returns true when a new access token was stored.
 */
export async function refreshAccessToken(): Promise<boolean> {
  const src = getRefreshSource()
  if (!src) {
    return false
  }
  const response = await fetch(buildApiUrl(JWT_REFRESH_PATH), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ refresh: src.token }),
  })
  if (!response.ok) {
    return false
  }
  let data: { access?: string; refresh?: string } | null = null
  try {
    data = (await response.json()) as { access?: string; refresh?: string }
  } catch {
    return false
  }
  const access = typeof data?.access === 'string' ? data.access.trim() : ''
  if (!access || !looksLikeJwt(access)) {
    return false
  }
  const storage = src.remember ? localStorage : sessionStorage
  storage.setItem(TOKEN_STORAGE_KEYS.access, access)
  if (typeof data?.refresh === 'string' && data.refresh.trim()) {
    storage.setItem(TOKEN_STORAGE_KEYS.refresh, data.refresh.trim())
  }
  clearOppositeStorage(src.remember)
  return true
}

function clearStoredTokens() {
  localStorage.removeItem(TOKEN_STORAGE_KEYS.access)
  localStorage.removeItem(TOKEN_STORAGE_KEYS.refresh)
  sessionStorage.removeItem(TOKEN_STORAGE_KEYS.access)
  sessionStorage.removeItem(TOKEN_STORAGE_KEYS.refresh)
}

function getRefreshToken(): string | null {
  return getRefreshSource()?.token ?? null
}

/**
 * Revokes the refresh token on the server (SimpleJWT blacklist / DB) when
 * configured, then clears access and refresh from storage. Always clears
 * storage even if the network request fails.
 */
export async function logout(): Promise<void> {
  const access = getAccessToken()
  const refresh = getRefreshToken()

  if (JWT_LOGOUT_PATH && (refresh || access)) {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    }
    if (access) {
      headers.Authorization = `Bearer ${access}`
    }
    const init: RequestInit = {
      method: 'POST',
      headers,
    }
    if (refresh) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify({ refresh })
    }
    try {
      await fetch(buildApiUrl(JWT_LOGOUT_PATH), init)
    } catch {
      // Still clear local tokens so the user is signed out in this browser.
    }
  }

  clearStoredTokens()
}
