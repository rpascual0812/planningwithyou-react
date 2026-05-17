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

export const TOKEN_STORAGE_KEYS = {
  access: 'auth.accessToken',
  refresh: 'auth.refreshToken',
} as const

const AUTH_BROADCAST_CHANNEL = 'pwu-auth'

/** Fired in the tab that wrote tokens (BroadcastChannel does not echo locally). */
export const AUTH_SESSION_CHANGED_EVENT = 'pwu-auth-session-changed'

/** Refresh access token when it expires within this window. */
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000

/** How often each tab checks whether a refresh is needed. */
const SESSION_KEEPALIVE_INTERVAL_MS = 60 * 1000

type AuthBroadcastMessage =
  | { type: 'login' }
  | { type: 'logout' }
  | { type: 'tokens-updated' }

let authBroadcast: BroadcastChannel | null = null
let refreshInFlight: Promise<boolean> | null = null

function buildApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const base = (API_BASE_URL ?? '').replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${suffix}` : suffix
}

function getAuthBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!authBroadcast) {
    authBroadcast = new BroadcastChannel(AUTH_BROADCAST_CHANNEL)
  }
  return authBroadcast
}

function broadcastAuthMessage(message: AuthBroadcastMessage) {
  getAuthBroadcastChannel()?.postMessage(message)
}

function notifyAuthSessionChanged() {
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT))
}

/** JWT storage is always localStorage so sessions are visible across browser tabs. */
function getTokenStorage(): Storage {
  return localStorage
}

function clearLegacySessionTokens() {
  sessionStorage.removeItem(TOKEN_STORAGE_KEYS.access)
  sessionStorage.removeItem(TOKEN_STORAGE_KEYS.refresh)
}

export function persistTokens(tokens: DjangoJwtResponse, _remember: boolean) {
  const storage = getTokenStorage()
  storage.setItem(TOKEN_STORAGE_KEYS.access, tokens.access)
  if (tokens.refresh) {
    storage.setItem(TOKEN_STORAGE_KEYS.refresh, tokens.refresh)
  } else {
    storage.removeItem(TOKEN_STORAGE_KEYS.refresh)
  }
  clearLegacySessionTokens()
  broadcastAuthMessage({ type: 'tokens-updated' })
  notifyAuthSessionChanged()
}

export function updateStoredAccessToken(access: string, refresh?: string) {
  const storage = getTokenStorage()
  storage.setItem(TOKEN_STORAGE_KEYS.access, access)
  if (refresh) {
    storage.setItem(TOKEN_STORAGE_KEYS.refresh, refresh)
  }
  clearLegacySessionTokens()
  broadcastAuthMessage({ type: 'tokens-updated' })
  notifyAuthSessionChanged()
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

export function getJwtExpiryMs(token: string): number | null {
  try {
    const segment = token.split('.')[1]
    if (!segment) return null
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(normalized)) as { exp?: unknown }
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

export function isAccessTokenExpiringSoon(
  token: string,
  withinMs = REFRESH_BEFORE_EXPIRY_MS,
): boolean {
  const expiryMs = getJwtExpiryMs(token)
  if (expiryMs === null) return true
  return expiryMs - Date.now() <= withinMs
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
  broadcastAuthMessage({ type: 'login' })
  return jwtTokens
}

export function getAccessToken(): string | null {
  return (
    localStorage.getItem(TOKEN_STORAGE_KEYS.access) ??
    sessionStorage.getItem(TOKEN_STORAGE_KEYS.access)
  )
}

export function clearStoredTokens() {
  localStorage.removeItem(TOKEN_STORAGE_KEYS.access)
  localStorage.removeItem(TOKEN_STORAGE_KEYS.refresh)
  sessionStorage.removeItem(TOKEN_STORAGE_KEYS.access)
  sessionStorage.removeItem(TOKEN_STORAGE_KEYS.refresh)
}

function getRefreshToken(): string | null {
  return (
    localStorage.getItem(TOKEN_STORAGE_KEYS.refresh) ??
    sessionStorage.getItem(TOKEN_STORAGE_KEYS.refresh)
  )
}

export function hasStoredSession(): boolean {
  return Boolean(getAccessToken())
}

/**
 * Exchanges the refresh token for a new access token and syncs storage so
 * other tabs receive a `storage` event.
 */
export async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken()
  if (!refresh) return false

  const response = await fetch(buildApiUrl(JWT_REFRESH_PATH), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ refresh }),
  })

  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    // Ignore empty or non-JSON error responses.
  }

  if (!response.ok) return false

  const tokens = data as Partial<DjangoJwtResponse>
  if (!tokens.access) return false

  updateStoredAccessToken(tokens.access, tokens.refresh)
  return true
}

/**
 * Refreshes when the access token is missing, expired, or close to expiry.
 * Concurrent callers in the same tab share one in-flight request.
 */
export async function refreshAccessTokenIfNeeded(): Promise<boolean> {
  const access = getAccessToken()
  const refresh = getRefreshToken()

  if (!refresh) return Boolean(access)
  if (access && !isAccessTokenExpiringSoon(access)) return true

  if (refreshInFlight) return refreshInFlight

  refreshInFlight = refreshAccessToken()
    .then((ok) => ok || Boolean(getAccessToken()))
    .finally(() => {
      refreshInFlight = null
    })

  return refreshInFlight
}

export function startAuthSessionKeepAlive(): () => void {
  const tick = () => {
    if (hasStoredSession()) {
      void refreshAccessTokenIfNeeded()
    }
  }

  tick()

  const intervalId = window.setInterval(tick, SESSION_KEEPALIVE_INTERVAL_MS)

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') tick()
  }
  document.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    window.clearInterval(intervalId)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

type AuthSyncHandlers = {
  onLogin?: () => void
  onLogout?: () => void
  onTokensUpdated?: () => void
}

/**
 * Subscribes to auth changes from this tab (BroadcastChannel) and others
 * (`storage` events). Returns an unsubscribe function.
 */
export function subscribeToAuthSync(handlers: AuthSyncHandlers): () => void {
  const notifyFromStorage = (event: StorageEvent) => {
    if (
      event.key !== TOKEN_STORAGE_KEYS.access &&
      event.key !== TOKEN_STORAGE_KEYS.refresh
    ) {
      return
    }

    if (hasStoredSession()) {
      handlers.onTokensUpdated?.()
    } else {
      handlers.onLogout?.()
    }
  }

  window.addEventListener('storage', notifyFromStorage)

  const channel = getAuthBroadcastChannel()
  const onBroadcast = (event: MessageEvent<AuthBroadcastMessage>) => {
    switch (event.data?.type) {
      case 'login':
        handlers.onLogin?.()
        break
      case 'logout':
        handlers.onLogout?.()
        break
      case 'tokens-updated':
        handlers.onTokensUpdated?.()
        break
      default:
        break
    }
  }
  channel?.addEventListener('message', onBroadcast)

  const notifyLocalSessionChange = () => {
    if (hasStoredSession()) {
      handlers.onTokensUpdated?.()
      handlers.onLogin?.()
    } else {
      handlers.onLogout?.()
    }
  }
  window.addEventListener(AUTH_SESSION_CHANGED_EVENT, notifyLocalSessionChange)

  return () => {
    window.removeEventListener('storage', notifyFromStorage)
    channel?.removeEventListener('message', onBroadcast)
    window.removeEventListener(
      AUTH_SESSION_CHANGED_EVENT,
      notifyLocalSessionChange,
    )
  }
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
  broadcastAuthMessage({ type: 'logout' })
  notifyAuthSessionChanged()
}
