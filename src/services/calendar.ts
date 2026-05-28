import { apiFetch, authHeaders, buildApiUrl } from './api'

function extractError(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const obj = body as Record<string, unknown>
  for (const val of Object.values(obj)) {
    if (typeof val === 'string') return val
    if (Array.isArray(val) && val.length > 0) {
      if (typeof val[0] === 'string') return val[0]
      const nested = extractError(val[0])
      if (nested) return nested
    }
    if (val && typeof val === 'object') {
      const nested = extractError(val)
      if (nested) return nested
    }
  }
  return ''
}

async function calendarApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json()
    return new Error(extractError(body) || fallback)
  } catch {
    return new Error(fallback)
  }
}

export type CalendarStatusRecord = {
  id: number
  title: string
  description: string
  text_color: string
  background_color: string
  sort_order: number
  created_at: string
  deleted_at: string | null
}

export type CalendarEventRecord = {
  id: number
  title: string
  location: string
  start: string
  end: string
  repeat_type: string | null
  repeat_end: string | null
  status: number
  contact: number | null
  booking: number | null
  created_by: number | null
  created_at: string
  deleted_at: string | null
}

export type CalendarEventPayload = {
  title: string
  location?: string
  start: string
  end: string
  repeat_type?: string | null
  repeat_end?: string | null
  status: number
  contact?: number | null
  booking?: number | null
}

export const REPEAT_TYPE_OPTIONS = [
  { value: '', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
] as const

export type RepeatTypeValue = '' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export async function fetchCalendarStatuses(): Promise<CalendarStatusRecord[]> {
  const res = await apiFetch(buildApiUrl('/calendar-statuses/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load calendar statuses')
  return res.json()
}

export type CalendarStatusPayload = {
  title: string
  description?: string
  text_color: string
  background_color: string
}

export async function createCalendarStatus(
  data: CalendarStatusPayload,
): Promise<CalendarStatusRecord> {
  const res = await apiFetch(buildApiUrl('/calendar-statuses/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await calendarApiError(res, 'Failed to create calendar status')
  return res.json()
}

export async function updateCalendarStatus(
  id: number,
  data: Partial<CalendarStatusPayload>,
): Promise<CalendarStatusRecord> {
  const res = await apiFetch(buildApiUrl(`/calendar-statuses/${id}/`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await calendarApiError(res, 'Failed to update calendar status')
  return res.json()
}

export async function deleteCalendarStatus(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`/calendar-statuses/${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete calendar status')
}

export async function reorderCalendarStatuses(order: number[]): Promise<void> {
  const res = await apiFetch(buildApiUrl('/calendar-statuses/reorder/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ order }),
  })
  if (!res.ok) throw new Error('Failed to reorder calendar statuses')
}

export async function fetchCalendarEvents(
  start?: string,
  end?: string,
): Promise<CalendarEventRecord[]> {
  const params = new URLSearchParams()
  if (start) params.set('start', start)
  if (end) params.set('end', end)
  const qs = params.toString() ? `?${params.toString()}` : ''
  const res = await apiFetch(buildApiUrl(`/calendar-events/${qs}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load calendar events')
  return res.json()
}

export async function createCalendarEvent(
  data: CalendarEventPayload,
): Promise<CalendarEventRecord> {
  const res = await apiFetch(buildApiUrl('/calendar-events/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await calendarApiError(res, 'Failed to create appointment')
  return res.json()
}

export async function updateCalendarEvent(
  id: number,
  data: Partial<CalendarEventPayload>,
): Promise<CalendarEventRecord> {
  const res = await apiFetch(buildApiUrl(`/calendar-events/${id}/`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await calendarApiError(res, 'Failed to update appointment')
  return res.json()
}

export async function deleteCalendarEvent(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`/calendar-events/${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete appointment')
}
