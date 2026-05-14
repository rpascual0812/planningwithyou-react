import Swal from 'sweetalert2'
import { getAccessToken } from './auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

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

function clearStoredTokens() {
  localStorage.removeItem(TOKEN_STORAGE_KEYS.access)
  localStorage.removeItem(TOKEN_STORAGE_KEYS.refresh)
  sessionStorage.removeItem(TOKEN_STORAGE_KEYS.access)
  sessionStorage.removeItem(TOKEN_STORAGE_KEYS.refresh)
}

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

/**
 * Wrapper around fetch that automatically handles 401 responses with
 * `token_not_valid`. Shows a SweetAlert and redirects to /login.
 */
export async function apiFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init)

  if (res.status === 401) {
    const cloned = res.clone()
    try {
      const body = await cloned.json()
      if (body?.code === 'token_not_valid' || body?.code === 'user_not_found') {
        handleSessionExpired()
        throw new Error('Session expired')
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'Session expired') throw e
    }
  }

  return res
}
