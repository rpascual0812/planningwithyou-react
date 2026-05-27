import Swal from 'sweetalert2'
import {
  clearStoredTokens,
  getAccessToken,
  refreshAccessToken,
} from './auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

/** Strip legacy ``/api`` prefix so old stored paths still resolve. */
export function normalizeApiPath(path: string): string {
  if (!path.startsWith('/')) return path
  if (path === '/api') return '/'
  if (path.startsWith('/api/')) return path.slice(4)
  return path
}

export function buildApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const base = (API_BASE_URL ?? '').replace(/\/+$/, '')
  const suffix = normalizeApiPath(path.startsWith('/') ? path : `/${path}`)
  return base ? `${base}${suffix}` : suffix
}

type QueryParamValue = string | number | boolean | null | undefined

/** DRF list URL with trailing slash and optional query string. */
export function apiPathWithQuery(
  path: string,
  params?: URLSearchParams | Record<string, QueryParamValue>,
): string {
  let normalized = normalizeApiPath(path.startsWith('/') ? path : `/${path}`)
  if (!normalized.endsWith('/')) {
    normalized = `${normalized}/`
  }
  if (!params) return normalized

  const search =
    params instanceof URLSearchParams
      ? params
      : new URLSearchParams(
          Object.entries(params)
            .filter(([, value]) => value != null && value !== '')
            .map(([key, value]) => [key, String(value)]),
        )
  const qs = search.toString()
  return qs ? `${normalized}?${qs}` : normalized
}

export function extractApiError(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const obj = body as Record<string, unknown>
  if (typeof obj.detail === 'string') return obj.detail
  for (const val of Object.values(obj)) {
    if (typeof val === 'string') return val
    if (Array.isArray(val) && typeof val[0] === 'string') return val[0]
  }
  return ''
}

function nonJsonApiMessage(res: Response, fallback: string): string {
  if (res.status === 404) {
    return `${fallback}: API not found. Set VITE_API_BASE_URL to your Django host (e.g. http://localhost:8000).`
  }
  return `${fallback} (server returned HTML instead of JSON — check API base URL and path).`
}

export async function readJsonResponse<T>(
  res: Response,
  fallback: string,
): Promise<T> {
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) {
    throw new Error(nonJsonApiMessage(res, fallback))
  }
  try {
    return (await res.json()) as T
  } catch {
    throw new Error(`${fallback}: invalid JSON in response`)
  }
}

export async function apiErrorFromResponse(
  res: Response,
  fallback: string,
): Promise<Error> {
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) {
    return new Error(nonJsonApiMessage(res, fallback))
  }
  try {
    const body = await res.json()
    return new Error(extractApiError(body) || fallback)
  } catch {
    return new Error(fallback)
  }
}

export function authHeaders(): Record<string, string> {
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

let sessionExpiredShown = false

async function handleSessionExpired() {
  if (sessionExpiredShown) return
  sessionExpiredShown = true

  clearStoredTokens()

  await Swal.fire({
    icon: 'warning',
    title: 'Session Expired',
    text: 'Your session is no longer valid. Please log in again.',
    confirmButtonText: 'Go to Login',
    allowOutsideClick: false,
    allowEscapeKey: false,
  })

  sessionExpiredShown = false
  window.location.href = '/login'
}

function mergeAuthHeader(init?: RequestInit): RequestInit | undefined {
  const token = getAccessToken()
  if (!token) return init

  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return { ...init, headers }
}

async function isTokenInvalidResponse(res: Response): Promise<boolean> {
  if (res.status !== 401) return false
  const cloned = res.clone()
  try {
    const body = await cloned.json()
    return (
      body?.code === 'token_not_valid' ||
      body?.code === 'user_not_found' ||
      body?.code === 'session_replaced'
    )
  } catch {
    return false
  }
}

/**
 * Wrapper around fetch that refreshes expired JWTs once, retries the request,
 * and shows a SweetAlert when the session can no longer be renewed.
 */
export async function apiFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  let res = await fetch(input, mergeAuthHeader(init))

  if (await isTokenInvalidResponse(res)) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      res = await fetch(input, mergeAuthHeader(init))
    }
    if (await isTokenInvalidResponse(res)) {
      await handleSessionExpired()
      throw new Error('Session expired')
    }
  }

  return res
}
