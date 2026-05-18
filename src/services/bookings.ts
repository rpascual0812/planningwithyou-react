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

async function bookingApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json()
    return new Error(extractError(body) || fallback)
  } catch {
    return new Error(fallback)
  }
}

/* ── Types ── */

export type BookingStatusRecord = {
  id: number
  title: string
  description: string
  color: string
  sort_order: number
  item_count: number
  created_at: string
  updated_at: string
}

export type BookingGroupRecord = {
  id: number
  name: string
}

export type BookingGroupWrite = {
  name: string
}

export type BookingFieldValueRecord = {
  id?: number
  label: string
  booking_group_id?: number | null
  group_name?: string
  field_type: string
  is_required: boolean
  price: string | null
  value: string
  options: { label: string; price: string | null; sort_order: number }[]
  sort_order: number
}

export type BookingItemRecord = {
  id: number
  unique_id: string
  status: number
  contact: number | null
  title: string
  date_of_event: string | null
  groups?: BookingGroupRecord[]
  field_values: BookingFieldValueRecord[]
  notes: string
  sort_order: number
  pdf: string
  created_at: string
  updated_at: string
}

/* ── Statuses ── */

export async function fetchBookingStatuses(): Promise<BookingStatusRecord[]> {
  const res = await apiFetch(buildApiUrl('/api/statuses/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load booking statuses')
  return res.json()
}

export async function createBookingStatus(
  data: Pick<BookingStatusRecord, 'title' | 'description' | 'color'>,
): Promise<BookingStatusRecord> {
  const res = await apiFetch(buildApiUrl('/api/statuses/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create status')
  return res.json()
}

export async function updateBookingStatus(
  id: number,
  data: Partial<Pick<BookingStatusRecord, 'title' | 'description' | 'color' | 'sort_order'>>,
): Promise<BookingStatusRecord> {
  const res = await apiFetch(buildApiUrl(`/api/statuses/${id}/`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update status')
  return res.json()
}

export async function deleteBookingStatus(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`/api/statuses/${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete status')
}

export async function reorderBookingStatuses(order: number[]): Promise<void> {
  const res = await apiFetch(buildApiUrl('/api/statuses/reorder/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ order }),
  })
  if (!res.ok) throw new Error('Failed to reorder statuses')
}

/* ── Items ── */

export async function fetchBookingItems(statusId?: number): Promise<BookingItemRecord[]> {
  const params = new URLSearchParams()
  if (statusId) params.set('status', String(statusId))
  const qs = params.toString() ? `?${params}` : ''
  const res = await apiFetch(buildApiUrl(`/api/booking-items/${qs}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load booking items')
  return res.json()
}

export async function fetchBookingItem(id: number): Promise<BookingItemRecord> {
  const res = await apiFetch(buildApiUrl(`/api/booking-items/${id}/`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load booking')
  return res.json()
}

export async function createBookingItem(
  data: Pick<
    BookingItemRecord,
    'status' | 'title' | 'date_of_event' | 'field_values' | 'notes'
  > & { contact?: number | null; groups?: BookingGroupWrite[] },
): Promise<BookingItemRecord> {
  const res = await apiFetch(buildApiUrl('/api/booking-items/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await bookingApiError(res, 'Failed to create booking')
  return res.json()
}

export async function updateBookingItem(
  id: number,
  data: Partial<
    Pick<
      BookingItemRecord,
      | 'status'
      | 'contact'
      | 'title'
      | 'date_of_event'
      | 'field_values'
      | 'notes'
      | 'sort_order'
    >
  > & { groups?: BookingGroupWrite[] },
): Promise<BookingItemRecord> {
  const res = await apiFetch(buildApiUrl(`/api/booking-items/${id}/`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await bookingApiError(res, 'Failed to save booking')
  return res.json()
}

export async function deleteBookingGroup(
  bookingId: number,
  groupId: number,
): Promise<void> {
  const res = await apiFetch(
    buildApiUrl(`/api/booking-items/${bookingId}/groups/${groupId}/`),
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
  )
  if (!res.ok) throw new Error('Failed to delete booking group')
}

export async function deleteBookingItem(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`/api/booking-items/${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete item')
}

export async function moveBookingItem(
  id: number,
  statusId: number,
  sortOrder: number,
): Promise<BookingItemRecord> {
  const res = await apiFetch(buildApiUrl(`/api/booking-items/${id}/move/`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ status: statusId, sort_order: sortOrder }),
  })
  if (!res.ok) throw new Error('Failed to move item')
  return res.json()
}

export async function reorderBookingItems(
  items: { id: number; status: number; sort_order: number }[],
): Promise<void> {
  const res = await apiFetch(buildApiUrl('/api/booking-items/reorder/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ items }),
  })
  if (!res.ok) throw new Error('Failed to reorder items')
}
