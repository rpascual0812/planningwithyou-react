import { apiFetch, authHeaders, buildApiUrl, apiErrorFromResponse, apiPathWithQuery, readJsonResponse } from './api'

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

export type SystemNotificationsPage = {
  count: number
  next: string | null
  previous: string | null
  results: SystemNotificationRecord[]
}

export async function fetchActiveSystemNotifications(): Promise<ActiveSystemNotification[]> {
  const res = await apiFetch(buildApiUrl('/system-notifications/active/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load system notifications')
  return readJsonResponse(res, 'Failed to load system notifications')
}

export async function fetchAdminSystemNotifications(
  search = '',
  status = '',
): Promise<SystemNotificationRecord[]> {
  const page = await fetchAdminSystemNotificationsPage(1, search, status)
  return page.results
}

export async function fetchAdminSystemNotificationsPage(
  page = 1,
  search = '',
  status = '',
): Promise<SystemNotificationsPage> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  if (search.trim()) params.set('search', search.trim())
  if (status.trim()) params.set('status', status.trim())
  const res = await apiFetch(
    buildApiUrl(apiPathWithQuery('/admin/system-notifications', params)),
    { headers: authHeaders() },
  )
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to load system notifications')
  }
  return readJsonResponse(res, 'Failed to load system notifications')
}

export async function createSystemNotification(
  payload: SystemNotificationPayload,
): Promise<SystemNotificationRecord> {
  const res = await apiFetch(buildApiUrl('/admin/system-notifications/'), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to create notification')
  }
  return readJsonResponse(res, 'Failed to create notification')
}

export async function updateSystemNotification(
  id: number,
  payload: SystemNotificationPayload,
): Promise<SystemNotificationRecord> {
  const res = await apiFetch(buildApiUrl(`/admin/system-notifications/${id}/`), {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to update notification')
  }
  return readJsonResponse(res, 'Failed to update notification')
}

export async function deleteSystemNotification(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`/admin/system-notifications/${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to delete notification')
  }
}
