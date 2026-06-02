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

export type BookingStatusTagRecord = {
  id: number
  tag: string
  created_at: string
}

export type BookingStatusRecord = {
  id: number
  company: number
  title: string
  description: string
  color: string
  sort_order: number
  item_count: number
  tags?: BookingStatusTagRecord[]
  created_at: string
  updated_at: string
}

type BookingStatusWrite = Pick<
  BookingStatusRecord,
  'title' | 'description' | 'color'
> & {
  tag_ids?: number[]
  sort_order?: number
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
  company?: number | null
  company_logo_url?: string
  field_type: string
  is_required: boolean
  price: string | null
  required_downpayment?: string | null
  value: string
  options: { label: string; price: string | null; sort_order: number }[]
  sort_order: number
  package_required_downpayment_amount?: string
}

export type BookingItemRecord = {
  id: number
  unique_id: string
  status: number
  /** Tenant status label; used when ``status`` id is from another account. */
  status_title?: string
  contact: number | null
  title: string
  date_of_event: string | null
  total_amount: string
  required_downpayment_amount: string
  paid_amount?: string
  paid_charge_amount?: string
  paid_processing_fees?: string
  paid_platform_fees?: string
  remaining_amount?: string
  package_required_downpayment_amount?: string
  groups?: BookingGroupRecord[]
  field_values?: BookingFieldValueRecord[]
  notes: string
  sort_order: number
  created_by: number | null
  pdf_url: string
  created_at: string
  updated_at: string
  company: number
  company_name?: string
  can_edit: boolean
}

/* ── Statuses ── */

export async function fetchBookingStatuses(): Promise<BookingStatusRecord[]> {
  const res = await apiFetch(buildApiUrl('/booking-statuses/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load booking statuses')
  return res.json()
}

export async function createBookingStatus(
  data: BookingStatusWrite,
): Promise<BookingStatusRecord> {
  const res = await apiFetch(buildApiUrl('/booking-statuses/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create status')
  return res.json()
}

export async function updateBookingStatus(
  id: number,
  data: Partial<BookingStatusWrite>,
): Promise<BookingStatusRecord> {
  const res = await apiFetch(buildApiUrl(`/booking-statuses/${id}/`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update status')
  return res.json()
}

export async function deleteBookingStatus(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`/booking-statuses/${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete status')
}

export async function reorderBookingStatuses(order: number[]): Promise<void> {
  const res = await apiFetch(buildApiUrl('/booking-statuses/reorder/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ order }),
  })
  if (!res.ok) throw new Error('Failed to reorder statuses')
}

/* ── Items ── */

export type BookingItemsPage = {
  count: number
  next: string | null
  previous: string | null
  results: BookingItemRecord[]
}

export async function fetchBookingItems(
  statusId?: number,
  options?: { all?: boolean },
): Promise<BookingItemRecord[]> {
  const params = new URLSearchParams()
  if (statusId) params.set('status', String(statusId))
  if (options?.all !== false) params.set('all', 'true')
  const qs = params.toString() ? `?${params}` : ''
  const res = await apiFetch(buildApiUrl(`/booking-items/${qs}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load booking items')
  return res.json()
}

export async function fetchBookingItemsPage(
  page = 1,
  filters: { search?: string; statusId?: number } = {},
): Promise<BookingItemsPage> {
  const params = new URLSearchParams({ page: String(page) })
  if (filters.search?.trim()) params.set('search', filters.search.trim())
  if (filters.statusId != null) params.set('status', String(filters.statusId))
  const res = await apiFetch(
    buildApiUrl(`/booking-items/?${params}`),
    { headers: authHeaders() },
  )
  if (!res.ok) throw new Error('Failed to load booking items')
  return res.json()
}

export async function fetchBookingItemsBoardPage(
  page = 1,
  filters: {
    search?: string
    boardColumnId?: number
    foreign?: boolean
  } = {},
): Promise<BookingItemsPage> {
  const params = new URLSearchParams({
    page: String(page),
    view: 'board',
  })
  if (filters.search?.trim()) params.set('search', filters.search.trim())
  if (filters.foreign) {
    params.set('board_slot', 'foreign')
  } else if (filters.boardColumnId != null) {
    params.set('board_column', String(filters.boardColumnId))
  }
  const res = await apiFetch(
    buildApiUrl(`/booking-items/?${params}`),
    { headers: authHeaders() },
  )
  if (!res.ok) throw new Error('Failed to load booking items')
  return res.json()
}

export async function fetchBookingItem(id: number): Promise<BookingItemRecord> {
  const res = await apiFetch(buildApiUrl(`/booking-items/${id}/`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load booking')
  return res.json()
}

export async function createBookingItem(
  data: Pick<
    BookingItemRecord,
    | 'status'
    | 'title'
    | 'date_of_event'
    | 'total_amount'
    | 'required_downpayment_amount'
    | 'field_values'
    | 'notes'
  > & { contact?: number | null; groups?: BookingGroupWrite[] },
): Promise<BookingItemRecord> {
  const res = await apiFetch(buildApiUrl('/booking-items/'), {
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
      | 'total_amount'
      | 'required_downpayment_amount'
      | 'field_values'
      | 'notes'
      | 'sort_order'
    >
  > & { groups?: BookingGroupWrite[] },
): Promise<BookingItemRecord> {
  const res = await apiFetch(buildApiUrl(`/booking-items/${id}/`), {
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
    buildApiUrl(`/booking-items/${bookingId}/groups/${groupId}/`),
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
  )
  if (!res.ok) throw new Error('Failed to delete booking group')
}

export async function deleteBookingItem(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`/booking-items/${id}/`), {
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
  const res = await apiFetch(buildApiUrl(`/booking-items/${id}/move/`), {
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
  const res = await apiFetch(buildApiUrl('/booking-items/reorder/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ items }),
  })
  if (!res.ok) throw new Error('Failed to reorder items')
}
