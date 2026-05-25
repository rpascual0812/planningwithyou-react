import Swal from 'sweetalert2'
import {
  clearStoredTokens,
  getAccessToken,
  refreshAccessToken,
} from './auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export function buildApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const base = (API_BASE_URL ?? '').replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${suffix}` : suffix
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
