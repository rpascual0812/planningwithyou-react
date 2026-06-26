import { apiFetch, authHeaders, buildApiUrl } from './api'

const BASE = '/user-notifications/'

export type UserNotificationRecord = {
  id: number
  category: string
  severity: 'info' | 'warning' | 'error'
  title: string
  message: string
  action_url: string
  company_id: number | null
  is_read: boolean
  read_at: string | null
  created_at: string
  updated_at: string
}

export async function fetchUserNotifications(
  unreadOnly = false,
): Promise<UserNotificationRecord[]> {
  const params = new URLSearchParams()
  if (unreadOnly) params.set('unread_only', 'true')
  const qs = params.toString() ? `?${params.toString()}` : ''
  const res = await apiFetch(buildApiUrl(`${BASE}${qs}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load notifications')
  return res.json()
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const res = await apiFetch(buildApiUrl(`${BASE}unread-count/`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load notification count')
  const data = (await res.json()) as { count: number }
  return data.count
}

/** Opens a notification and marks it read on the server. */
export async function openUserNotification(
  id: number,
): Promise<UserNotificationRecord> {
  const res = await apiFetch(buildApiUrl(`${BASE}${id}/`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load notification')
  return res.json()
}

export async function deleteUserNotification(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`${BASE}${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete notification')
}
