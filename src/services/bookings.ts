import { apiFetch, authHeaders, buildApiUrl } from './api'

/* ── Types ── */

export type BookingColumnRecord = {
  id: number
  title: string
  description: string
  color: string
  sort_order: number
  item_count: number
  created_at: string
  updated_at: string
}

export type BookingFieldValueRecord = {
  id?: number
  label: string
  field_type: string
  is_required: boolean
  price: string | null
  value: string
  options: { label: string; price: string | null; sort_order: number }[]
  sort_order: number
}

export type BookingItemRecord = {
  id: number
  column: number
  title: string
  date_of_event: string | null
  form_template: number | null
  field_values: BookingFieldValueRecord[]
  notes: string
  sort_order: number
  created_at: string
  updated_at: string
}

/* ── Columns ── */

export async function fetchBookingColumns(): Promise<BookingColumnRecord[]> {
  const res = await apiFetch(buildApiUrl('/api/booking-columns/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load booking columns')
  return res.json()
}

export async function createBookingColumn(
  data: Pick<BookingColumnRecord, 'title' | 'description' | 'color'>,
): Promise<BookingColumnRecord> {
  const res = await apiFetch(buildApiUrl('/api/booking-columns/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create column')
  return res.json()
}

export async function updateBookingColumn(
  id: number,
  data: Partial<Pick<BookingColumnRecord, 'title' | 'description' | 'color' | 'sort_order'>>,
): Promise<BookingColumnRecord> {
  const res = await apiFetch(buildApiUrl(`/api/booking-columns/${id}/`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update column')
  return res.json()
}

export async function deleteBookingColumn(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`/api/booking-columns/${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete column')
}

export async function reorderBookingColumns(order: number[]): Promise<void> {
  const res = await apiFetch(buildApiUrl('/api/booking-columns/reorder/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ order }),
  })
  if (!res.ok) throw new Error('Failed to reorder columns')
}

/* ── Items ── */

export async function fetchBookingItems(columnId?: number): Promise<BookingItemRecord[]> {
  const params = new URLSearchParams()
  if (columnId) params.set('column', String(columnId))
  const qs = params.toString() ? `?${params}` : ''
  const res = await apiFetch(buildApiUrl(`/api/booking-items/${qs}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load booking items')
  return res.json()
}

export async function createBookingItem(
  data: Pick<BookingItemRecord, 'column' | 'title' | 'date_of_event' | 'form_template' | 'field_values' | 'notes'>,
): Promise<BookingItemRecord> {
  const res = await apiFetch(buildApiUrl('/api/booking-items/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create item')
  return res.json()
}

export async function updateBookingItem(
  id: number,
  data: Partial<Pick<BookingItemRecord, 'column' | 'title' | 'date_of_event' | 'form_template' | 'field_values' | 'notes' | 'sort_order'>>,
): Promise<BookingItemRecord> {
  const res = await apiFetch(buildApiUrl(`/api/booking-items/${id}/`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update item')
  return res.json()
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
  columnId: number,
  sortOrder: number,
): Promise<BookingItemRecord> {
  const res = await apiFetch(buildApiUrl(`/api/booking-items/${id}/move/`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ column: columnId, sort_order: sortOrder }),
  })
  if (!res.ok) throw new Error('Failed to move item')
  return res.json()
}

export async function reorderBookingItems(
  items: { id: number; column: number; sort_order: number }[],
): Promise<void> {
  const res = await apiFetch(buildApiUrl('/api/booking-items/reorder/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ items }),
  })
  if (!res.ok) throw new Error('Failed to reorder items')
}
