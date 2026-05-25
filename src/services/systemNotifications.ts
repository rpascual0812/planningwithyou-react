import { apiFetch, authHeaders, buildApiUrl } from './api'

export type SystemNotificationRecord = {
  id: number
  title: string
  message: string
  start_date: string
  end_date: string
  created_by: number | null
  created_by_name: string
  created_at: string
}

export type SystemNotificationPayload = {
  title: string
  message: string
  start_date: string
  end_date: string
}

export type ActiveSystemNotification = {
  id: number
  title: string
  message: string
  start_date: string
  end_date: string
}

export async function fetchActiveSystemNotifications(): Promise<ActiveSystemNotification[]> {
  const res = await apiFetch(buildApiUrl('/api/system-notifications/active/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load system notifications')
  return res.json()
}

export async function fetchAdminSystemNotifications(
  search = '',
  status = '',
): Promise<SystemNotificationRecord[]> {
  const params = new URLSearchParams()
  if (search.trim()) params.set('search', search.trim())
  if (status.trim()) params.set('status', status.trim())
  const qs = params.toString()
  const res = await apiFetch(
    buildApiUrl(`/api/admin/system-notifications/${qs ? `?${qs}` : ''}`),
    { headers: authHeaders() },
  )
  if (!res.ok) throw new Error('Failed to load system notifications')
  return res.json()
}

export async function createSystemNotification(
  payload: SystemNotificationPayload,
): Promise<SystemNotificationRecord> {
  const res = await apiFetch(buildApiUrl('/api/admin/system-notifications/'), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    let detail = 'Failed to create notification'
    try {
      const body = (await res.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return res.json()
}

export async function updateSystemNotification(
  id: number,
  payload: SystemNotificationPayload,
): Promise<SystemNotificationRecord> {
  const res = await apiFetch(buildApiUrl(`/api/admin/system-notifications/${id}/`), {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    let detail = 'Failed to update notification'
    try {
      const body = (await res.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return res.json()
}

export async function deleteSystemNotification(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`/api/admin/system-notifications/${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete notification')
}
